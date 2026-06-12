import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

type LedgerPostInput = {
  tenantId: string;
  studentId: string;
  demandId?: string;
  paymentId?: string;
  concessionId?: string;
  entryType: string;
  debitAmount?: number;
  creditAmount?: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  postedById?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class FeeLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async studentLedger(tenantId: string, studentId: string) {
    const [entries, demands, payments, receipts, concessions] =
      await Promise.all([
        this.db().studentFeeLedgerEntry.findMany({
          where: { tenantId, studentId },
          orderBy: { postedAt: 'desc' },
          take: 300,
        }),
        this.db().studentFeeDemand.findMany({
          where: { tenantId, studentId },
          include: {
            lines: true,
            allocations: true,
            receipts: true,
            concessions: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.db().paymentTransaction.findMany({
          where: { tenantId, studentId },
          include: { allocations: true, receipts: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.db().feeReceipt.findMany({
          where: { tenantId, studentId },
          orderBy: { issuedAt: 'desc' },
        }),
        this.db().feeConcession.findMany({
          where: { tenantId, studentId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    return {
      studentId,
      summary: this.summarize(entries),
      entries,
      demands,
      payments,
      receipts,
      concessions,
    };
  }

  async myLedger(tenantId: string, userId: string) {
    const student = await this.db().student.findFirst({
      where: { tenantId, userId, deletedAt: null },
    });
    if (!student)
      return {
        studentId: null,
        summary: this.summarize([]),
        entries: [],
        demands: [],
        payments: [],
        receipts: [],
      };
    return this.studentLedger(tenantId, student.id);
  }

  async dues(tenantId: string, studentId: string) {
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        studentId,
        status: { in: ['PUBLISHED', 'LOCKED', 'PARTIALLY_PAID'] },
      },
      include: { lines: true },
      orderBy: { dueDate: 'asc' },
    });
    return {
      studentId,
      totalDue: demands.reduce(
        (sum: number, demand: any) => sum + Number(demand.balanceAmount ?? 0),
        0,
      ),
      demands,
    };
  }

  async myDues(tenantId: string, userId: string) {
    const student = await this.db().student.findFirst({
      where: { tenantId, userId, deletedAt: null },
    });
    if (!student) return { studentId: null, totalDue: 0, demands: [] };
    return this.dues(tenantId, student.id);
  }

  async post(input: LedgerPostInput) {
    const runningBalance = await this.nextBalance(
      input.tenantId,
      input.studentId,
      Number(input.debitAmount ?? 0) - Number(input.creditAmount ?? 0),
    );
    return this.db().studentFeeLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        demandId: input.demandId,
        paymentId: input.paymentId,
        concessionId: input.concessionId,
        entryNo: await this.nextEntryNo(input.tenantId),
        entryType: input.entryType,
        debitAmount: input.debitAmount ?? 0,
        creditAmount: input.creditAmount ?? 0,
        runningBalance,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        postedById: input.postedById,
        metadata: input.metadata,
      },
    });
  }

  private summarize(entries: any[]) {
    const charges = entries.reduce(
      (sum, entry) => sum + Number(entry.debitAmount ?? 0),
      0,
    );
    const credits = entries.reduce(
      (sum, entry) => sum + Number(entry.creditAmount ?? 0),
      0,
    );
    return {
      openingBalance: 0,
      charges,
      credits,
      closingBalance: charges - credits,
      entryCount: entries.length,
    };
  }

  private async nextBalance(
    tenantId: string,
    studentId: string,
    delta: number,
  ) {
    const last = await this.db().studentFeeLedgerEntry.findFirst({
      where: { tenantId, studentId },
      orderBy: { postedAt: 'desc' },
    });
    return Number(last?.runningBalance ?? 0) + delta;
  }

  private async nextEntryNo(tenantId: string) {
    const count = await this.db().studentFeeLedgerEntry.count({
      where: { tenantId },
    });
    return `LED-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }
}
