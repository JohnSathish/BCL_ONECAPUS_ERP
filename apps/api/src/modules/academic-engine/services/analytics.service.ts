import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async registrationAnalytics(tenantId: string, programVersionId?: string) {
    const regWhere = {
      tenantId,
      ...(programVersionId ? { student: { programVersionId } } : {}),
    };

    const [byStatus, sections, waitlisted, lines] = await Promise.all([
      this.prisma.semesterRegistration.groupBy({
        by: ['status'],
        where: regWhere,
        _count: true,
      }),
      this.prisma.offeringSection.findMany({
        where: {
          tenantId,
          deletedAt: null,
          ...(programVersionId ? { courseOffering: { programVersionId } } : {}),
        },
        include: {
          shift: true,
          seatLedger: true,
          courseOffering: { include: { course: true } },
        },
      }),
      this.prisma.semesterRegistrationLine.count({
        where: { tenantId, status: 'waitlisted' },
      }),
      this.prisma.semesterRegistrationLine.groupBy({
        by: ['category'],
        where: { tenantId, status: 'confirmed' },
        _count: true,
      }),
    ]);

    const shiftOccupancy: Record<
      string,
      { capacity: number; confirmed: number }
    > = {};
    for (const s of sections) {
      const code = s.shift.code;
      if (!shiftOccupancy[code])
        shiftOccupancy[code] = { capacity: 0, confirmed: 0 };
      shiftOccupancy[code].capacity += s.capacity;
      shiftOccupancy[code].confirmed += s.seatLedger?.confirmedCount ?? 0;
    }

    const sectionUtilization = sections.map((s) => ({
      sectionId: s.id,
      courseCode: s.courseOffering.course.code,
      shift: s.shift.code,
      sectionCode: s.sectionCode,
      capacity: s.capacity,
      confirmed: s.seatLedger?.confirmedCount ?? 0,
      waitlisted: s.seatLedger?.waitlistCount ?? 0,
      utilizationPct: s.capacity
        ? Math.round(((s.seatLedger?.confirmedCount ?? 0) / s.capacity) * 100)
        : 0,
    }));

    return {
      funnel: byStatus.map((b) => ({ status: b.status, count: b._count })),
      waitlistedLines: waitlisted,
      categoryEnrollments: lines.map((l) => ({
        category: l.category,
        count: l._count,
      })),
      shiftOccupancy,
      sectionUtilization,
    };
  }

  seatUtilizationReport(tenantId: string, programVersionId?: string) {
    return this.prisma.offeringSection.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(programVersionId
          ? {
              courseOffering: {
                programVersionId,
                semesterSequence: { lte: 3 },
              },
            }
          : { courseOffering: { semesterSequence: { lte: 3 } } }),
      },
      include: {
        shift: true,
        seatLedger: true,
        courseOffering: { include: { course: true } },
      },
    });
  }
}
