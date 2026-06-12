import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { ReportsQueryDto } from '../dto/fees.dto';

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
        renewalPending: demands.filter(
          (demand: any) =>
            demand.demandType === 'RENEWAL' &&
            Number(demand.balanceAmount ?? 0) > 0,
        ).length,
        concessions: concessions.reduce(
          (sum: number, item: any) => sum + Number(item.approvedAmount ?? 0),
          0,
        ),
        receiptCount: receipts.length,
      },
      trends: this.monthlyCollection(payments),
      defaulters: demands
        .filter((demand: any) => Number(demand.balanceAmount ?? 0) > 0)
        .sort(
          (a: any, b: any) =>
            Number(b.balanceAmount ?? 0) - Number(a.balanceAmount ?? 0),
        )
        .slice(0, 10),
    };
  }

  async report(tenantId: string, type: string, query: ReportsQueryDto) {
    const dateWhere = this.dateWhere(query);
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
      const demands = await this.db().studentFeeDemand.findMany({
        where: {
          tenantId,
          balanceAmount: { gt: 0 },
          ...this.academicWhere(query),
        },
        orderBy: { balanceAmount: 'desc' },
        take: 1000,
      });
      return {
        type,
        total: demands.reduce(
          (sum: number, row: any) => sum + Number(row.balanceAmount ?? 0),
          0,
        ),
        rows: demands,
      };
    }
    return this.dashboard(tenantId);
  }

  auditLogs(tenantId: string) {
    return this.db().feeAuditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
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
