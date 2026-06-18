import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CampusAccessDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private todayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  async getLiveStats(tenantId: string, accessPointId?: string) {
    const { start, end } = this.todayRange();
    const pointFilter = accessPointId ? { accessPointId } : {};

    const logs = await this.prisma.entryExitLog.findMany({
      where: {
        tenantId,
        scannedAt: { gte: start, lt: end },
        allowed: true,
        ...pointFilter,
      },
      select: {
        direction: true,
        memberType: true,
        studentId: true,
        staffProfileId: true,
        visitorId: true,
        scannedAt: true,
        displayName: true,
        programme: true,
        department: true,
        enrollmentNumber: true,
      },
      orderBy: { scannedAt: 'desc' },
      take: 500,
    });

    const entries = logs.filter((l) => l.direction === 'IN').length;
    const exits = logs.filter((l) => l.direction === 'OUT').length;

    const openInside = new Map<string, number>();
    for (const log of [...logs].reverse()) {
      const key =
        log.studentId ??
        log.staffProfileId ??
        log.visitorId ??
        log.enrollmentNumber ??
        log.displayName;
      if (log.direction === 'IN') openInside.set(key, 1);
      else openInside.delete(key);
    }

    let maleStudents = 0;
    let femaleStudents = 0;
    const studentIds = [...openInside.keys()].filter(Boolean);
    if (studentIds.length) {
      const students = await this.prisma.student.findMany({
        where: {
          tenantId,
          id: {
            in: logs
              .filter((l) => l.studentId && openInside.has(l.studentId))
              .map((l) => l.studentId!)
              .filter(Boolean),
          },
        },
        include: { masterProfile: { select: { gender: true } } },
      });
      for (const s of students) {
        const g = (s.masterProfile?.gender ?? '').toUpperCase();
        if (g.startsWith('M')) maleStudents += 1;
        else if (g.startsWith('F')) femaleStudents += 1;
      }
    }

    const teachingStaff = logs.filter(
      (l) =>
        l.memberType === 'FACULTY' &&
        l.direction === 'IN' &&
        openInside.has(l.staffProfileId ?? l.displayName),
    ).length;
    const nonTeachingStaff = logs.filter(
      (l) =>
        l.memberType === 'STAFF' &&
        l.direction === 'IN' &&
        openInside.has(l.staffProfileId ?? l.displayName),
    ).length;
    const visitors = logs.filter(
      (l) =>
        l.memberType === 'VISITOR' &&
        openInside.has(l.visitorId ?? l.displayName),
    ).length;

    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: logs.filter(
        (l) => l.scannedAt.getHours() === hour && l.direction === 'IN',
      ).length,
    }));

    const peakHour = hourly.reduce(
      (best, row) => (row.count > best.count ? row : best),
      { hour: 0, count: 0 },
    );

    const activity = logs.slice(0, 12).map((l) => ({
      at: l.scannedAt.toISOString(),
      name: l.displayName,
      programme: l.programme,
      direction: l.direction,
    }));

    return {
      todayEntries: entries,
      todayExits: exits,
      currentlyInside: openInside.size,
      peakHour: peakHour.count > 0 ? `${peakHour.hour}:00` : null,
      scansToday: logs.length,
      studentsInside: {
        male: maleStudents,
        female: femaleStudents,
        total: maleStudents + femaleStudents,
      },
      staffInside: {
        teaching: teachingStaff,
        nonTeaching: nonTeachingStaff,
      },
      visitorsInside: visitors,
      hourly,
      activity,
    };
  }

  dashboard(tenantId: string) {
    return this.getLiveStats(tenantId);
  }
}
