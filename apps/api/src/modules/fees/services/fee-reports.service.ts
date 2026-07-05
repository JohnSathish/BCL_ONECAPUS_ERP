import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer';
import {
  buildInstitutionalExcelReport,
  type InstitutionalReportColumn,
} from '../../../common/reports';
import { PrismaService } from '../../../database/prisma.service';
import type { ReportsQueryDto } from '../dto/fees.dto';
import { FEE_PAYMENT_SOURCE_LABELS } from '../constants/payment-source.constants';

@Injectable()
export class FeeReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async dashboard(tenantId: string) {
    const [demands, payments, concessions, receipts] = await Promise.all([
      this.db().studentFeeDemand.findMany({ where: { tenantId }, take: 5000 }),
      this.db().paymentTransaction.findMany({
        where: { tenantId },
        take: 5000,
      }),
      this.db().feeConcession.findMany({ where: { tenantId }, take: 1000 }),
      this.db().feeReceipt.findMany({ where: { tenantId }, take: 1000 }),
    ]);
    const studentIds = [...new Set(demands.map((d: any) => d.studentId))];
    const students = studentIds.length
      ? await this.db().student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: {
            user: { select: { displayName: true } },
            programVersion: { include: { program: true } },
          },
        })
      : [];
    const studentMap = new Map(students.map((s: any) => [s.id, s]));

    const today = new Date().toISOString().slice(0, 10);
    const todayCollection = payments
      .filter((payment: any) =>
        String(payment.paidAt ?? payment.createdAt).startsWith(today),
      )
      .reduce(
        (sum: number, payment: any) => sum + Number(payment.amount ?? 0),
        0,
      );
    const outstanding = demands.reduce(
      (sum: number, demand: any) => sum + Number(demand.balanceAmount ?? 0),
      0,
    );
    const admissionDemands = demands.filter(
      (d: any) => d.demandType === 'ADMISSION_SESSION',
    );
    const monthlyDemands = demands.filter(
      (d: any) => d.demandType === 'MONTHLY_TUITION',
    );

    return {
      kpis: {
        todayCollection,
        outstanding,
        totalDemanded: demands.reduce(
          (sum: number, demand: any) => sum + Number(demand.totalAmount ?? 0),
          0,
        ),
        totalCollected: payments.reduce(
          (sum: number, payment: any) => sum + Number(payment.amount ?? 0),
          0,
        ),
        admissionCollection: admissionDemands.reduce(
          (s: number, d: any) => s + Number(d.paidAmount ?? 0),
          0,
        ),
        monthlyCollection: monthlyDemands.reduce(
          (s: number, d: any) => s + Number(d.paidAmount ?? 0),
          0,
        ),
        admissionOutstanding: admissionDemands.reduce(
          (s: number, d: any) => s + Number(d.balanceAmount ?? 0),
          0,
        ),
        monthlyOutstanding: monthlyDemands.reduce(
          (s: number, d: any) => s + Number(d.balanceAmount ?? 0),
          0,
        ),
        renewalPending: demands.filter(
          (demand: any) =>
            demand.demandType === 'RENEWAL' &&
            Number(demand.balanceAmount ?? 0) > 0,
        ).length,
        concessions: concessions.reduce(
          (sum: number, item: any) => sum + Number(item.approvedAmount ?? 0),
          0,
        ),
        fines: demands.reduce(
          (s: number, d: any) => s + Number(d.fineAmount ?? 0),
          0,
        ),
        receiptCount: receipts.length,
        defaulterCount: new Set(
          demands
            .filter((d: any) => Number(d.balanceAmount ?? 0) > 0)
            .map((d: any) => d.studentId),
        ).size,
        ...(await this.reconciliationKpis(tenantId)),
      },
      trends: this.monthlyCollection(payments),
      split: {
        admission: admissionDemands.reduce(
          (s: number, d: any) => s + Number(d.paidAmount ?? 0),
          0,
        ),
        monthly: monthlyDemands.reduce(
          (s: number, d: any) => s + Number(d.paidAmount ?? 0),
          0,
        ),
      },
      defaulters: demands
        .filter((demand: any) => Number(demand.balanceAmount ?? 0) > 0)
        .sort(
          (a: any, b: any) =>
            Number(b.balanceAmount ?? 0) - Number(a.balanceAmount ?? 0),
        )
        .slice(0, 10)
        .map((d: any) =>
          this.enrichDemandRow(d, studentMap.get(String(d.studentId ?? ''))),
        ),
    };
  }

  async report(tenantId: string, type: string, query: ReportsQueryDto) {
    const dateWhere = this.dateWhere(query);
    if (type === 'daily-collection') {
      return this.dailyCollectionReport(tenantId, query);
    }
    if (type === 'monthly-collection') {
      return this.monthlyCollectionReport(tenantId, query);
    }
    if (type === 'yearly-collection') {
      return this.yearlyCollectionReport(tenantId, query);
    }
    if (type === 'fee-heads') {
      return this.feeHeadReport(tenantId, query);
    }
    if (type === 'payment-modes') {
      return this.paymentModeReport(tenantId, query);
    }
    if (type === 'admission-cycles') {
      return this.admissionCycleReport(tenantId, query);
    }
    if (type === 'monthly-status') {
      return this.monthlyStatusReport(tenantId, query);
    }
    if (type === 'scholarships') {
      return this.scholarshipReport(tenantId, query);
    }
    if (type === 'fines') {
      return this.fineReport(tenantId, query);
    }
    if (type === 'cash-book') {
      return this.cashBookReport(tenantId, query);
    }
    if (type === 'audit') {
      return this.auditReport(tenantId, query);
    }
    if (type === 'collections') {
      const payments = await this.db().paymentTransaction.findMany({
        where: { tenantId, ...dateWhere },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });
      return {
        type,
        total: payments.reduce(
          (sum: number, row: any) => sum + Number(row.amount ?? 0),
          0,
        ),
        rows: payments,
      };
    }
    if (type === 'outstanding' || type === 'defaulters') {
      const includeOrphans = Boolean(
        (query as { includeOrphans?: boolean }).includeOrphans,
      );
      const demands = await this.db().studentFeeDemand.findMany({
        where: {
          tenantId,
          balanceAmount: { gt: 0 },
          status: { notIn: ['CANCELLED', 'ROLLED_BACK'] },
          ...this.academicWhere(query),
        },
        orderBy: [{ balanceAmount: 'desc' }, { demandNo: 'asc' }],
        take: 5000,
      });
      const studentIds = this.uniqueStudentIds(demands);
      const studentMap = await this.loadStudents(tenantId, studentIds);
      if (type === 'defaulters') {
        const byStudent = new Map<string, Record<string, unknown>>();
        for (const d of demands) {
          const sid = String(d.studentId);
          const student = studentMap.get(sid);
          if (!includeOrphans && !student) continue;
          const existing = byStudent.get(sid) ?? {
            studentId: sid,
            studentName: this.studentDisplayName(student, sid),
            rollNumber: student?.rollNumber ?? '—',
            universityRollNumber: student?.universityRollNumber ?? '—',
            mobileNumber: student?.masterProfile?.mobileNumber ?? '—',
            programme: student?.programVersion?.program?.name ?? '—',
            amountDue: 0,
            monthsPending: 0,
            _missingStudent: !student,
          };
          const balance = Number(d.balanceAmount ?? 0);
          existing.amountDue = Number(existing.amountDue) + balance;
          if (d.demandType === 'MONTHLY_TUITION' && balance > 0) {
            existing.monthsPending = Number(existing.monthsPending) + 1;
          }
          byStudent.set(sid, existing);
        }
        const rows = Array.from(byStudent.values()).sort((a, b) => {
          const miss =
            Number(Boolean(a._missingStudent)) -
            Number(Boolean(b._missingStudent));
          if (miss !== 0) return miss;
          return Number(b.amountDue) - Number(a.amountDue);
        });
        return {
          type,
          total: rows.reduce(
            (s: number, r: { amountDue?: unknown }) => s + Number(r.amountDue),
            0,
          ),
          rows,
          meta: {
            includeOrphans,
            linkedStudents: rows.filter(
              (r: { _missingStudent?: boolean }) => !r._missingStudent,
            ).length,
            orphanStudents: rows.filter(
              (r: { _missingStudent?: boolean }) => r._missingStudent,
            ).length,
          },
        };
      }
      let rows = demands.map((d: { studentId?: unknown }) =>
        this.enrichDemandRow(d, studentMap.get(String(d.studentId ?? ''))),
      ) as Array<{
        _missingStudent?: boolean;
        balanceAmount?: number;
        [key: string]: unknown;
      }>;
      const orphanCount = rows.filter((r) => r._missingStudent).length;
      if (!includeOrphans) {
        rows = rows.filter((r) => !r._missingStudent);
      }
      rows = rows.sort((a, b) => {
        const miss =
          Number(Boolean(a._missingStudent)) -
          Number(Boolean(b._missingStudent));
        if (miss !== 0) return miss;
        return Number(b.balanceAmount) - Number(a.balanceAmount);
      });
      return {
        type,
        total: rows.reduce(
          (sum, row) => sum + Number(row.balanceAmount ?? 0),
          0,
        ),
        rows,
        meta: {
          includeOrphans,
          linkedDemands: rows.filter((r) => !r._missingStudent).length,
          orphanDemandsExcluded: includeOrphans ? 0 : orphanCount,
          orphanDemandsIncluded: includeOrphans ? orphanCount : 0,
        },
      };
    }
    if (type === 'reconciliation') {
      return this.reconciliation(tenantId, query);
    }
    if (type === 'cash-register') {
      return this.cashRegister(tenantId, query);
    }
    return this.dashboard(tenantId);
  }

  async reconciliation(tenantId: string, query: ReportsQueryDto) {
    const dateWhere = this.dateWhere(query);
    const [payments, pendingExternal] = await Promise.all([
      this.db().paymentTransaction.findMany({
        where: { tenantId, status: 'SUCCESS', ...dateWhere },
        orderBy: { paidAt: 'desc' },
        take: 2000,
      }),
      this.db().externalFeePayment.findMany({
        where: {
          tenantId,
          status: 'PENDING',
          ...this.externalDateWhere(query),
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
    ]);

    const bySource = (source: string) =>
      payments
        .filter((p: any) => (p.paymentSource ?? p.paymentMode) === source)
        .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

    const sourceTotals = {
      ERP_GATEWAY: bySource('ERP_GATEWAY') + bySource('ONLINE'),
      SBI_ICOLLECT: bySource('SBI_ICOLLECT'),
      BANK_TRANSFER: bySource('BANK_TRANSFER'),
      COLLEGE_QR: bySource('COLLEGE_QR'),
      OFFICE_QR: bySource('OFFICE_QR'),
      SCHOLARSHIP: bySource('SCHOLARSHIP'),
      ADJUSTMENT: bySource('ADJUSTMENT'),
      EXTERNAL: bySource('EXTERNAL'),
    };

    return {
      type: 'reconciliation',
      totals: sourceTotals,
      grandTotal: payments.reduce(
        (s: number, p: any) => s + Number(p.amount ?? 0),
        0,
      ),
      pendingVerification: {
        count: pendingExternal.length,
        amount: pendingExternal.reduce(
          (s: number, row: any) => s + Number(row.amount ?? 0),
          0,
        ),
        rows: pendingExternal.map((row: any) => ({
          ...row,
          amount: Number(row.amount),
          paymentSourceLabel:
            FEE_PAYMENT_SOURCE_LABELS[
              row.paymentSource as keyof typeof FEE_PAYMENT_SOURCE_LABELS
            ] ?? row.paymentSource,
        })),
      },
      rows: payments.map((p: any) => ({
        id: p.id,
        transactionNo: p.transactionNo,
        studentId: p.studentId,
        amount: Number(p.amount),
        paidAt: p.paidAt,
        paymentSource: p.paymentSource ?? p.paymentMode,
        paymentSourceLabel:
          FEE_PAYMENT_SOURCE_LABELS[
            (p.paymentSource ??
              p.paymentMode) as keyof typeof FEE_PAYMENT_SOURCE_LABELS
          ] ??
          p.paymentSource ??
          p.paymentMode,
        externalReference: p.externalReference,
        status: p.status,
      })),
    };
  }

  private async reconciliationKpis(tenantId: string) {
    const [payments, pendingCount] = await Promise.all([
      this.db().paymentTransaction.findMany({
        where: { tenantId, status: 'SUCCESS' },
        select: { amount: true, paymentSource: true, paymentMode: true },
        take: 5000,
      }),
      this.db().externalFeePayment.count({
        where: { tenantId, status: 'PENDING' },
      }),
    ]);

    const sum = (match: (p: any) => boolean) =>
      payments
        .filter(match)
        .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

    return {
      erpGatewayTotal: sum(
        (p) => p.paymentSource === 'ERP_GATEWAY' || p.paymentMode === 'ONLINE',
      ),
      sbiTotal: sum((p) => p.paymentSource === 'SBI_ICOLLECT'),
      bankTransferTotal: sum((p) => p.paymentSource === 'BANK_TRANSFER'),
      qrTotal: sum((p) =>
        ['COLLEGE_QR', 'OFFICE_QR'].includes(p.paymentSource),
      ),
      externalPendingVerification: pendingCount,
    };
  }

  private externalDateWhere(query: ReportsQueryDto) {
    const where: Record<string, unknown> = {};
    if (query.from || query.to) {
      where.transactionDate = {};
      if (query.from)
        (where.transactionDate as Record<string, Date>).gte = new Date(
          query.from,
        );
      if (query.to)
        (where.transactionDate as Record<string, Date>).lte = new Date(
          query.to,
        );
    }
    return where;
  }

  async cashRegister(tenantId: string, query: ReportsQueryDto) {
    const dateWhere = this.paidAtDateWhere(query);
    const payments = await this.db().paymentTransaction.findMany({
      where: {
        tenantId,
        status: 'SUCCESS',
        paymentMode: { in: ['CASH', 'CHEQUE', 'DD'] },
        ...dateWhere,
      },
      orderBy: { paidAt: 'desc' },
      take: 2000,
    });

    const studentIds = [
      ...new Set(payments.map((p: { studentId: string }) => p.studentId)),
    ];
    const students = studentIds.length
      ? await this.db().student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: {
            user: { select: { displayName: true } },
            masterProfile: { select: { fullName: true } },
          },
        })
      : [];
    const studentMap = new Map<string, any>(
      students.map((s: any) => [s.id, s]),
    );

    const collectorIds = [
      ...new Set(
        payments
          .map((p: { collectedById?: string }) => p.collectedById)
          .filter(Boolean),
      ),
    ];
    const collectors = collectorIds.length
      ? await this.db().user.findMany({
          where: { id: { in: collectorIds as string[] } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
    const collectorMap = new Map(
      collectors.map((u: any) => [u.id, u.displayName ?? u.email]),
    );

    const receiptIds = payments.map((p: { id: string }) => p.id);
    const receipts = await this.db().feeReceipt.findMany({
      where: { tenantId, paymentId: { in: receiptIds } },
      select: { paymentId: true, receiptNo: true },
    });
    const receiptMap = new Map(
      receipts.map((r: any) => [r.paymentId, r.receiptNo]),
    );

    const rows = payments.map((p: any) => {
      const student = studentMap.get(String(p.studentId ?? ''));
      return {
        date: p.paidAt ?? p.createdAt,
        receiptNo: receiptMap.get(p.id) ?? '—',
        transactionNo: p.transactionNo,
        studentId: p.studentId,
        studentName: this.studentDisplayName(
          student,
          String(p.studentId ?? ''),
        ),
        amount: Number(p.amount),
        paymentMode: p.paymentMode,
        collectedBy: p.collectedById
          ? String(collectorMap.get(p.collectedById) ?? 'Staff')
          : '—',
      };
    });

    const totalCollected = rows.reduce(
      (s: number, r: { amount: number }) => s + r.amount,
      0,
    );
    const cashTotal = rows
      .filter((r: { paymentMode: string }) => r.paymentMode === 'CASH')
      .reduce((s: number, r: { amount: number }) => s + r.amount, 0);

    return {
      type: 'cash-register',
      total: totalCollected,
      cashTotal,
      count: rows.length,
      rows,
    };
  }

  auditLogs(tenantId: string) {
    return this.db().feeAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  async exportReport(
    tenantId: string,
    type: string,
    query: ReportsQueryDto & { format?: string },
  ) {
    const report = await this.report(tenantId, type, query);
    const format = (query.format ?? 'json').toLowerCase();
    const rows = (report as { rows?: Record<string, unknown>[] }).rows ?? [];

    if (format === 'csv') {
      if (!rows.length)
        return { format: 'csv', content: '', filename: `${type}-report.csv` };
      const keys = Object.keys(rows[0]);
      const lines = [keys.join(',')];
      for (const row of rows) {
        lines.push(keys.map((k) => JSON.stringify(row[k] ?? '')).join(','));
      }
      return {
        format: 'csv',
        content: lines.join('\n'),
        filename: `${type}-report.csv`,
      };
    }

    if (format === 'xlsx' || format === 'excel') {
      const total = Number((report as { total?: number }).total ?? 0);
      const reportMeta = (report as { meta?: Record<string, unknown> }).meta;
      const built = await this.buildInstitutionalFeeExcel(
        type,
        rows,
        total,
        reportMeta,
      );
      return {
        format: 'xlsx',
        buffer: built.buffer,
        filename: built.filename,
      };
    }

    if (format === 'pdf') {
      const total = Number((report as { total?: number }).total ?? 0);
      const reportMeta = (report as { meta?: Record<string, unknown> }).meta;
      const buffer = await this.buildInstitutionalFeePdf(
        type,
        rows,
        total,
        reportMeta,
      );
      return { format: 'pdf', buffer, filename: `${type}-report.pdf` };
    }

    return { format: 'json', ...report };
  }

  async exportDayClosing(tenantId: string, dateStr?: string, format = 'json') {
    const report = await this.dayClosing(tenantId, dateStr);
    const fmt = format.toLowerCase();

    if (fmt === 'csv') {
      const header = [
        'Receipt',
        'Transaction',
        'Student',
        'Enrollment',
        'Mode',
        'Amount',
        'Time',
      ];
      const lines = [
        header.join(','),
        ...report.transactions.map(
          (t: {
            receiptNo?: string;
            transactionNo: string;
            studentName?: string;
            enrollmentNumber?: string;
            paymentMode: string;
            amount: number;
            paidAt?: string;
          }) =>
            [
              t.receiptNo ?? '',
              t.transactionNo,
              t.studentName ?? '',
              t.enrollmentNumber ?? '',
              t.paymentMode,
              String(t.amount),
              String(t.paidAt ?? ''),
            ]
              .map((c) => JSON.stringify(c))
              .join(','),
        ),
      ];
      return {
        format: 'csv',
        content: lines.join('\n'),
        filename: `day-closing-${report.date}.csv`,
      };
    }

    if (fmt === 'xlsx' || fmt === 'excel') {
      const rows = report.transactions.map(
        (t: {
          receiptNo?: string;
          transactionNo: string;
          studentName?: string;
          enrollmentNumber?: string;
          paymentMode: string;
          amount: number;
          paidAt?: string;
        }) => ({
          receiptNo: t.receiptNo,
          transactionNo: t.transactionNo,
          studentName: t.studentName,
          enrollmentNumber: t.enrollmentNumber,
          paymentMode: t.paymentMode,
          amount: t.amount,
          paidAt: t.paidAt,
        }),
      );
      const buffer = await this.buildExcelBuffer(
        `Day Closing ${report.date}`,
        rows,
      );
      return {
        format: 'xlsx',
        buffer,
        filename: `day-closing-${report.date}.xlsx`,
      };
    }

    if (fmt === 'pdf') {
      const buffer = await this.buildDayClosingPdf(report);
      return {
        format: 'pdf',
        buffer,
        filename: `day-closing-${report.date}.pdf`,
      };
    }

    return { format: 'json', ...report };
  }

  private async buildExcelBuffer(
    title: string,
    rows: Record<string, unknown>[],
  ) {
    const built = await this.buildInstitutionalFeeExcel(
      title
        .replace(/\s+report$/i, '')
        .replace(/\s+/g, '-')
        .toLowerCase() || 'fee',
      rows,
      0,
    );
    return built.buffer;
  }

  private feeReportTitle(type: string) {
    const titles: Record<string, string> = {
      outstanding: 'Outstanding Fee Report',
      defaulters: 'Fee Defaulters Report',
      'daily-collection': 'Daily Fee Collection',
      'monthly-collection': 'Monthly Fee Collection',
      'yearly-collection': 'Yearly Fee Collection',
      'cash-book': 'Cash Book',
      collections: 'Fee Collections',
      fines: 'Fine Report',
      scholarships: 'Scholarship Report',
      'fee-heads': 'Fee Heads Report',
      'payment-modes': 'Payment Modes Report',
      'admission-cycles': 'Admission Cycles Fee Report',
      'monthly-status': 'Monthly Fee Status',
      audit: 'Fee Audit Report',
    };
    return (
      titles[type] ??
      `${type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Report`
    );
  }

  /** Prefer human-readable columns; hide internal UUIDs / JSON blobs. */
  private feeExcelColumns(
    type: string,
    sample: Record<string, unknown> | undefined,
  ): InstitutionalReportColumn[] {
    const presets: Record<string, InstitutionalReportColumn[]> = {
      outstanding: [
        { key: 'demandNo', label: 'Demand No.' },
        { key: 'rollNumber', label: 'Roll No.' },
        { key: 'universityRollNumber', label: 'NEHU Roll No.' },
        { key: 'studentName', label: 'Student Name' },
        { key: 'programme', label: 'Programme' },
        { key: 'demandType', label: 'Demand Type' },
        { key: 'billingPeriod', label: 'Billing Period' },
        { key: 'status', label: 'Status' },
        { key: 'totalAmount', label: 'Total Amount', align: 'right' },
        { key: 'paidAmount', label: 'Paid', align: 'right' },
        { key: 'fineAmount', label: 'Fine', align: 'right' },
        { key: 'concessionAmount', label: 'Concession', align: 'right' },
        { key: 'balanceAmount', label: 'Balance Due', align: 'right' },
        { key: 'dueDate', label: 'Due Date' },
        { key: 'mobileNumber', label: 'Mobile' },
      ],
      defaulters: [
        { key: 'rollNumber', label: 'Roll No.' },
        { key: 'universityRollNumber', label: 'NEHU Roll No.' },
        { key: 'studentName', label: 'Student Name' },
        { key: 'programme', label: 'Programme' },
        { key: 'mobileNumber', label: 'Mobile' },
        { key: 'amountDue', label: 'Amount Due', align: 'right' },
        { key: 'monthsPending', label: 'Months Pending', align: 'center' },
      ],
      'daily-collection': [
        { key: 'receiptNo', label: 'Receipt No.' },
        { key: 'dateTime', label: 'Date & Time' },
        { key: 'studentName', label: 'Student' },
        { key: 'rollNumber', label: 'Admission / Roll No.' },
        { key: 'programme', label: 'Programme' },
        { key: 'semester', label: 'Sem', align: 'center' },
        { key: 'feeCategory', label: 'Fee Category' },
        { key: 'mode', label: 'Payment Mode' },
        { key: 'amount', label: 'Amount', align: 'right' },
        { key: 'collectedBy', label: 'Collected By' },
      ],
    };
    if (presets[type]) return presets[type];

    const hidden = new Set([
      'id',
      'tenantId',
      'studentId',
      'feeStructureId',
      'feeCycleId',
      'academicYearId',
      'semesterId',
      'monthlyFeePlanId',
      'generatedBy',
      'metadata',
      'deletedAt',
      'createdAt',
      'updatedAt',
      'feeProductCode',
      'billingLayer',
    ]);
    const keys = sample
      ? Object.keys(sample).filter(
          (k) =>
            !hidden.has(k) &&
            !k.toLowerCase().endsWith('id') &&
            typeof sample[k] !== 'object',
        )
      : ['value'];
    return keys.map((key) => ({
      key,
      label: key
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      align: /amount|total|paid|balance|fine|due|count/i.test(key)
        ? ('right' as const)
        : undefined,
    }));
  }

  private formatFeeExcelCell(key: string, value: unknown) {
    if (value == null || value === '') return '—';
    if (
      /amount|total|paid|balance|fine|concession|due/i.test(key) &&
      value !== '—'
    ) {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    if (
      value instanceof Date ||
      ((/at$/i.test(key) || /date/i.test(key)) &&
        typeof value === 'string' &&
        /^\d{4}-\d{2}/.test(value))
    ) {
      const d = value instanceof Date ? value : new Date(String(value));
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  private async buildInstitutionalFeeExcel(
    type: string,
    rows: Record<string, unknown>[],
    total: number,
    reportMeta?: Record<string, unknown>,
  ) {
    const title = this.feeReportTitle(type);
    const columns = this.feeExcelColumns(type, rows[0]);
    const missingStudents = rows.filter((r) => r._missingStudent).length;
    const linkedStudents = rows.length - missingStudents;
    const excluded = Number(reportMeta?.orphanDemandsExcluded ?? 0);
    const displayRows = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const col of columns) {
        out[col.key] = this.formatFeeExcelCell(col.key, row[col.key]);
      }
      return out;
    });

    return buildInstitutionalExcelReport({
      meta: {
        institutionName: 'Don Bosco College, Tura',
        institutionTagline: 'Affiliated to NEHU | NAAC Accredited | Meghalaya',
        productName: 'BCL OneCampus ERP',
        reportTitle: title,
        reportIcon: '₹',
        summary: {
          Records: displayRows.length,
          'With student details': linkedStudents,
          ...(missingStudents > 0
            ? { 'Missing student record': missingStudents }
            : {}),
          ...(excluded > 0 ? { 'Orphan demands excluded': excluded } : {}),
          'Total Outstanding / Amount': `₹${Number(total || 0).toLocaleString('en-IN')}`,
        },
        filterLines: [
          { label: 'Report type', value: type },
          { label: 'Currency', value: 'INR' },
          {
            label: 'Accuracy',
            value:
              excluded > 0
                ? `Excludes ${excluded} orphan demand(s) (no student record)`
                : missingStudents > 0
                  ? `Includes ${missingStudents} orphan demand(s)`
                  : 'Linked students only',
          },
        ],
      },
      sheets: [
        {
          name: 'Fee Report',
          columns,
          rows: displayRows.length
            ? displayRows
            : [
                Object.fromEntries(
                  columns.map((c, i) => [c.key, i === 0 ? 'No records' : '—']),
                ),
              ],
        },
      ],
      filenameBase: `${type}-report`,
    });
  }

  private escapeHtml(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatPdfColumnLabel(key: string) {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private formatInrPdf(amount: number) {
    return `₹${Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  private formatDateLong(value: unknown) {
    const d = value instanceof Date ? value : new Date(String(value ?? ''));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private formatDateTimePdf(value: unknown) {
    const d = value instanceof Date ? value : new Date(String(value ?? ''));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private async buildInstitutionalFeePdf(
    type: string,
    rows: Record<string, unknown>[],
    total: number,
    reportMeta?: Record<string, unknown>,
  ) {
    const title = this.feeReportTitle(type);
    const generatedAt = new Date();
    const reportId = `${type.toUpperCase()}-${generatedAt
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')}-${String(rows.length).padStart(4, '0')}`;
    const verifyPayload = Buffer.from(
      JSON.stringify({
        reportId,
        type,
        total,
        generatedAt: generatedAt.toISOString(),
        institution: 'DBC-TURA',
      }),
    ).toString('base64url');
    const verifyUrl = `https://erp.donboscocollege.ac.in/verify/fee-report?t=${verifyPayload}`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=88x88&data=${encodeURIComponent(verifyUrl)}`;

    const modeSummary =
      (reportMeta?.modeSummary as Array<{
        mode: string;
        count: number;
        amount: number;
      }>) ?? [];
    const txnCount = Number(reportMeta?.transactionCount ?? rows.length);
    const onlineCount = Number(reportMeta?.onlineCount ?? 0);
    const offlineCount = Number(reportMeta?.offlineCount ?? 0);
    const refunds = Number(reportMeta?.refunds ?? 0);
    const filters = (reportMeta?.filters ?? {}) as {
      from?: string | null;
      to?: string | null;
    };

    const isCollection =
      type === 'daily-collection' ||
      type === 'collections' ||
      type === 'monthly-collection';

    let tableBody = '';
    if (isCollection && rows.some((r) => r.date || r.dateTime)) {
      const byDate = new Map<string, Record<string, unknown>[]>();
      for (const row of rows) {
        const key = String(row.date ?? String(row.dateTime).slice(0, 10));
        const list = byDate.get(key) ?? [];
        list.push(row);
        byDate.set(key, list);
      }
      const sortedDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
      let serial = 1;
      for (const dateKey of sortedDates) {
        const dayRows = byDate.get(dateKey) ?? [];
        const subtotal = dayRows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
        tableBody += `<tr class="date-group"><td colspan="10">${this.escapeHtml(this.formatDateLong(dateKey))}</td></tr>`;
        for (const row of dayRows) {
          tableBody += `<tr>
            <td class="c">${serial++}</td>
            <td>${this.escapeHtml(row.receiptNo)}</td>
            <td>${this.escapeHtml(this.formatDateTimePdf(row.dateTime ?? row.date))}</td>
            <td>${this.escapeHtml(row.studentName)}</td>
            <td>${this.escapeHtml(row.rollNumber ?? row.enrollmentNumber)}</td>
            <td>${this.escapeHtml(row.programme ?? '—')}</td>
            <td class="c">${this.escapeHtml(row.semester ?? '—')}</td>
            <td>${this.escapeHtml(row.feeCategory ?? 'Fee Payment')}</td>
            <td>${this.escapeHtml(row.mode)}</td>
            <td class="num">${this.escapeHtml(this.formatInrPdf(Number(row.amount ?? 0)))}</td>
          </tr>`;
        }
        tableBody += `<tr class="subtotal"><td colspan="9">Subtotal — ${this.escapeHtml(this.formatDateLong(dateKey))}</td><td class="num">${this.escapeHtml(this.formatInrPdf(subtotal))}</td></tr>`;
      }
    } else {
      const columns = this.feeExcelColumns(type, rows[0]);
      tableBody = rows
        .slice(0, 500)
        .map((row, i) => {
          const cells = columns
            .map((col) => {
              const raw = this.formatFeeExcelCell(col.key, row[col.key]);
              const isMoney = /amount|total|paid|balance|fine|due/i.test(
                col.key,
              );
              const display =
                isMoney && typeof raw === 'number'
                  ? this.formatInrPdf(raw)
                  : String(raw ?? '—');
              return `<td class="${isMoney ? 'num' : ''}">${this.escapeHtml(display)}</td>`;
            })
            .join('');
          return `<tr><td class="c">${i + 1}</td>${cells}</tr>`;
        })
        .join('');
    }

    const collectionHead = `<tr>
      <th>Sl.</th><th>Receipt No.</th><th>Date &amp; Time</th><th>Student</th>
      <th>Admission / Roll No.</th><th>Programme</th><th>Sem</th>
      <th>Fee Category</th><th>Payment Mode</th><th>Amount</th>
    </tr>`;
    const genericHead = `<tr><th>Sl.</th>${this.feeExcelColumns(type, rows[0])
      .map((c) => `<th>${this.escapeHtml(c.label)}</th>`)
      .join('')}</tr>`;

    const modeSummaryHtml =
      modeSummary.length > 0
        ? modeSummary
            .map(
              (m) =>
                `<tr><td>${this.escapeHtml(m.mode)}</td><td class="c">${m.count}</td><td class="num">${this.escapeHtml(this.formatInrPdf(m.amount))}</td></tr>`,
            )
            .join('')
        : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 14mm 12mm 18mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    color: #0f172a;
    font-size: 10px;
    margin: 0;
    position: relative;
  }
  body::before {
    content: "DON BOSCO COLLEGE  ·  BCL OneCampus ERP";
    position: fixed;
    top: 42%;
    left: 8%;
    width: 84%;
    text-align: center;
    font-size: 34px;
    font-weight: 700;
    color: rgba(30, 58, 138, 0.06);
    transform: rotate(-24deg);
    z-index: 0;
    pointer-events: none;
  }
  .page { position: relative; z-index: 1; }
  .header { text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px; }
  .college { font-size: 18px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.04em; }
  .tagline { font-size: 10px; color: #475569; margin-top: 2px; }
  .product { font-size: 11px; font-weight: 700; color: #1e3a8a; margin-top: 6px; }
  .report-title { font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 6px; text-transform: uppercase; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-top: 10px; text-align: left; font-size: 10px; color: #334155; }
  .meta-grid strong { color: #0f172a; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
  .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
  .card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; font-weight: 700; }
  .card .value { font-size: 14px; font-weight: 800; color: #1e3a8a; margin-top: 2px; }
  .filters { margin: 8px 0 12px; padding: 8px 10px; background: #f1f5f9; border-radius: 6px; font-size: 9px; color: #475569; }
  .filters strong { color: #0f172a; }
  table.data { width: 100%; border-collapse: collapse; font-size: 9px; }
  table.data th {
    background: #1e3a8a;
    color: #fff;
    padding: 6px 5px;
    text-align: left;
    font-weight: 700;
  }
  table.data td { padding: 5px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  table.data tr:nth-child(even):not(.date-group):not(.subtotal) td { background: #f8fafc; }
  table.data .date-group td {
    background: #dbeafe !important;
    color: #1e3a8a;
    font-weight: 800;
    padding-top: 8px;
    border-top: 1px solid #93c5fd;
  }
  table.data .subtotal td {
    background: #f1f5f9 !important;
    font-weight: 700;
    border-top: 1px solid #cbd5e1;
  }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .c { text-align: center; }
  .totals {
    margin-top: 10px;
    border-top: 2px solid #1e3a8a;
    padding-top: 8px;
    display: flex;
    justify-content: flex-end;
    gap: 24px;
    font-size: 11px;
    font-weight: 700;
  }
  .summary-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }
  .summary-box h3 { margin: 0 0 6px; font-size: 11px; color: #1e3a8a; }
  .summary-box table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .summary-box th, .summary-box td { border: 1px solid #e2e8f0; padding: 4px 6px; }
  .summary-box th { background: #eff6ff; text-align: left; }
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 28px;
    text-align: center;
    font-size: 10px;
  }
  .signatures .line { border-top: 1px solid #334155; margin: 28px 16px 6px; }
  .footer-bar {
    margin-top: 18px;
    border-top: 1px solid #cbd5e1;
    padding-top: 8px;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 12px;
    align-items: center;
    font-size: 8px;
    color: #64748b;
  }
  .footer-bar .center { text-align: center; }
  .footer-bar .right { text-align: right; }
  .verify { display: flex; align-items: center; gap: 8px; }
  .verify img { width: 72px; height: 72px; border: 1px solid #e2e8f0; }
  .confidential { font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.06em; }
</style></head>
<body>
<div class="page">
  <div class="header">
    <div class="college">DON BOSCO COLLEGE, TURA</div>
    <div class="tagline">Affiliated to NEHU · NAAC Accredited · Meghalaya</div>
    <div class="product">BCL OneCampus ERP</div>
    <div class="report-title">${this.escapeHtml(title)}</div>
    <div class="meta-grid">
      <div><strong>Report ID:</strong> ${this.escapeHtml(reportId)}</div>
      <div><strong>Generated On:</strong> ${this.escapeHtml(this.formatDateTimePdf(generatedAt))}</div>
      <div><strong>Report Period:</strong> ${this.escapeHtml(
        filters.from || filters.to
          ? `${filters.from ?? '—'} to ${filters.to ?? '—'}`
          : 'All available payments',
      )}</div>
      <div><strong>Generated By:</strong> System Administrator</div>
      <div><strong>Currency:</strong> INR</div>
      <div><strong>Status:</strong> Paid / Successful only</div>
    </div>
  </div>

  <div class="cards">
    <div class="card"><div class="label">Total Collection</div><div class="value">${this.escapeHtml(this.formatInrPdf(total))}</div></div>
    <div class="card"><div class="label">Total Transactions</div><div class="value">${txnCount}</div></div>
    <div class="card"><div class="label">Online Payments</div><div class="value">${onlineCount}</div></div>
    <div class="card"><div class="label">Offline / Cash</div><div class="value">${offlineCount}</div></div>
  </div>

  <div class="filters">
    <strong>Filters applied:</strong>
    Date range: ${this.escapeHtml(filters.from ?? 'All')} – ${this.escapeHtml(filters.to ?? 'All')}
    · Payment mode: All · Department: All · Programme: All · Status: Paid
    · Refunds: ${refunds}
  </div>

  <table class="data">
    <thead>${isCollection ? collectionHead : genericHead}</thead>
    <tbody>
      ${tableBody || '<tr><td colspan="10">No records</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div>Total Transactions: ${txnCount}</div>
    <div>Grand Total: ${this.escapeHtml(this.formatInrPdf(total))}</div>
  </div>

  ${
    modeSummaryHtml
      ? `<div class="summary-wrap">
    <div class="summary-box">
      <h3>Payment Mode Summary</h3>
      <table>
        <thead><tr><th>Mode</th><th>Count</th><th>Amount</th></tr></thead>
        <tbody>${modeSummaryHtml}
        <tr><th>Grand Total</th><th class="c">${txnCount}</th><th class="num">${this.escapeHtml(this.formatInrPdf(total))}</th></tr>
        </tbody>
      </table>
    </div>
    <div class="summary-box">
      <h3>Collection Snapshot</h3>
      <table>
        <tbody>
          <tr><td>Online payments</td><td class="num">${onlineCount}</td></tr>
          <tr><td>Offline / cash payments</td><td class="num">${offlineCount}</td></tr>
          <tr><td>Refunds</td><td class="num">${refunds}</td></tr>
          <tr><td><strong>Net collection</strong></td><td class="num"><strong>${this.escapeHtml(this.formatInrPdf(total))}</strong></td></tr>
        </tbody>
      </table>
    </div>
  </div>`
      : ''
  }

  <div class="signatures">
    <div><div class="line"></div>Prepared By</div>
    <div><div class="line"></div>Verified By</div>
    <div><div class="line"></div>Bursar / Accounts Officer</div>
  </div>

  <div class="footer-bar">
    <div class="verify">
      <img src="${qrImg}" alt="Verify report"/>
      <div>
        <div><strong>Scan to verify report</strong></div>
        <div>ID: ${this.escapeHtml(reportId)}</div>
      </div>
    </div>
    <div class="center">
      <div class="confidential">Confidential</div>
      <div>Generated by BCL OneCampus ERP · Powered by BaseCode Labs</div>
    </div>
    <div class="right">
      <div>${this.escapeHtml(this.formatDateTimePdf(generatedAt))}</div>
      <div>Page 1</div>
    </div>
  </div>
</div>
</body></html>`;

    return this.htmlToPdf(html);
  }

  private async buildPdfBuffer(
    title: string,
    rows: Record<string, unknown>[],
    summary?: string,
  ) {
    return this.buildInstitutionalFeePdf(
      title
        .replace(/\s+report$/i, '')
        .replace(/\s+/g, '-')
        .toLowerCase() || 'fee',
      rows,
      Number(
        String(summary ?? '')
          .replace(/[^\d.]/g, '')
          .replace(/^$/, '0'),
      ),
    );
  }

  private async buildDayClosingPdf(
    report: Awaited<ReturnType<FeeReportsService['dayClosing']>>,
  ) {
    const { summary, byPaymentMode, transactions, date } = report;
    const modeRows = byPaymentMode
      .map(
        (m) =>
          `<tr><td>${m.mode}</td><td>${m.count}</td><td>₹${m.amount.toLocaleString('en-IN')}</td></tr>`,
      )
      .join('');
    const txnRows = transactions
      .map(
        (t: {
          receiptNo?: string;
          studentName?: string;
          enrollmentNumber?: string;
          paymentMode: string;
          amount: number;
        }) =>
          `<tr><td>${t.receiptNo ?? '—'}</td><td>${t.studentName ?? '—'}</td><td>${t.enrollmentNumber ?? '—'}</td><td>${t.paymentMode}</td><td>₹${Number(t.amount).toLocaleString('en-IN')}</td></tr>`,
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body{font-family:Arial,sans-serif;padding:24px;font-size:12px}
      h1{font-size:20px} .kpi{display:inline-block;margin-right:24px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ccc;padding:6px} th{background:#f3f4f6}
    </style></head><body>
      <h1>Day Closing Report — ${date}</h1>
      <div class="kpi"><strong>Total Collected:</strong> ₹${summary.totalCollected.toLocaleString('en-IN')}</div>
      <div class="kpi"><strong>Transactions:</strong> ${summary.transactionCount}</div>
      <div class="kpi"><strong>Receipts:</strong> ${summary.receiptCount}</div>
      <h2>By Payment Mode</h2>
      <table><thead><tr><th>Mode</th><th>Count</th><th>Amount</th></tr></thead><tbody>${modeRows}</tbody></table>
      <h2>Transactions</h2>
      <table><thead><tr><th>Receipt</th><th>Student</th><th>Enrollment</th><th>Mode</th><th>Amount</th></tr></thead><tbody>${txnRows}</tbody></table>
    </body></html>`;
    return this.htmlToPdf(html);
  }

  async recentReceipts(
    tenantId: string,
    opts?: { limit?: number; date?: string },
  ) {
    const limit = Math.min(opts?.limit ?? 50, 200);
    const where: Record<string, unknown> = {
      tenantId,
      status: { not: 'CANCELLED' },
    };

    if (opts?.date) {
      const day = new Date(opts.date);
      if (!Number.isNaN(day.getTime())) {
        day.setHours(0, 0, 0, 0);
        const nextDay = new Date(day);
        nextDay.setDate(nextDay.getDate() + 1);
        where.issuedAt = { gte: day, lt: nextDay };
      }
    }

    const receipts = await this.db().feeReceipt.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        receiptNo: true,
        amount: true,
        issuedAt: true,
        studentId: true,
        status: true,
      },
    });

    const studentIds = [
      ...new Set(receipts.map((r: { studentId: string }) => r.studentId)),
    ];
    const students = studentIds.length
      ? await this.db().student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: {
            user: { select: { displayName: true } },
            masterProfile: { select: { fullName: true } },
          },
        })
      : [];
    const studentMap = new Map(
      students.map((s: Record<string, unknown>) => [String(s.id), s]),
    );

    return receipts.map((r: Record<string, unknown>) => {
      const student = studentMap.get(String(r.studentId ?? '')) as
        | {
            enrollmentNumber?: string;
            user?: { displayName?: string };
            masterProfile?: { fullName?: string };
          }
        | undefined;
      return {
        id: String(r.id),
        receiptNo: String(r.receiptNo),
        amount: Number(r.amount ?? 0),
        issuedAt: (r.issuedAt as Date).toISOString(),
        status: String(r.status ?? 'ISSUED'),
        studentName:
          student?.masterProfile?.fullName ??
          student?.user?.displayName ??
          'Student',
        enrollmentNumber: student?.enrollmentNumber ?? null,
      };
    });
  }

  private async htmlToPdf(html: string) {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '12mm', bottom: '20mm', left: '12mm' },
      });
      const buffer = Buffer.from(pdf);
      if (buffer.length < 500) {
        throw new Error('PDF generation produced an empty document');
      }
      return buffer;
    } finally {
      await browser.close();
    }
  }

  async dayClosing(tenantId: string, dateStr?: string) {
    const day = dateStr ? new Date(dateStr) : new Date();
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const [payments, receipts, outstandingAgg] = await Promise.all([
      this.db().paymentTransaction.findMany({
        where: {
          tenantId,
          status: 'SUCCESS',
          paidAt: { gte: day, lt: nextDay },
        },
        include: {
          receipts: { take: 1 },
          allocations: {
            include: { demand: { select: { demandType: true } } },
          },
        },
        orderBy: { paidAt: 'asc' },
      }),
      this.db().feeReceipt.findMany({
        where: { tenantId, issuedAt: { gte: day, lt: nextDay } },
      }),
      this.db().studentFeeDemand.aggregate({
        where: { tenantId, balanceAmount: { gt: 0 } },
        _sum: { balanceAmount: true },
      }),
    ]);

    const studentIds = [
      ...new Set(payments.map((p: { studentId: string }) => p.studentId)),
    ];
    const students = studentIds.length
      ? await this.db().student.findMany({
          where: { tenantId, id: { in: studentIds } },
          include: {
            user: { select: { displayName: true } },
            masterProfile: { select: { fullName: true } },
          },
        })
      : [];
    const studentMap = new Map(students.map((s: any) => [s.id, s]));

    const cashierIds = [
      ...new Set(
        payments
          .map((p: { collectedById?: string }) => p.collectedById)
          .filter(Boolean),
      ),
    ];
    const cashiers = cashierIds.length
      ? await this.db().user.findMany({
          where: { id: { in: cashierIds as string[] } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
    const cashierMap = new Map(
      cashiers.map((u: any) => [u.id, u.displayName ?? u.email ?? 'Cashier']),
    );

    const byMode = new Map<string, { count: number; amount: number }>();
    const byCashier = new Map<
      string,
      {
        cashierId: string | null;
        cashierName: string;
        count: number;
        amount: number;
      }
    >();
    let admissionCollected = 0;
    let monthlyCollected = 0;

    for (const payment of payments) {
      const amt = Number(payment.amount);
      const mode = String(payment.paymentMode ?? 'OTHER');
      const modeRow = byMode.get(mode) ?? { count: 0, amount: 0 };
      modeRow.count += 1;
      modeRow.amount += amt;
      byMode.set(mode, modeRow);

      const cashierKey = payment.collectedById ?? 'unassigned';
      const cashierRow = byCashier.get(cashierKey) ?? {
        cashierId: payment.collectedById ?? null,
        cashierName: payment.collectedById
          ? String(cashierMap.get(payment.collectedById) ?? 'Cashier')
          : 'Online / System',
        count: 0,
        amount: 0,
      };
      cashierRow.count += 1;
      cashierRow.amount += amt;
      byCashier.set(cashierKey, cashierRow);

      for (const alloc of payment.allocations ?? []) {
        const type = alloc.demand?.demandType;
        const a = Number(alloc.amount ?? 0);
        if (type === 'ADMISSION_SESSION') admissionCollected += a;
        if (type === 'MONTHLY_TUITION') monthlyCollected += a;
      }
    }

    const transactions = payments.map((p: Record<string, unknown>) => {
      const student = studentMap.get(String(p.studentId ?? ''));
      return {
        id: p.id,
        transactionNo: p.transactionNo,
        studentId: p.studentId,
        studentName: this.studentDisplayName(
          student as {
            masterProfile?: { fullName?: string | null };
            user?: { displayName?: string | null };
          },
          String(p.studentId ?? ''),
        ),
        enrollmentNumber: (student as { enrollmentNumber?: string })
          ?.enrollmentNumber,
        paymentMode: p.paymentMode,
        amount: Number(p.amount),
        paidAt: p.paidAt,
        receiptNo: (p.receipts as Array<{ receiptNo: string }> | undefined)?.[0]
          ?.receiptNo,
      };
    });

    const totalCollected = payments.reduce(
      (s: number, p: { amount: unknown }) => s + Number(p.amount),
      0,
    );

    return {
      date: day.toISOString().slice(0, 10),
      summary: {
        totalCollected,
        transactionCount: payments.length,
        receiptCount: receipts.length,
        admissionCollected,
        monthlyCollected,
        outstandingEndOfDay: Number(outstandingAgg._sum?.balanceAmount ?? 0),
      },
      byPaymentMode: Array.from(byMode.entries()).map(([mode, row]) => ({
        mode,
        ...row,
      })),
      byCashier: Array.from(byCashier.values()).sort(
        (a, b) => b.amount - a.amount,
      ),
      transactions,
    };
  }

  private studentDisplayName(
    student:
      | {
          masterProfile?: { fullName?: string | null } | null;
          user?: { displayName?: string | null } | null;
        }
      | null
      | undefined,
    studentId?: string,
  ) {
    const name =
      student?.masterProfile?.fullName?.trim() ||
      student?.user?.displayName?.trim() ||
      '';
    if (name) return name;
    if (studentId) {
      return `Missing student record (${String(studentId).slice(0, 8)}…)`;
    }
    return 'Unknown student';
  }

  /** Explicit display fields only — never spread raw demand (avoids UUID noise). */
  private enrichDemandRow(demand: any, student?: any) {
    const studentId = String(demand.studentId ?? '');
    return {
      demandNo: demand.demandNo ?? '—',
      rollNumber: student?.rollNumber ?? null,
      universityRollNumber: student?.universityRollNumber ?? null,
      studentName: this.studentDisplayName(student, studentId),
      programme: student?.programVersion?.program?.name ?? null,
      demandType: demand.demandType ?? '—',
      billingPeriod: demand.billingPeriod ?? '—',
      status: demand.status ?? '—',
      totalAmount: Number(demand.totalAmount ?? 0),
      paidAmount: Number(demand.paidAmount ?? 0),
      fineAmount: Number(demand.fineAmount ?? 0),
      concessionAmount: Number(demand.concessionAmount ?? 0),
      balanceAmount: Number(demand.balanceAmount ?? 0),
      dueDate: demand.dueDate ?? null,
      mobileNumber: student?.masterProfile?.mobileNumber ?? null,
      amountDue: Number(demand.balanceAmount ?? 0),
      _missingStudent: !student,
    };
  }

  private uniqueStudentIds(rows: Array<{ studentId?: unknown }>): string[] {
    return [
      ...new Set(
        rows
          .map((r) => (r.studentId == null ? '' : String(r.studentId)))
          .filter((id) => id.length > 0),
      ),
    ];
  }

  private async loadStudents(tenantId: string, studentIds: string[]) {
    if (!studentIds.length) return new Map<string, any>();
    const ids = [...new Set(studentIds.map((id) => String(id)))];
    const map = new Map<string, any>();
    const chunkSize = 400;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const students = await this.prisma.student.findMany({
        where: {
          tenantId,
          id: { in: chunk },
        },
        include: {
          user: { select: { displayName: true } },
          masterProfile: { select: { fullName: true, mobileNumber: true } },
          programVersion: {
            include: { program: { select: { name: true, code: true } } },
          },
          primaryShift: { select: { name: true, code: true } },
          academicStanding: {
            select: { currentSemesterSequence: true },
          },
        },
      });
      for (const student of students) {
        map.set(String(student.id), student);
      }
    }
    return map;
  }

  private async dailyCollectionReport(
    tenantId: string,
    query: ReportsQueryDto,
  ) {
    const payments = await this.db().paymentTransaction.findMany({
      where: { tenantId, status: 'SUCCESS', ...this.paidAtDateWhere(query) },
      orderBy: { paidAt: 'desc' },
      take: 2000,
      include: {
        allocations: {
          include: {
            demand: { select: { demandType: true } },
          },
          take: 3,
        },
      },
    });
    const studentMap = await this.loadStudents(
      tenantId,
      this.uniqueStudentIds(payments),
    );
    const receiptIds = payments.map((p: any) => p.id);
    const receipts = receiptIds.length
      ? await this.db().feeReceipt.findMany({
          where: { tenantId, paymentId: { in: receiptIds } },
          select: { paymentId: true, receiptNo: true },
        })
      : [];
    const receiptMap = new Map(
      receipts.map((r: any) => [r.paymentId, r.receiptNo]),
    );
    const collectorIds = [
      ...new Set(payments.map((p: any) => p.collectedById).filter(Boolean)),
    ];
    const collectors = collectorIds.length
      ? await this.db().user.findMany({
          where: { id: { in: collectorIds as string[] } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
    const collectorMap = new Map(
      collectors.map((u: any) => [u.id, u.displayName ?? u.email]),
    );

    const rows = payments.map((p: any) => {
      const student = studentMap.get(String(p.studentId ?? ''));
      const paidAt = p.paidAt ?? p.createdAt;
      const demandTypes = (p.allocations ?? [])
        .map((a: { demand?: { demandType?: string } }) => a.demand?.demandType)
        .filter(Boolean);
      const feeCategory =
        demandTypes.length > 0
          ? [...new Set(demandTypes)]
              .map((t) => String(t).replace(/_/g, ' '))
              .join(', ')
          : 'Fee Payment';
      const modeLabel =
        FEE_PAYMENT_SOURCE_LABELS[
          (p.paymentSource ??
            p.paymentMode) as keyof typeof FEE_PAYMENT_SOURCE_LABELS
        ] ??
        p.paymentSource ??
        p.paymentMode;
      return {
        date: String(paidAt).slice(0, 10),
        dateTime: paidAt,
        receiptNo: receiptMap.get(p.id) ?? '—',
        transactionNo: p.transactionNo,
        studentName: this.studentDisplayName(
          student,
          String(p.studentId ?? ''),
        ),
        rollNumber: student?.rollNumber ?? student?.enrollmentNumber ?? '—',
        enrollmentNumber: student?.enrollmentNumber ?? '—',
        programme: student?.programVersion?.program?.name ?? '—',
        semester: student?.academicStanding?.currentSemesterSequence ?? '—',
        feeCategory,
        amount: Number(p.amount ?? 0),
        mode: modeLabel,
        paymentModeRaw: String(p.paymentMode ?? p.paymentSource ?? ''),
        collectedBy: p.collectedById
          ? String(collectorMap.get(p.collectedById) ?? 'Staff')
          : '—',
      };
    });

    const modeSummary = new Map<string, { count: number; amount: number }>();
    let onlineCount = 0;
    let offlineCount = 0;
    for (const row of rows) {
      const mode = String(row.mode ?? 'Other');
      const bucket = modeSummary.get(mode) ?? { count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += row.amount;
      modeSummary.set(mode, bucket);
      if (/cash|offline/i.test(String(row.paymentModeRaw))) offlineCount += 1;
      else onlineCount += 1;
    }

    return {
      type: 'daily-collection',
      total: rows.reduce((s: number, r: { amount: number }) => s + r.amount, 0),
      rows,
      meta: {
        transactionCount: rows.length,
        onlineCount,
        offlineCount,
        refunds: 0,
        modeSummary: Array.from(modeSummary.entries()).map(([mode, v]) => ({
          mode,
          ...v,
        })),
        filters: {
          from: query.from ?? null,
          to: query.to ?? null,
        },
      },
    };
  }

  private async monthlyCollectionReport(
    tenantId: string,
    query: ReportsQueryDto,
  ) {
    const payments = await this.db().paymentTransaction.findMany({
      where: { tenantId, status: 'SUCCESS', ...this.paidAtDateWhere(query) },
      include: {
        allocations: {
          include: {
            demand: { select: { demandType: true, fineAmount: true } },
          },
        },
      },
      take: 5000,
    });
    const buckets = new Map<
      string,
      {
        month: string;
        admission: number;
        monthly: number;
        fine: number;
        other: number;
        total: number;
      }
    >();
    for (const payment of payments) {
      const key = String(payment.paidAt ?? payment.createdAt).slice(0, 7);
      const bucket = buckets.get(key) ?? {
        month: key,
        admission: 0,
        monthly: 0,
        fine: 0,
        other: 0,
        total: 0,
      };
      const amount = Number(payment.amount ?? 0);
      bucket.total += amount;
      const allocs = payment.allocations as Array<{
        amount: unknown;
        demand?: { demandType?: string };
      }>;
      if (allocs?.length) {
        for (const alloc of allocs) {
          const a = Number(alloc.amount ?? 0);
          const type = alloc.demand?.demandType;
          if (type === 'ADMISSION_SESSION') bucket.admission += a;
          else if (type === 'MONTHLY_TUITION') bucket.monthly += a;
          else bucket.other += a;
        }
      } else {
        bucket.other += amount;
      }
      buckets.set(key, bucket);
    }
    const rows = Array.from(buckets.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
    return {
      type: 'monthly-collection',
      total: rows.reduce((s, r) => s + r.total, 0),
      rows,
    };
  }

  private async yearlyCollectionReport(
    tenantId: string,
    query: ReportsQueryDto,
  ) {
    const demands = await this.db().studentFeeDemand.findMany({
      where: { tenantId, ...this.academicWhere(query) },
      take: 10000,
    });
    const totalDemand = demands.reduce(
      (s: number, d: any) => s + Number(d.totalAmount ?? 0),
      0,
    );
    const collected = demands.reduce(
      (s: number, d: any) => s + Number(d.paidAmount ?? 0),
      0,
    );
    const outstanding = demands.reduce(
      (s: number, d: any) => s + Number(d.balanceAmount ?? 0),
      0,
    );
    const collectionPct =
      totalDemand > 0 ? Math.round((collected / totalDemand) * 1000) / 10 : 0;
    return {
      type: 'yearly-collection',
      total: collected,
      rows: [
        {
          academicYear: query.academicYearId ?? 'All',
          totalDemand,
          collected,
          outstanding,
          collectionPct: `${collectionPct}%`,
        },
      ],
      summary: { totalDemand, collected, outstanding, collectionPct },
    };
  }

  private async feeHeadReport(tenantId: string, query: ReportsQueryDto) {
    const lines = await this.db().studentFeeDemandLine.findMany({
      where: { demand: { tenantId, ...this.academicWhere(query) } },
      include: {
        demand: {
          select: { paidAmount: true, totalAmount: true, balanceAmount: true },
        },
      },
      take: 20000,
    });
    const byHead = new Map<
      string,
      {
        feeHead: string;
        code: string;
        demanded: number;
        collected: number;
        outstanding: number;
      }
    >();
    for (const line of lines) {
      const key = String(line.code ?? line.name);
      const bucket = byHead.get(key) ?? {
        feeHead: String(line.name ?? line.code),
        code: key,
        demanded: 0,
        collected: 0,
        outstanding: 0,
      };
      const lineAmount = Number(line.amount ?? 0);
      const demand = line.demand as {
        totalAmount?: number;
        paidAmount?: number;
        balanceAmount?: number;
      };
      const demandTotal = Number(demand?.totalAmount ?? 0);
      const paidRatio =
        demandTotal > 0 ? Number(demand?.paidAmount ?? 0) / demandTotal : 0;
      bucket.demanded += lineAmount;
      bucket.collected += Math.round(lineAmount * paidRatio);
      bucket.outstanding += Math.round(lineAmount * (1 - paidRatio));
      byHead.set(key, bucket);
    }
    const rows = Array.from(byHead.values()).sort(
      (a, b) => b.collected - a.collected,
    );
    return {
      type: 'fee-heads',
      total: rows.reduce((s, r) => s + r.collected, 0),
      rows,
    };
  }

  private async paymentModeReport(tenantId: string, query: ReportsQueryDto) {
    const rec = await this.reconciliation(tenantId, query);
    const rows = Object.entries(rec.totals)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([mode, amount]) => ({
        mode:
          FEE_PAYMENT_SOURCE_LABELS[
            mode as keyof typeof FEE_PAYMENT_SOURCE_LABELS
          ] ?? mode.replace(/_/g, ' '),
        amount: Number(amount),
        count: rec.rows.filter(
          (r: { paymentSource?: string }) => r.paymentSource === mode,
        ).length,
      }))
      .sort((a, b) => b.amount - a.amount);
    return { type: 'payment-modes', total: rec.grandTotal, rows };
  }

  private async admissionCycleReport(tenantId: string, query: ReportsQueryDto) {
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        demandType: 'ADMISSION_SESSION',
        ...this.academicWhere(query),
      },
      include: { lines: true },
      take: 5000,
    });
    const byCycle = new Map<
      string,
      {
        cycle: string;
        students: number;
        demanded: number;
        collected: number;
        outstanding: number;
        status: string;
      }
    >();
    for (const d of demands) {
      const meta = d.metadata as {
        feeCycleName?: string;
        coversSemesters?: number[];
      } | null;
      const cycle =
        meta?.feeCycleName ??
        String(d.billingPeriod ?? 'Admission').replace('CYCLE-', 'Cycle ');
      const bucket = byCycle.get(cycle) ?? {
        cycle,
        students: 0,
        demanded: 0,
        collected: 0,
        outstanding: 0,
        status: 'PENDING',
      };
      bucket.students += 1;
      bucket.demanded += Number(d.totalAmount ?? 0);
      bucket.collected += Number(d.paidAmount ?? 0);
      bucket.outstanding += Number(d.balanceAmount ?? 0);
      bucket.status =
        bucket.outstanding <= 0
          ? 'COLLECTED'
          : bucket.collected > 0
            ? 'PARTIAL'
            : 'PENDING';
      byCycle.set(cycle, bucket);
    }
    const rows = Array.from(byCycle.values()).sort((a, b) =>
      a.cycle.localeCompare(b.cycle),
    );
    return {
      type: 'admission-cycles',
      total: rows.reduce((s, r) => s + r.collected, 0),
      rows,
    };
  }

  private async monthlyStatusReport(tenantId: string, query: ReportsQueryDto) {
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        demandType: 'MONTHLY_TUITION',
        ...this.academicWhere(query),
      },
      take: 5000,
    });
    const byMonth = new Map<
      string,
      {
        month: string;
        monthLabel: string;
        paid: number;
        pending: number;
        studentsPaid: number;
        studentsPending: number;
      }
    >();
    for (const d of demands) {
      const period = String(d.billingPeriod ?? '');
      const [y, m] = period.split('-');
      const monthLabel = period
        ? new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', {
            month: 'long',
            year: 'numeric',
          })
        : period;
      const bucket = byMonth.get(period) ?? {
        month: period,
        monthLabel,
        paid: 0,
        pending: 0,
        studentsPaid: 0,
        studentsPending: 0,
      };
      const balance = Number(d.balanceAmount ?? 0);
      const paid = Number(d.paidAmount ?? 0);
      bucket.paid += paid;
      bucket.pending += balance;
      if (balance <= 0) bucket.studentsPaid += 1;
      else bucket.studentsPending += 1;
      byMonth.set(period, bucket);
    }
    const rows = Array.from(byMonth.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
    return {
      type: 'monthly-status',
      total: rows.reduce((s, r) => s + r.paid, 0),
      rows,
    };
  }

  private async scholarshipReport(tenantId: string, query: ReportsQueryDto) {
    const concessions = await this.db().feeConcession.findMany({
      where: { tenantId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    const studentMap = await this.loadStudents(
      tenantId,
      this.uniqueStudentIds(concessions),
    );
    const rows = concessions.map((c: any) => {
      const student = studentMap.get(String(c.studentId ?? ''));
      return {
        studentName: this.studentDisplayName(
          student,
          String(c.studentId ?? ''),
        ),
        enrollmentNumber: student?.enrollmentNumber ?? '—',
        scholarshipType: c.schemeName ?? c.type ?? 'Concession',
        amountWaived: Number(c.approvedAmount ?? c.amount ?? 0),
        balance: Number(c.balanceAmount ?? 0),
        status: c.status,
      };
    });
    return {
      type: 'scholarships',
      total: rows.reduce(
        (s: number, r: { amountWaived: number }) => s + r.amountWaived,
        0,
      ),
      rows,
    };
  }

  private async fineReport(tenantId: string, query: ReportsQueryDto) {
    const demands = await this.db().studentFeeDemand.findMany({
      where: { tenantId, fineAmount: { gt: 0 }, ...this.academicWhere(query) },
      orderBy: { fineAmount: 'desc' },
      take: 1000,
    });
    const studentMap = await this.loadStudents(
      tenantId,
      this.uniqueStudentIds(demands),
    );
    const rows = demands.map((d: any) => {
      const student = studentMap.get(String(d.studentId ?? ''));
      return {
        studentName: this.studentDisplayName(
          student,
          String(d.studentId ?? ''),
        ),
        enrollmentNumber: student?.enrollmentNumber ?? '—',
        demandType: d.demandType,
        billingPeriod: d.billingPeriod,
        lateFee: Number(d.fineAmount ?? 0),
        balance: Number(d.balanceAmount ?? 0),
      };
    });
    return {
      type: 'fines',
      total: rows.reduce(
        (s: number, r: { lateFee: number }) => s + r.lateFee,
        0,
      ),
      rows,
    };
  }

  private async cashBookReport(tenantId: string, query: ReportsQueryDto) {
    const [cashReg, refunds] = await Promise.all([
      this.cashRegister(tenantId, query),
      this.db().paymentTransaction.findMany({
        where: {
          tenantId,
          status: { in: ['REFUNDED', 'REVERSED'] },
          ...this.paidAtDateWhere(query),
        },
        take: 500,
      }),
    ]);
    const refundTotal = refunds.reduce(
      (s: number, p: any) => s + Number(p.amount ?? 0),
      0,
    );
    const opening = 0;
    const collections = Number(cashReg.total ?? 0);
    const closing = opening + collections - refundTotal;
    return {
      type: 'cash-book',
      total: collections,
      summary: {
        opening,
        collections,
        refunds: refundTotal,
        adjustments: 0,
        closing,
      },
      rows: [
        ...(cashReg.rows as Array<Record<string, unknown>>),
        ...refunds.map((p: any) => ({
          date: p.paidAt,
          receiptNo: 'REFUND',
          transactionNo: p.transactionNo,
          studentName: '—',
          amount: -Number(p.amount ?? 0),
          paymentMode: p.paymentMode,
          collectedBy: '—',
        })),
      ],
    };
  }

  private async auditReport(tenantId: string, query: ReportsQueryDto) {
    const [auditLogs, cancelledReceipts, externalPending] = await Promise.all([
      this.db().feeAuditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.db().feeReceipt.findMany({
        where: { tenantId, status: 'CANCELLED' },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      this.db().externalFeePayment.findMany({
        where: { tenantId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    const rows = [
      ...auditLogs.map((log: any) => ({
        category: 'Audit',
        action: log.action,
        entity: log.entityType,
        reference: log.entityId,
        amount: log.metadata?.amount ?? null,
        performedAt: log.createdAt,
        performedBy: log.performedById ?? '—',
      })),
      ...cancelledReceipts.map((r: any) => ({
        category: 'Cancelled Receipt',
        action: 'CANCEL',
        entity: 'RECEIPT',
        reference: r.receiptNo,
        amount: Number(r.totalAmount ?? 0),
        performedAt: r.updatedAt,
        performedBy: r.cancelledById ?? '—',
      })),
      ...externalPending.map((e: any) => ({
        category: 'External Payment',
        action: 'PENDING_VERIFY',
        entity: e.paymentSource,
        reference: e.entryNo,
        amount: Number(e.amount ?? 0),
        performedAt: e.createdAt,
        performedBy: '—',
      })),
    ];
    return {
      type: 'audit',
      total: rows.length,
      rows: rows.slice(0, 500),
    };
  }

  private monthlyCollection(payments: any[]) {
    const buckets = new Map<string, number>();
    for (const payment of payments) {
      const key = String(payment.paidAt ?? payment.createdAt).slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(payment.amount ?? 0));
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, collected]) => ({ month, collected }));
  }

  private dateWhere(query: ReportsQueryDto) {
    if (!query.from && !query.to) return {};
    return {
      createdAt: {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      },
    };
  }

  private paidAtDateWhere(query: ReportsQueryDto) {
    if (!query.from && !query.to) return {};
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from) from.setHours(0, 0, 0, 0);
    if (to) {
      to.setHours(23, 59, 59, 999);
    } else if (from) {
      const end = new Date(from);
      end.setHours(23, 59, 59, 999);
      return { paidAt: { gte: from, lte: end } };
    }
    return {
      paidAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    };
  }

  private academicWhere(query: ReportsQueryDto) {
    return {
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.programVersionId
        ? {
            metadata: {
              path: ['context', 'programVersionId'],
              equals: query.programVersionId,
            },
          }
        : {}),
    };
  }
}
