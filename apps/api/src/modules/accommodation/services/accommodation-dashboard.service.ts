import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AccommodationDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const quarters = await this.prisma.staffQuarter.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        status: true,
        quarterType: true,
        block: true,
        monthlyRent: true,
        occupancies: {
          where: { status: 'ACTIVE' },
          select: { monthlyRent: true },
        },
      },
    });

    const statusCounts = {
      VACANT: 0,
      OCCUPIED: 0,
      RESERVED: 0,
      MAINTENANCE: 0,
    };
    const byBlock = new Map<string, { total: number; occupied: number }>();
    const byType = new Map<string, { total: number; occupied: number }>();

    let monthlyRentCollection = 0;
    for (const q of quarters) {
      statusCounts[q.status as keyof typeof statusCounts] =
        (statusCounts[q.status as keyof typeof statusCounts] ?? 0) + 1;
      const block = q.block ?? 'Unassigned';
      const b = byBlock.get(block) ?? { total: 0, occupied: 0 };
      b.total += 1;
      if (q.status === 'OCCUPIED') b.occupied += 1;
      byBlock.set(block, b);

      const t = byType.get(q.quarterType) ?? { total: 0, occupied: 0 };
      t.total += 1;
      if (q.status === 'OCCUPIED') t.occupied += 1;
      byType.set(q.quarterType, t);

      if (q.status === 'OCCUPIED' && q.occupancies[0]) {
        monthlyRentCollection += Number(q.occupancies[0].monthlyRent);
      }
    }

    const now = new Date();
    const pendingCharges = await this.prisma.quarterMonthlyCharge.aggregate({
      where: { tenantId, status: 'PENDING' },
      _sum: { amount: true },
      _count: true,
    });

    const activeOccupancies = await this.prisma.quarterOccupancy.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const recoveredYtd = await this.prisma.quarterMonthlyCharge.aggregate({
      where: {
        tenantId,
        status: 'RECOVERED',
        billingYear: now.getFullYear(),
      },
      _sum: { amount: true },
    });

    const annualRevenue =
      monthlyRentCollection * 12 + Number(recoveredYtd._sum.amount ?? 0);

    return {
      cards: {
        totalQuarters: quarters.length,
        occupiedQuarters: statusCounts.OCCUPIED,
        vacantQuarters: statusCounts.VACANT,
        maintenanceQuarters: statusCounts.MAINTENANCE,
        reservedQuarters: statusCounts.RESERVED,
        activeOccupancies,
      },
      revenue: {
        monthlyRentCollection,
        pendingCharges: Number(pendingCharges._sum.amount ?? 0),
        pendingChargeCount: pendingCharges._count,
        outstandingDues: Number(pendingCharges._sum.amount ?? 0),
        annualRevenue,
      },
      charts: {
        occupancyByBlock: [...byBlock.entries()].map(([block, v]) => ({
          block,
          total: v.total,
          occupied: v.occupied,
          vacant: v.total - v.occupied,
        })),
        occupancyByType: [...byType.entries()].map(([quarterType, v]) => ({
          quarterType,
          total: v.total,
          occupied: v.occupied,
        })),
      },
      generatedAt: now.toISOString(),
    };
  }
}
