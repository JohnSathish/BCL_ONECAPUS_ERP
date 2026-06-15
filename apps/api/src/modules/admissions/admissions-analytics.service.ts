import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdmissionsAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFunnel(tenantId: string, cycleId?: string) {
    const base = {
      tenantId,
      deletedAt: null,
      ...(cycleId ? { cycleId } : {}),
    };

    const [
      registered,
      formStarted,
      submitted,
      paid,
      verified,
      shortlisted,
      allotted,
      enrolled,
    ] = await Promise.all([
      this.prisma.admissionApplication.count({ where: base }),
      this.prisma.admissionApplication.count({
        where: { ...base, progressPercent: { gt: 0 } },
      }),
      this.prisma.admissionApplication.count({
        where: {
          ...base,
          status: { not: 'draft' },
          submittedAt: { not: null },
        },
      }),
      this.prisma.admissionApplication.count({
        where: {
          ...base,
          paymentStatus: { in: ['PAID', 'WAIVED'] },
        },
      }),
      this.prisma.admissionApplication.count({
        where: { ...base, documentVerificationStatus: 'VERIFIED' },
      }),
      this.prisma.admissionApplication.count({
        where: { ...base, status: 'shortlisted' },
      }),
      this.prisma.admissionApplication.count({
        where: { ...base, status: 'allotted' },
      }),
      this.prisma.student.count({
        where: {
          tenantId,
          deletedAt: null,
          admissionSource: 'ONLINE_ADMISSION',
          ...(cycleId
            ? {
                admissionApplication: { cycleId },
              }
            : {}),
        },
      }),
    ]);

    return {
      registered,
      formStarted,
      submitted,
      paid,
      verified,
      shortlisted,
      allotted,
      enrolled,
    };
  }

  async getProgramBreakdown(tenantId: string, cycleId?: string) {
    const apps = await this.prisma.admissionApplication.groupBy({
      by: ['programId', 'status'],
      where: {
        tenantId,
        deletedAt: null,
        ...(cycleId ? { cycleId } : {}),
      },
      _count: true,
    });

    const programs = await this.prisma.program.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    const programMap = new Map(programs.map((p) => [p.id, p]));

    const byProgram = new Map<
      string,
      {
        program: { code: string; name: string };
        total: number;
        byStatus: Record<string, number>;
      }
    >();

    for (const row of apps) {
      const pid = row.programId ?? 'unassigned';
      const prog = programMap.get(pid) ?? { code: 'N/A', name: 'Unassigned' };
      const entry = byProgram.get(pid) ?? {
        program: prog,
        total: 0,
        byStatus: {},
      };
      entry.total += row._count;
      entry.byStatus[row.status] = row._count;
      byProgram.set(pid, entry);
    }

    return Array.from(byProgram.values());
  }

  async getShiftFillRate(tenantId: string, cycleId: string) {
    const intakes = await this.prisma.admissionIntake.findMany({
      where: { tenantId, cycleId, deletedAt: null },
      include: {
        program: true,
        shiftCaps: { include: { shift: true } },
        allocations: {
          where: { deletedAt: null, status: { not: 'withdrawn' } },
        },
      },
    });

    return intakes.map((intake) => ({
      intake: { id: intake.id, name: intake.name, program: intake.program },
      shifts: intake.shiftCaps.map((cap) => {
        const allocated = intake.allocations.filter(
          (a) => a.shiftId === cap.shiftId,
        ).length;
        return {
          shift: cap.shift,
          totalSeats: cap.totalSeats,
          allocated,
          fillRate: cap.totalSeats > 0 ? allocated / cap.totalSeats : 0,
        };
      }),
    }));
  }

  async getDailyRegistrations(tenantId: string, cycleId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const apps = await this.prisma.admissionApplication.findMany({
      where: {
        tenantId,
        cycleId,
        deletedAt: null,
        createdAt: { gte: since },
      },
      select: { createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const app of apps) {
      const day = app.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    return Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async exportApplicationsCsv(tenantId: string, cycleId: string) {
    const apps = await this.prisma.admissionApplication.findMany({
      where: { tenantId, cycleId, deletedAt: null },
      include: { program: true },
      orderBy: { applicationNumber: 'asc' },
    });

    const header =
      'applicationNumber,firstName,lastName,email,phone,category,status,meritScore,paymentStatus,progressPercent\n';
    const rows = apps
      .map(
        (a) =>
          `${a.applicationNumber},${a.firstName},${a.lastName},${a.email},${a.phone ?? ''},${a.category},${a.status},${a.meritScore},${a.paymentStatus},${a.progressPercent}`,
      )
      .join('\n');

    return header + rows;
  }
}
