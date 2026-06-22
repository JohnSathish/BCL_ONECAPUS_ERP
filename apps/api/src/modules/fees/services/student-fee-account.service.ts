import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  ADMISSION_DEMAND_TYPE,
  MONTHLY_DEMAND_TYPE,
} from '../constants/monthly-fee.constants';
import { semesterPairLabel } from '../constants/fee-cycle.constants';
import {
  FEE_PAYMENT_SOURCE_LABELS,
  type FeePaymentSource,
} from '../constants/payment-source.constants';
import { FeeFinanceSettingsService } from './fee-finance-settings.service';
import { StudentFeeSummaryService } from './student-fee-summary.service';

@Injectable()
export class StudentFeeAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feeSummary: StudentFeeSummaryService,
    private readonly financeSettings: FeeFinanceSettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async getMyAccount(tenantId: string, userId: string) {
    const student = await this.db().student.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      return {
        studentId: null,
        summary: { totalOutstanding: 0, totalPaid: 0, outstanding: 0 },
        admissionCycles: [],
        monthlyFees: [],
        payableItems: [],
        receipts: [],
      };
    }
    return this.getAccount(tenantId, student.id);
  }

  async getAccount(tenantId: string, studentId: string) {
    const [
      demands,
      receipts,
      student,
      summary,
      concessions,
      cycles,
      settings,
      payments,
      ledgerEntries,
    ] = await Promise.all([
      this.db().studentFeeDemand.findMany({
        where: {
          tenantId,
          studentId,
          status: { notIn: ['CANCELLED', 'ROLLED_BACK'] },
        },
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.db().feeReceipt.findMany({
        where: { tenantId, studentId },
        orderBy: { issuedAt: 'desc' },
        take: 50,
      }),
      this.db().student.findFirst({
        where: { id: studentId, tenantId },
        select: {
          enrollmentNumber: true,
          rollNumber: true,
          user: { select: { displayName: true, email: true } },
          programVersion: { include: { program: { select: { name: true } } } },
          primaryShift: { select: { name: true } },
          academicStanding: {
            select: { currentSemesterSequence: true, lifecycleState: true },
          },
          masterProfile: { select: { mobileNumber: true, fullName: true } },
        },
      }),
      this.feeSummary.get(tenantId, studentId),
      this.db().feeConcession.findMany({
        where: { tenantId, studentId, status: 'APPROVED' },
        include: { scheme: { select: { name: true, code: true } } },
        orderBy: { approvedAt: 'desc' },
        take: 50,
      }),
      this.db().academicFeeCycle.findMany({
        where: { tenantId, deletedAt: null },
        orderBy: { startSemester: 'asc' },
      }),
      this.financeSettings.get(tenantId),
      this.db().paymentTransaction.findMany({
        where: {
          tenantId,
          studentId,
          status: { in: ['SUCCESS', 'PENDING_CLEARANCE', 'PAID'] },
        },
        include: { allocations: true },
        orderBy: { paidAt: 'desc' },
        take: 80,
      }),
      this.db().studentFeeLedgerEntry.findMany({
        where: { tenantId, studentId },
        orderBy: { postedAt: 'desc' },
        take: 80,
      }),
    ]);

    const monthlyFees = demands
      .filter(
        (d: { demandType: string }) => d.demandType === MONTHLY_DEMAND_TYPE,
      )
      .map((d: Record<string, unknown>) => this.mapMonthlyDemand(d));

    const admissionDemands = demands
      .filter(
        (d: { demandType: string }) => d.demandType === ADMISSION_DEMAND_TYPE,
      )
      .map((d: Record<string, unknown>) => this.mapDemandRow(d));

    const admissionCycles = cycles.map(
      (cycle: {
        id: string;
        code: string;
        name: string;
        startSemester: number;
        endSemester: number;
        totalAmount: unknown;
      }) => {
        const demand = demands.find(
          (d: { feeCycleId?: string; status: string }) =>
            d.feeCycleId === cycle.id && d.status !== 'CANCELLED',
        );
        return {
          cycleId: cycle.id,
          cycleCode: cycle.code,
          cycleName: cycle.name,
          covers: semesterPairLabel(cycle.startSemester, cycle.endSemester),
          configuredAmount: Number(cycle.totalAmount),
          status: demand
            ? demand.status === 'PAID' || Number(demand.balanceAmount) <= 0
              ? 'PAID'
              : Number(demand.paidAmount) > 0
                ? 'PARTIAL'
                : 'PENDING'
            : 'NOT_GENERATED',
          demandId: demand?.id ?? null,
          demandNo: demand?.demandNo ?? null,
          totalAmount: demand ? Number(demand.totalAmount) : null,
          paidAmount: demand ? Number(demand.paidAmount) : null,
          balanceAmount: demand ? Number(demand.balanceAmount) : null,
        };
      },
    );

    const admissionPaid = admissionDemands.reduce(
      (s: number, d: { paidAmount?: number }) => s + Number(d.paidAmount ?? 0),
      0,
    );
    const monthlyPaid = monthlyFees.reduce(
      (s: number, d: { paidAmount?: number }) => s + Number(d.paidAmount ?? 0),
      0,
    );

    const concessionTotal = concessions.reduce(
      (s: number, c: { approvedAmount: unknown }) =>
        s + Number(c.approvedAmount ?? 0),
      0,
    );
    const scholarshipTotal = concessions
      .filter((c: { concessionType: string }) =>
        /SCHOLAR|MERIT|MINORITY|SPORTS|MANAGEMENT/i.test(c.concessionType),
      )
      .reduce(
        (s: number, c: { approvedAmount: unknown }) =>
          s + Number(c.approvedAmount ?? 0),
        0,
      );

    const lastReceipt = receipts[0];
    const payableItems = this.buildPayableItems(demands);
    const monthlyTracker = this.buildMonthlyTracker(demands);
    const admissionFeeStatus = this.buildAdmissionFeeStatus(
      admissionCycles,
      summary,
    );
    const monthlyFeeStatus = this.buildMonthlyFeeStatus(
      monthlyFees,
      monthlyTracker,
      summary,
    );
    const paymentHistory = await this.buildPaymentHistory(
      payments,
      receipts,
      demands,
      tenantId,
    );
    const feeLedger = this.buildFeeLedger(ledgerEntries, payments, demands);

    const hallTicket = {
      blocked: Boolean(
        settings.blockHallTicketOnDue && summary.totalOutstanding > 0,
      ),
      outstandingAmount: summary.totalOutstanding,
      reasons:
        summary.totalOutstanding > 0
          ? [`Outstanding fees: ₹${summary.totalOutstanding}`]
          : [],
    };

    return {
      studentId,
      student: student
        ? {
            enrollmentNumber: student.enrollmentNumber,
            rollNumber: student.rollNumber,
            name: student.masterProfile?.fullName ?? student.user?.displayName,
            mobile: student.masterProfile?.mobileNumber,
            program: student.programVersion?.program?.name,
            shift: student.primaryShift?.name,
            semester: student.academicStanding?.currentSemesterSequence,
            status: student.academicStanding?.lifecycleState ?? 'ACTIVE',
          }
        : null,
      summary: {
        totalDemand: summary.totalPaid + summary.totalOutstanding,
        totalPaid: summary.totalPaid,
        outstanding: summary.totalOutstanding,
        overdue: summary.totalOverdue,
        concessionTotal,
        scholarshipTotal,
        totalArrears: summary.totalOutstanding,
        totalDue: summary.totalOutstanding,
        admissionOutstanding: summary.admissionOutstanding,
        monthlyOutstanding: summary.monthlyOutstanding,
        admissionPaid,
        monthlyPaid,
        currentDue: summary.totalOutstanding,
      },
      admissionFeeStatus,
      monthlyFeeStatus,
      admissionCycles,
      admissionDemands,
      monthlyFees,
      monthlyTracker,
      paymentHistory,
      feeLedger,
      demands: demands.map((d: Record<string, unknown>) =>
        this.mapDemandRow(d),
      ),
      payableItems,
      hallTicket,
      collectionModes: settings.collectionModes,
      availablePaymentMethods: settings.availablePaymentMethods,
      studentPortal: settings.studentPortal,
      lastPayment: lastReceipt
        ? {
            amount: Number(lastReceipt.amount),
            receiptNo: lastReceipt.receiptNo,
            issuedAt: lastReceipt.issuedAt,
          }
        : null,
      arrears: summary.totalOutstanding,
      receipts: receipts.map((r: Record<string, unknown>) => ({
        id: r.id,
        receiptNo: r.receiptNo,
        amount: Number(r.amount),
        issuedAt: r.issuedAt,
        status: r.status,
      })),
      concessions: concessions.map((c: Record<string, unknown>) => ({
        id: c.id,
        type: c.concessionType,
        schemeName:
          (c.scheme as { name?: string } | null)?.name ??
          String(c.concessionType ?? 'Concession'),
        approvedAmount: Number(c.approvedAmount ?? 0),
        calculationType: c.calculationType,
        value: Number(c.value ?? 0),
        approvedAt: c.approvedAt,
        reason: c.reason,
      })),
    };
  }

  private buildAdmissionFeeStatus(
    admissionCycles: Array<{
      status: string;
      balanceAmount: number | null;
      totalAmount: number | null;
    }>,
    summary: { admissionOutstanding: number },
  ) {
    const pending = admissionCycles.filter(
      (c) => c.status === 'PENDING' || c.status === 'PARTIAL',
    );
    const paid = admissionCycles.filter((c) => c.status === 'PAID');
    return {
      status:
        summary.admissionOutstanding <= 0 && paid.length > 0
          ? 'PAID'
          : pending.length
            ? 'PENDING'
            : 'NOT_GENERATED',
      outstanding: summary.admissionOutstanding,
      paidCycles: paid.length,
      pendingCycles: pending.length,
      cycles: admissionCycles,
    };
  }

  private buildMonthlyFeeStatus(
    monthlyFees: Array<{ status: string; balanceAmount: number }>,
    monthlyTracker: { paidMonths: number; pendingMonths: number },
    summary: { monthlyOutstanding: number },
  ) {
    const hasAnyMonthlyDemand =
      monthlyFees.length > 0 ||
      monthlyTracker.paidMonths > 0 ||
      monthlyTracker.pendingMonths > 0;
    let status = 'NOT_GENERATED';
    if (hasAnyMonthlyDemand) {
      status = summary.monthlyOutstanding <= 0 ? 'PAID' : 'PENDING';
    }
    return {
      status,
      outstanding: summary.monthlyOutstanding,
      paidMonths: monthlyTracker.paidMonths,
      pendingMonths: monthlyTracker.pendingMonths,
      months: monthlyFees,
    };
  }

  private buildMonthlyTracker(demands: Array<Record<string, unknown>>) {
    const year = new Date().getFullYear();
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const monthlyDemands = demands.filter(
      (d) => d.demandType === MONTHLY_DEMAND_TYPE,
    );
    const byPeriod = new Map(
      monthlyDemands.map((d) => [String(d.billingPeriod ?? ''), d]),
    );

    let paidMonths = 0;
    let pendingMonths = 0;
    const months = monthNames.map((shortLabel, index) => {
      const period = `${year}-${String(index + 1).padStart(2, '0')}`;
      const demand = byPeriod.get(period);
      let status: 'PAID' | 'PENDING' | 'NOT_GENERATED' = 'NOT_GENERATED';
      let demandId: string | null = null;
      let amount: number | null = null;
      let balanceAmount: number | null = null;

      if (demand) {
        demandId = String(demand.id);
        amount = Number(demand.totalAmount ?? 0);
        balanceAmount = Number(demand.balanceAmount ?? 0);
        if (balanceAmount <= 0) {
          status = 'PAID';
          paidMonths += 1;
        } else {
          status = 'PENDING';
          pendingMonths += 1;
        }
      }

      return {
        period,
        month: index + 1,
        shortLabel,
        label: `${shortLabel} ${year}`,
        status,
        demandId,
        amount,
        balanceAmount,
        payable: status === 'PENDING',
      };
    });

    return { year, months, paidMonths, pendingMonths };
  }

  private async buildPaymentHistory(
    payments: Array<Record<string, unknown>>,
    receipts: Array<Record<string, unknown>>,
    demands: Array<Record<string, unknown>>,
    tenantId: string,
  ) {
    const receiptByPayment = new Map(
      receipts.filter((r) => r.paymentId).map((r) => [String(r.paymentId), r]),
    );
    const demandMap = new Map(demands.map((d) => [String(d.id), d]));

    const collectorIds = [
      ...new Set(
        payments
          .map((p) => p.collectedById)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const collectors = collectorIds.length
      ? await this.db().user.findMany({
          where: { tenantId, id: { in: collectorIds } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
    const collectorMap = new Map(
      collectors.map(
        (u: { id: string; displayName?: string; email?: string }) => [
          u.id,
          u.displayName ?? u.email ?? 'Finance Office',
        ],
      ),
    );

    return payments.map((payment) => {
      const meta = (payment.metadata ?? {}) as Record<string, unknown>;
      const audit = (meta.audit ?? {}) as Record<string, unknown>;
      const source = (payment.paymentSource ??
        meta.paymentSource ??
        payment.paymentMode) as FeePaymentSource | string;
      const receipt = receiptByPayment.get(String(payment.id));
      const allocationDemandIds = (
        (payment.allocations as Array<{ demandId: string }>) ?? []
      ).map((a) => a.demandId);
      const feeHeads = allocationDemandIds
        .map((id) => {
          const demand = demandMap.get(id);
          if (!demand) return null;
          const row = this.mapDemandRow(demand);
          return row.label;
        })
        .filter(Boolean);

      const collectedById = payment.collectedById
        ? String(payment.collectedById)
        : null;

      return {
        id: payment.id,
        transactionNo: payment.transactionNo,
        amount: Number(payment.amount),
        paidAt: payment.paidAt ?? payment.createdAt,
        paymentSource: source,
        paymentSourceLabel:
          FEE_PAYMENT_SOURCE_LABELS[source as FeePaymentSource] ??
          String(source).replace(/_/g, ' '),
        paymentMethodLabel:
          (meta.collectionMethodLabel as string) ??
          FEE_PAYMENT_SOURCE_LABELS[source as FeePaymentSource] ??
          String(payment.paymentMode).replace(/_/g, ' '),
        externalReference: payment.externalReference ?? null,
        utrNumber: (meta.utrNumber as string) ?? null,
        transactionReference: (meta.transactionReference as string) ?? null,
        clearanceStatus:
          payment.status === 'PENDING_CLEARANCE'
            ? 'PENDING'
            : ((meta.clearanceStatus as string) ?? 'CLEARED'),
        collectedByName:
          (meta.collectedByName as string) ??
          (collectedById ? collectorMap.get(collectedById) : null) ??
          (audit.collectedByEmail as string) ??
          null,
        receiptId: receipt?.id ?? null,
        receiptNo: receipt?.receiptNo ?? null,
        feeHeads,
        remarks: payment.remarks ?? null,
        status: payment.status,
      };
    });
  }

  private buildFeeLedger(
    entries: Array<Record<string, unknown>>,
    payments: Array<Record<string, unknown>>,
    demands: Array<Record<string, unknown>>,
  ) {
    const paymentMap = new Map(payments.map((p) => [String(p.id), p]));
    const demandMap = new Map(demands.map((d) => [String(d.id), d]));

    return entries.map((entry) => {
      const payment = entry.paymentId
        ? paymentMap.get(String(entry.paymentId))
        : null;
      const demand = entry.demandId
        ? demandMap.get(String(entry.demandId))
        : null;
      const source = payment
        ? ((payment.paymentSource ??
            (payment.metadata as { paymentSource?: string })?.paymentSource ??
            payment.paymentMode) as string)
        : null;

      return {
        id: entry.id,
        entryNo: entry.entryNo,
        entryType: entry.entryType,
        postedAt: entry.postedAt,
        description: entry.description,
        debitAmount: Number(entry.debitAmount ?? 0),
        creditAmount: Number(entry.creditAmount ?? 0),
        runningBalance: Number(entry.runningBalance ?? 0),
        feeHead: demand ? this.mapDemandRow(demand).label : null,
        paymentSource: source,
        paymentSourceLabel: source
          ? (FEE_PAYMENT_SOURCE_LABELS[source as FeePaymentSource] ??
            String(source).replace(/_/g, ' '))
          : null,
      };
    });
  }

  private formatPeriodLabel(
    demandType: string,
    period: string | null,
    metadata?: { feeCycleName?: string; coversSemesters?: number[] },
  ) {
    if (demandType === MONTHLY_DEMAND_TYPE && period?.match(/^\d{4}-\d{2}$/)) {
      const [y, m] = period.split('-');
      return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
    }
    if (demandType === ADMISSION_DEMAND_TYPE) {
      if (metadata?.feeCycleName) {
        const sem = metadata.coversSemesters;
        if (Array.isArray(sem) && sem.length === 2) {
          return `${metadata.feeCycleName} (${semesterPairLabel(sem[0], sem[1])})`;
        }
        return metadata.feeCycleName;
      }
      if (period?.startsWith('CYCLE-')) {
        return period.replace('CYCLE-', 'Admission cycle ');
      }
    }
    return period ?? '—';
  }

  private mapDemandRow(d: Record<string, unknown>) {
    const balance = Number(d.balanceAmount);
    const paid = Number(d.paidAmount);
    let status = 'DUE';
    if (balance <= 0) status = 'PAID';
    else if (paid > 0) status = 'PARTIAL';

    const period = d.billingPeriod ? String(d.billingPeriod) : null;
    const demandType = String(d.demandType ?? '');
    const metadata = d.metadata as
      | { feeCycleName?: string; coversSemesters?: number[] }
      | undefined;
    const periodLabel = this.formatPeriodLabel(demandType, period, metadata);
    const feeType =
      demandType === ADMISSION_DEMAND_TYPE
        ? 'Admission Fee'
        : demandType === MONTHLY_DEMAND_TYPE
          ? 'Monthly Tuition'
          : demandType.replace(/_/g, ' ');

    const label =
      demandType === MONTHLY_DEMAND_TYPE
        ? `Monthly Tuition · ${periodLabel}`
        : demandType === ADMISSION_DEMAND_TYPE
          ? `Admission Fee · ${periodLabel}`
          : period
            ? `${feeType} · ${periodLabel}`
            : (metadata?.feeCycleName ?? feeType);

    return {
      demandId: d.id,
      demandNo: d.demandNo,
      demandType,
      feeType,
      period,
      periodLabel,
      label,
      totalAmount: Number(d.totalAmount),
      paidAmount: paid,
      balanceAmount: balance,
      fineAmount: Number(d.fineAmount ?? 0),
      concessionAmount: Number(d.concessionAmount ?? 0),
      dueDate: d.dueDate,
      status,
      lines: (d.lines as Array<Record<string, unknown>> | undefined)?.map(
        (line) => ({
          code: line.code,
          name: line.name,
          amount: Number(line.amount),
        }),
      ),
    };
  }

  private buildPayableItems(demands: Array<Record<string, unknown>>) {
    const items: Array<{
      id: string;
      demandId: string;
      demandType: string;
      period: string | null;
      periodLabel: string;
      label: string;
      amount: number;
      fineAmount: number;
      type: 'DEMAND';
    }> = [];

    for (const d of demands) {
      const balance = Number(d.balanceAmount ?? 0);
      if (balance <= 0) continue;
      if (!['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'].includes(String(d.status)))
        continue;
      const row = this.mapDemandRow(d);
      items.push({
        id: `demand-${d.id}`,
        demandId: String(d.id),
        demandType: row.demandType,
        period: row.period,
        periodLabel: row.periodLabel,
        label: row.label,
        amount: balance,
        fineAmount: Number(d.fineAmount ?? 0),
        type: 'DEMAND',
      });
    }
    return items;
  }

  private mapMonthlyDemand(d: Record<string, unknown>) {
    const balance = Number(d.balanceAmount);
    const paid = Number(d.paidAmount);
    let status = 'PENDING';
    if (balance <= 0) status = 'PAID';
    else if (paid > 0) status = 'PARTIAL';

    const period = String(d.billingPeriod ?? '');
    const [y, m] = period.split('-');
    const monthLabel = period
      ? new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', {
          month: 'long',
          year: 'numeric',
        })
      : period;

    return {
      demandId: d.id,
      demandNo: d.demandNo,
      period,
      monthLabel,
      totalAmount: Number(d.totalAmount),
      paidAmount: paid,
      balanceAmount: balance,
      fineAmount: Number(d.fineAmount ?? 0),
      dueDate: d.dueDate,
      status,
      lines: d.lines,
    };
  }
}
