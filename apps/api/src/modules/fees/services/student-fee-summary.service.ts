import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  ADMISSION_DEMAND_TYPE,
  MONTHLY_DEMAND_TYPE,
} from '../constants/monthly-fee.constants';

const ACTIVE_STATUSES = ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] as const;

export type StudentFeeSummaryRow = {
  studentId: string;
  totalOutstanding: number;
  totalOverdue: number;
  admissionOutstanding: number;
  monthlyOutstanding: number;
  totalPaid: number;
  feeStatus: 'CLEAR' | 'DUE' | 'OVERDUE';
  lastPaymentAt: Date | null;
  activeDemandCount: number;
};

@Injectable()
export class StudentFeeSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async get(
    tenantId: string,
    studentId: string,
  ): Promise<StudentFeeSummaryRow> {
    const row = await this.db().studentFeeSummary.findUnique({
      where: { tenantId_studentId: { tenantId, studentId } },
    });
    if (row) return this.mapRow(row);
    return this.recompute(tenantId, studentId);
  }

  async getMany(
    tenantId: string,
    studentIds: string[],
    options?: { recomputeMissing?: boolean },
  ): Promise<Map<string, StudentFeeSummaryRow>> {
    if (!studentIds.length) return new Map();
    const rows = await this.db().studentFeeSummary.findMany({
      where: { tenantId, studentId: { in: studentIds } },
    });
    const map = new Map<string, StudentFeeSummaryRow>();
    for (const row of rows) map.set(row.studentId, this.mapRow(row));

    const missing = studentIds.filter((id) => !map.has(id));
    if (!missing.length) return map;

    if (options?.recomputeMissing === false) {
      for (const studentId of missing) {
        map.set(studentId, this.clearSummary(studentId));
      }
      return map;
    }

    // Never recompute an entire page in parallel — it OOMs small production VPS hosts.
    for (const studentId of missing) {
      map.set(studentId, await this.recompute(tenantId, studentId));
    }
    return map;
  }

  /** Read cached fee rows only; missing students default to CLEAR (safe for directory list). */
  async getManyCached(
    tenantId: string,
    studentIds: string[],
  ): Promise<Map<string, StudentFeeSummaryRow>> {
    return this.getMany(tenantId, studentIds, { recomputeMissing: false });
  }

  private clearSummary(studentId: string): StudentFeeSummaryRow {
    return {
      studentId,
      totalOutstanding: 0,
      totalOverdue: 0,
      admissionOutstanding: 0,
      monthlyOutstanding: 0,
      totalPaid: 0,
      feeStatus: 'CLEAR',
      lastPaymentAt: null,
      activeDemandCount: 0,
    };
  }

  async recompute(
    tenantId: string,
    studentId: string,
  ): Promise<StudentFeeSummaryRow> {
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId,
        status: { in: [...ACTIVE_STATUSES, 'PAID'] },
      },
      select: {
        demandType: true,
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        dueDate: true,
        status: true,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalOutstanding = 0;
    let totalOverdue = 0;
    let admissionOutstanding = 0;
    let monthlyOutstanding = 0;
    let totalPaid = 0;
    let activeDemandCount = 0;

    for (const d of demands) {
      const balance = Number(d.balanceAmount ?? 0);
      const paid = Number(d.paidAmount ?? 0);
      totalPaid += paid;
      if (balance <= 0 || !ACTIVE_STATUSES.includes(d.status)) continue;
      totalOutstanding += balance;
      activeDemandCount += 1;
      if (d.demandType === ADMISSION_DEMAND_TYPE)
        admissionOutstanding += balance;
      if (d.demandType === MONTHLY_DEMAND_TYPE) monthlyOutstanding += balance;
      if (d.dueDate && new Date(d.dueDate) < today) totalOverdue += balance;
    }

    const lastPayment = await this.db().paymentTransaction.findFirst({
      where: { tenantId, studentId, status: 'SUCCESS' },
      orderBy: { paidAt: 'desc' },
      select: { paidAt: true },
    });

    const feeStatus: StudentFeeSummaryRow['feeStatus'] =
      totalOutstanding <= 0 ? 'CLEAR' : totalOverdue > 0 ? 'OVERDUE' : 'DUE';

    const data = {
      totalOutstanding,
      totalOverdue,
      admissionOutstanding,
      monthlyOutstanding,
      totalPaid,
      feeStatus,
      lastPaymentAt: lastPayment?.paidAt ?? null,
      activeDemandCount,
      calculatedAt: new Date(),
    };

    await this.db().studentFeeSummary.upsert({
      where: { tenantId_studentId: { tenantId, studentId } },
      create: { tenantId, studentId, ...data },
      update: data,
    });

    return { studentId, ...data };
  }

  async touchAfterPayment(tenantId: string, studentId: string) {
    return this.recompute(tenantId, studentId);
  }

  async listDefaulterStudentIds(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ studentId: string }[]>`
      SELECT sfs.student_id AS "studentId"
      FROM finance.student_fee_summaries sfs
      INNER JOIN academic.students s
        ON s.id = sfs.student_id AND s.tenant_id = sfs.tenant_id
      WHERE sfs.tenant_id = ${tenantId}::uuid
        AND s.deleted_at IS NULL
        AND sfs.total_outstanding > 0
    `;
    return rows.map((r) => r.studentId);
  }

  private mapRow(row: Record<string, unknown>): StudentFeeSummaryRow {
    return {
      studentId: String(row.studentId),
      totalOutstanding: Number(row.totalOutstanding ?? 0),
      totalOverdue: Number(row.totalOverdue ?? 0),
      admissionOutstanding: Number(row.admissionOutstanding ?? 0),
      monthlyOutstanding: Number(row.monthlyOutstanding ?? 0),
      totalPaid: Number(row.totalPaid ?? 0),
      feeStatus: String(
        row.feeStatus ?? 'CLEAR',
      ) as StudentFeeSummaryRow['feeStatus'],
      lastPaymentAt: row.lastPaymentAt
        ? new Date(String(row.lastPaymentAt))
        : null,
      activeDemandCount: Number(row.activeDemandCount ?? 0),
    };
  }
}
