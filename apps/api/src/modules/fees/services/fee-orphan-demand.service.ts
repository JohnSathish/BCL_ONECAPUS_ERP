import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { FeeLedgerService } from './fee-ledger.service';

export type OrphanDemandRow = {
  id: string;
  demandNo: string;
  studentId: string;
  demandType: string;
  billingPeriod: string | null;
  status: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  canAutoCancel: boolean;
  blockReason?: string;
};

@Injectable()
export class FeeOrphanDemandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: FeeLedgerService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  /**
   * Demands whose student_id is not an active student (missing or soft-deleted).
   */
  async listOrphans(tenantId: string): Promise<{
    summary: {
      total: number;
      cancellable: number;
      blockedPaid: number;
      outstandingAmount: number;
    };
    rows: OrphanDemandRow[];
  }> {
    const demands = await this.db().studentFeeDemand.findMany({
      where: {
        tenantId,
        status: { notIn: ['CANCELLED', 'ROLLED_BACK'] },
        balanceAmount: { gt: 0 },
      },
      orderBy: [{ balanceAmount: 'desc' }, { demandNo: 'asc' }],
      take: 10_000,
    });

    const studentIds: string[] = [
      ...new Set(
        (demands as Array<{ studentId?: string }>)
          .map((d) => String(d.studentId ?? ''))
          .filter(Boolean),
      ),
    ];

    const existing = new Set<string>();
    const chunkSize = 400;
    for (let i = 0; i < studentIds.length; i += chunkSize) {
      const chunk: string[] = studentIds.slice(i, i + chunkSize);
      const students = await this.prisma.student.findMany({
        where: {
          tenantId,
          id: { in: chunk },
          deletedAt: null,
        },
        select: { id: true },
      });
      for (const s of students) existing.add(String(s.id));
    }

    const rows: OrphanDemandRow[] = [];
    for (const d of demands) {
      const sid = String(d.studentId ?? '');
      if (existing.has(sid)) continue;
      const paid = Number(d.paidAmount ?? 0);
      const balance = Number(d.balanceAmount ?? 0);
      const canAutoCancel = paid <= 0;
      rows.push({
        id: String(d.id),
        demandNo: String(d.demandNo),
        studentId: sid,
        demandType: String(d.demandType ?? ''),
        billingPeriod: d.billingPeriod ? String(d.billingPeriod) : null,
        status: String(d.status ?? ''),
        totalAmount: Number(d.totalAmount ?? 0),
        paidAmount: paid,
        balanceAmount: balance,
        canAutoCancel,
        blockReason: canAutoCancel
          ? undefined
          : 'Has payments allocated — review manually',
      });
    }

    return {
      summary: {
        total: rows.length,
        cancellable: rows.filter((r) => r.canAutoCancel).length,
        blockedPaid: rows.filter((r) => !r.canAutoCancel).length,
        outstandingAmount: rows.reduce((s, r) => s + r.balanceAmount, 0),
      },
      rows,
    };
  }

  /**
   * Cancel unpaid orphan demands and reverse their outstanding balance on the ledger.
   * Paid orphans are skipped (returned in `skipped`).
   */
  async cleanup(
    user: JwtUser,
    options?: { dryRun?: boolean; demandIds?: string[] },
  ) {
    const { rows, summary } = await this.listOrphans(user.tid);
    const selected = options?.demandIds?.length
      ? rows.filter((r) => options.demandIds!.includes(r.id))
      : rows;

    const cancellable = selected.filter((r) => r.canAutoCancel);
    const skipped = selected.filter((r) => !r.canAutoCancel);

    if (options?.dryRun) {
      return {
        dryRun: true,
        summary,
        wouldCancel: cancellable.length,
        wouldCancelAmount: cancellable.reduce((s, r) => s + r.balanceAmount, 0),
        skipped: skipped.length,
        sample: cancellable.slice(0, 20),
      };
    }

    let cancelled = 0;
    let cancelledAmount = 0;
    const errors: Array<{ demandId: string; message: string }> = [];

    for (const row of cancellable) {
      try {
        const demand = await this.db().studentFeeDemand.findFirst({
          where: { id: row.id, tenantId: user.tid },
        });
        if (!demand || demand.status === 'CANCELLED') continue;
        if (Number(demand.paidAmount ?? 0) > 0) {
          skipped.push({ ...row, canAutoCancel: false });
          continue;
        }

        const balance = Number(demand.balanceAmount ?? 0);
        const prevMeta =
          demand.metadata && typeof demand.metadata === 'object'
            ? (demand.metadata as Record<string, unknown>)
            : {};

        await this.db().studentFeeDemand.update({
          where: { id: demand.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            balanceAmount: 0,
            metadata: {
              ...prevMeta,
              orphanCleanup: {
                at: new Date().toISOString(),
                byUserId: user.sub,
                reason: 'Student record missing or deleted',
                previousBalance: balance,
                previousStatus: demand.status,
              },
            },
          },
        });

        if (balance > 0) {
          await this.ledger.post({
            tenantId: user.tid,
            studentId: String(demand.studentId),
            demandId: demand.id,
            entryType: 'REVERSAL',
            creditAmount: balance,
            referenceType: 'ORPHAN_DEMAND_CLEANUP',
            referenceId: demand.id,
            description: `Orphan demand cancelled (${demand.demandNo}) — student record missing`,
            postedById: user.sub,
            metadata: { orphanCleanup: true },
          });
        }

        cancelled += 1;
        cancelledAmount += balance;
      } catch (err) {
        errors.push({
          demandId: row.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      dryRun: false,
      summary,
      cancelled,
      cancelledAmount,
      skipped: skipped.length,
      skippedRows: skipped.slice(0, 50),
      errors,
    };
  }
}
