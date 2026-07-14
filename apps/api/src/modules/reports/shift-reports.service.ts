import { Injectable } from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { ShiftScopeService } from '../../common/services/shift-scope.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ShiftReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shiftScope: ShiftScopeService,
  ) {}

  private resolveShiftId(user: JwtUser, shiftId?: string) {
    return this.shiftScope.assertCanUseShiftId(user, shiftId);
  }

  private minutes(value: Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }

  private hoursBetween(start: Date, end: Date) {
    return Math.max(0, (this.minutes(end) - this.minutes(start)) / 60);
  }

  async pack(user: JwtUser, shiftId?: string) {
    const effectiveShiftId = this.resolveShiftId(user, shiftId);
    if (!effectiveShiftId) {
      return {
        shiftId: null,
        facultyWorkload: [],
        subjectAllocation: [],
        timetableCoverage: null,
        classroomUtilization: [],
        teachingHours: null,
        departmentStaff: [],
      };
    }

    const [
      shift,
      facultyWorkload,
      subjectAllocation,
      timetableCoverage,
      classroomUtilization,
      teachingHours,
      departmentStaff,
    ] = await Promise.all([
      this.prisma.shift.findFirst({
        where: { id: effectiveShiftId, tenantId: user.tid },
        select: { id: true, code: true, name: true },
      }),
      this.facultyWorkload(user.tid, effectiveShiftId),
      this.subjectAllocation(user.tid, effectiveShiftId),
      this.timetableCoverage(user.tid, effectiveShiftId),
      this.classroomUtilization(user.tid, effectiveShiftId),
      this.teachingHoursTotals(user.tid, effectiveShiftId),
      this.departmentStaff(user.tid, effectiveShiftId),
    ]);

    return {
      shift,
      shiftId: effectiveShiftId,
      facultyWorkload,
      subjectAllocation,
      timetableCoverage,
      classroomUtilization,
      teachingHours,
      departmentStaff,
    };
  }

  async facultyWorkload(tenantId: string, shiftId: string) {
    const assignments = await this.prisma.staffShiftAssignment.findMany({
      where: { tenantId, shiftId, active: true },
      include: {
        staffProfile: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            shortCode: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        staffProfileId: { in: assignments.map((a) => a.staffProfileId) },
        OR: [{ shiftId }, { plan: { shiftId, deletedAt: null } }],
        plan: {
          tenantId,
          deletedAt: null,
          status: { in: ['PUBLISHED', 'APPROVED', 'DRAFT', 'SUBMITTED'] },
        },
      },
      select: {
        staffProfileId: true,
        startTime: true,
        endTime: true,
        dayOfWeek: true,
      },
    });

    const hoursByStaff = new Map<string, number>();
    const slotsByStaff = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.staffProfileId) continue;
      const hours = this.hoursBetween(entry.startTime, entry.endTime);
      hoursByStaff.set(
        entry.staffProfileId,
        (hoursByStaff.get(entry.staffProfileId) ?? 0) + hours,
      );
      slotsByStaff.set(
        entry.staffProfileId,
        (slotsByStaff.get(entry.staffProfileId) ?? 0) + 1,
      );
    }

    return assignments.map((row) => ({
      staffProfileId: row.staffProfileId,
      fullName: row.staffProfile.fullName,
      employeeCode: row.staffProfile.employeeCode,
      shortCode: row.staffProfile.shortCode,
      department: row.staffProfile.department?.name ?? null,
      mappedHoursPerWeek: row.hoursPerWeek ? Number(row.hoursPerWeek) : null,
      scheduledWeeklyHours: Number(
        (hoursByStaff.get(row.staffProfileId) ?? 0).toFixed(2),
      ),
      scheduledSlots: slotsByStaff.get(row.staffProfileId) ?? 0,
      isPrimary: row.isPrimary,
    }));
  }

  async subjectAllocation(tenantId: string, shiftId: string) {
    const rows = await this.prisma.staffSubjectAssignment.findMany({
      where: {
        tenantId,
        OR: [{ shiftId }, { offeringSection: { shiftId, deletedAt: null } }],
      },
      include: {
        staffProfile: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            shortCode: true,
            department: { select: { id: true, name: true } },
          },
        },
        course: { select: { id: true, code: true, title: true } },
        offeringSection: {
          select: { id: true, sectionCode: true, shiftId: true },
        },
      },
      orderBy: [{ staffProfile: { fullName: 'asc' } }],
      take: 500,
    });

    return rows.map((row) => ({
      id: row.id,
      staffProfileId: row.staffProfileId,
      staffName: row.staffProfile.fullName,
      employeeCode: row.staffProfile.employeeCode,
      shortCode: row.staffProfile.shortCode,
      courseCode: row.course?.code ?? null,
      courseTitle: row.course?.title ?? null,
      sectionCode: row.offeringSection?.sectionCode ?? null,
      department: row.staffProfile.department?.name ?? null,
      isPrimaryFaculty: row.isPrimaryFaculty,
      weeklyHours: row.workloadHours ? Number(row.workloadHours) : null,
    }));
  }

  async timetableCoverage(tenantId: string, shiftId: string) {
    const plans = await this.prisma.timetablePlan.findMany({
      where: { tenantId, shiftId, deletedAt: null },
      select: { id: true, name: true, status: true },
    });
    const planIds = plans.map((p) => p.id);
    const [entryCount, sectionCount, publishedPlans] = await Promise.all([
      planIds.length
        ? this.prisma.timetablePlanEntry.count({
            where: {
              tenantId,
              planId: { in: planIds },
              deletedAt: null,
              status: { not: 'CANCELLED' },
            },
          })
        : 0,
      this.prisma.offeringSection.count({
        where: { tenantId, shiftId, deletedAt: null, status: 'active' },
      }),
      plans.filter((p) => p.status === 'PUBLISHED').length,
    ]);

    return {
      plans: plans.length,
      publishedPlans,
      draftPlans: plans.length - publishedPlans,
      scheduledSlots: entryCount,
      activeSections: sectionCount,
      plansDetail: plans,
    };
  }

  async classroomUtilization(tenantId: string, shiftId: string) {
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        classroomId: { not: null },
        OR: [{ shiftId }, { plan: { shiftId, deletedAt: null } }],
      },
      select: {
        classroomId: true,
        startTime: true,
        endTime: true,
        dayOfWeek: true,
      },
    });

    const byRoom = new Map<string, { slots: number; hours: number }>();
    for (const entry of entries) {
      if (!entry.classroomId) continue;
      const current = byRoom.get(entry.classroomId) ?? { slots: 0, hours: 0 };
      current.slots += 1;
      current.hours += this.hoursBetween(entry.startTime, entry.endTime);
      byRoom.set(entry.classroomId, current);
    }

    const rooms = byRoom.size
      ? await this.prisma.classroom.findMany({
          where: { tenantId, id: { in: Array.from(byRoom.keys()) } },
          select: { id: true, code: true, name: true, capacity: true },
        })
      : [];

    return rooms
      .map((room) => {
        const stats = byRoom.get(room.id)!;
        return {
          classroomId: room.id,
          code: room.code,
          name: room.name,
          capacity: room.capacity,
          scheduledSlots: stats.slots,
          scheduledHours: Number(stats.hours.toFixed(2)),
        };
      })
      .sort((a, b) => b.scheduledHours - a.scheduledHours);
  }

  async teachingHoursTotals(tenantId: string, shiftId: string) {
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        OR: [{ shiftId }, { plan: { shiftId, deletedAt: null } }],
      },
      select: { startTime: true, endTime: true, staffProfileId: true },
    });

    let totalHours = 0;
    const uniqueFaculty = new Set<string>();
    for (const entry of entries) {
      totalHours += this.hoursBetween(entry.startTime, entry.endTime);
      if (entry.staffProfileId) uniqueFaculty.add(entry.staffProfileId);
    }

    return {
      totalScheduledHours: Number(totalHours.toFixed(2)),
      totalSlots: entries.length,
      uniqueFaculty: uniqueFaculty.size,
      averageHoursPerFaculty: uniqueFaculty.size
        ? Number((totalHours / uniqueFaculty.size).toFixed(2))
        : 0,
    };
  }

  async departmentStaff(tenantId: string, shiftId: string) {
    const rows = await this.prisma.staffShiftAssignment.findMany({
      where: { tenantId, shiftId, active: true },
      include: {
        staffProfile: {
          select: {
            departmentId: true,
            department: { select: { id: true, code: true, name: true } },
            staffType: true,
          },
        },
      },
    });

    const map = new Map<
      string,
      {
        departmentId: string | null;
        departmentCode: string | null;
        departmentName: string;
        total: number;
        teaching: number;
      }
    >();

    for (const row of rows) {
      const dept = row.staffProfile.department;
      const key = dept?.id ?? 'unassigned';
      const current = map.get(key) ?? {
        departmentId: dept?.id ?? null,
        departmentCode: dept?.code ?? null,
        departmentName: dept?.name ?? 'Unassigned',
        total: 0,
        teaching: 0,
      };
      current.total += 1;
      if (row.staffProfile.staffType === 'TEACHING') current.teaching += 1;
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    );
  }
}
