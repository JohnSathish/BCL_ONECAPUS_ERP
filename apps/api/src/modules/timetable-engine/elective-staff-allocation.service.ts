import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { TimetableAllocationService } from './timetable-allocation.service';

export const ELECTIVE_FYUGP_CATEGORIES = [
  'MDC',
  'AEC',
  'SEC',
  'VAC',
  'VTC',
] as const;

export type ElectiveFyugpCategory = (typeof ELECTIVE_FYUGP_CATEGORIES)[number];

const DAY_NAMES = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const FYUGP_SEMESTERS_BY_MODE: Record<'ODD' | 'EVEN', number[]> = {
  ODD: [1, 3, 5],
  EVEN: [2, 4, 6],
};

/** Don Bosco Day Shift master grid (matches printed Arts/Science/Commerce routine). */
const INSTITUTIONAL_DAY_SHIFT_PERIODS: Array<{
  periodNo: number;
  label: string;
  start: string;
  end: string;
  isBreak?: boolean;
}> = [
  { periodNo: 1, label: 'Period 1', start: '09:45', end: '10:40' },
  { periodNo: 2, label: 'Period 2', start: '10:40', end: '11:25' },
  { periodNo: 3, label: 'Period 3', start: '11:25', end: '12:10' },
  { periodNo: 0, label: 'BREAK', start: '12:10', end: '12:40', isBreak: true },
  { periodNo: 4, label: 'Period 4', start: '12:40', end: '13:25' },
  { periodNo: 5, label: 'Period 5', start: '13:25', end: '14:10' },
  { periodNo: 6, label: 'Period 6', start: '14:10', end: '15:00' },
];

const DEFAULT_PERIODS = INSTITUTIONAL_DAY_SHIFT_PERIODS;

type ListFilters = {
  academicYearId?: string;
  shiftId?: string;
  semesterMode?: string;
  semesterSequence?: number;
  category?: string;
  q?: string;
};

export type AssignElectiveDto = {
  courseOfferingId: string;
  shiftId: string;
  sectionCode?: string;
  staffProfileId: string;
  teachingDepartmentId?: string | null;
  classroomId?: string | null;
  capacity?: number | null;
  workloadHours?: number | string | null;
  dayOfWeek?: number | null;
  daysOfWeek?: number[] | null;
  periodNo?: number | null;
  saturdayPeriodNo?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  planId?: string | null;
  timetablePlanEntryId?: string | null;
  notes?: string | null;
  academicYearId?: string | null;
};

@Injectable()
export class ElectiveStaffAllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocations: TimetableAllocationService,
  ) {}

  async assertCanAssignElectives(user: JwtUser) {
    const permissions = new Set(user.permissions ?? []);
    if (
      permissions.has('shift:timetable:manage') ||
      permissions.has('academic:timetable:manage') ||
      permissions.has('staff:assign-subjects')
    ) {
      return { isCentral: true as const, headedDepartmentIds: [] as string[] };
    }
    const headed = await this.allocations.departmentIdsForUser(
      user.tid,
      user.sub,
    );
    if (headed.length) {
      return { isCentral: false as const, headedDepartmentIds: headed };
    }
    throw new ForbiddenException(
      'Only Shift In-Charge, timetable managers, or HODs can assign elective faculty',
    );
  }

  async listRows(user: JwtUser, filters: ListFilters = {}) {
    await this.assertCanAssignElectives(user);
    const semesterMode =
      String(filters.semesterMode ?? 'ODD').toUpperCase() === 'EVEN'
        ? 'EVEN'
        : 'ODD';
    const allowedSemesters = filters.semesterSequence
      ? [filters.semesterSequence]
      : FYUGP_SEMESTERS_BY_MODE[semesterMode];
    const categoryFilter = this.normalizeCategory(filters.category);

    const offerings = await this.prisma.courseOffering.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        semesterSequence: { in: allowedSemesters },
        OR: [
          { category: { in: [...ELECTIVE_FYUGP_CATEGORIES] } },
          {
            categoryPoolId: { not: null },
            categoryPool: {
              categoryType: { in: [...ELECTIVE_FYUGP_CATEGORIES] },
            },
          },
        ],
      },
      include: {
        course: { include: { department: true } },
        categoryPool: true,
        programVersion: {
          include: { program: { include: { department: true } } },
        },
        sections: {
          where: {
            tenantId: user.tid,
            deletedAt: null,
            status: { in: ['active', 'ACTIVE'] },
            ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
          },
          include: {
            shift: true,
            classroom: true,
            staffProfile: { include: { department: true } },
          },
          orderBy: { sectionCode: 'asc' },
        },
      },
      orderBy: [
        { semesterSequence: 'asc' },
        { category: 'asc' },
        { displayOrder: 'asc' },
      ],
      take: 500,
    });

    const enrolledByOffering = await this.loadEnrolledDepartments(
      user.tid,
      offerings.map((o) => o.id),
    );

    const sectionIds = offerings.flatMap((o) => o.sections.map((s) => s.id));
    const planEntries = sectionIds.length
      ? await this.prisma.timetablePlanEntry.findMany({
          where: {
            tenantId: user.tid,
            offeringSectionId: { in: sectionIds },
            deletedAt: null,
            status: { not: 'CANCELLED' },
            fyugpCategory: {
              in: [...ELECTIVE_FYUGP_CATEGORIES],
            },
          },
          orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
        })
      : [];
    const entriesBySection = new Map<string, typeof planEntries>();
    for (const entry of planEntries) {
      if (!entry.offeringSectionId) continue;
      const list = entriesBySection.get(entry.offeringSectionId) ?? [];
      list.push(entry);
      entriesBySection.set(entry.offeringSectionId, list);
    }

    const q = (filters.q ?? '').trim().toLowerCase();
    const rows: Record<string, unknown>[] = [];

    for (const offering of offerings) {
      const category = this.resolveOfferingCategory(offering);
      if (
        !ELECTIVE_FYUGP_CATEGORIES.includes(category as ElectiveFyugpCategory)
      ) {
        continue;
      }
      if (categoryFilter && category !== categoryFilter) continue;

      const course = offering.course;
      const baseMeta = {
        courseOfferingId: offering.id,
        courseId: course.id,
        subjectCode: course.code,
        subjectName: course.title,
        category,
        semesterSequence: offering.semesterSequence,
        homeDepartmentId: course.departmentId,
        homeDepartment: course.department?.name ?? null,
        poolName: offering.categoryPool?.poolName ?? null,
        programme:
          offering.programVersion?.program?.code ??
          offering.programVersion?.program?.name ??
          null,
        weeklyHours:
          Number(course.theoryHoursPerWeek ?? 0) ||
          Number(course.credits ?? 0) ||
          0,
        enrolledTotal: enrolledByOffering.get(offering.id)?.total ?? 0,
        enrolledDepartments:
          enrolledByOffering.get(offering.id)?.departments ?? [],
      };

      if (!offering.sections.length) {
        if (
          q &&
          !`${course.code} ${course.title} ${category}`
            .toLowerCase()
            .includes(q)
        ) {
          continue;
        }
        rows.push({
          ...baseMeta,
          id: `offering:${offering.id}`,
          offeringSectionId: null,
          sectionCode: null,
          shiftId: filters.shiftId ?? null,
          shift: null,
          staffProfileId: null,
          staffName: null,
          staffCode: null,
          staffDepartment: null,
          classroomId: null,
          classroom: null,
          capacity: offering.capacity,
          teachingDepartmentId: null,
          slots: [],
          status: 'UNASSIGNED',
        });
        continue;
      }

      for (const section of offering.sections) {
        const rules = (section.reservationRules ?? {}) as Record<
          string,
          unknown
        >;
        const slots = (entriesBySection.get(section.id) ?? []).map((entry) => ({
          id: entry.id,
          planId: entry.planId,
          dayOfWeek: entry.dayOfWeek,
          dayName: DAY_NAMES[entry.dayOfWeek] ?? `Day ${entry.dayOfWeek}`,
          periodNo: entry.periodNo,
          startTime: this.formatTime(entry.startTime),
          endTime: this.formatTime(entry.endTime),
          classroomId: entry.classroomId,
          staffProfileId: entry.staffProfileId,
        }));
        if (
          q &&
          !`${course.code} ${course.title} ${category} ${section.sectionCode} ${section.staffProfile?.fullName ?? ''}`
            .toLowerCase()
            .includes(q)
        ) {
          continue;
        }
        rows.push({
          ...baseMeta,
          id: section.id,
          offeringSectionId: section.id,
          sectionCode: section.sectionCode,
          shiftId: section.shiftId,
          shift: section.shift?.name ?? null,
          staffProfileId: section.staffProfileId,
          staffName: section.staffProfile?.fullName ?? null,
          staffCode: section.staffProfile?.employeeCode ?? null,
          staffDepartment: section.staffProfile?.department?.name ?? null,
          classroomId: section.classroomId,
          classroom: section.classroom?.code ?? null,
          capacity: section.capacity,
          teachingDepartmentId:
            (rules.teachingDepartmentId as string | undefined) ?? null,
          slots,
          status: section.staffProfileId
            ? String(rules.allocationStatus ?? 'ASSIGNED')
            : 'UNASSIGNED',
        });
      }
    }

    return rows;
  }

  async listFacultyOptions(user: JwtUser, shiftId?: string) {
    await this.assertCanAssignElectives(user);
    const staff = await this.prisma.staffProfile.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        status: 'ACTIVE',
        // VTC/MDC/etc. often taught by accountants, lab staff, guests — not only TEACHING.
        staffType: {
          in: [
            'TEACHING',
            'teaching',
            'NON_TEACHING',
            'non_teaching',
            'GUEST',
            'guest',
            'VISITING',
            'visiting',
            'CONTRACT',
            'contract',
          ],
        },
      },
      include: {
        department: true,
        workloads: true,
        shiftAssignments: true,
      },
      orderBy: { fullName: 'asc' },
      take: 500,
    });
    return staff
      .filter((row) => {
        if (!shiftId) return true;
        return (
          row.primaryShiftId === shiftId ||
          row.shiftAssignments?.some((a) => a.shiftId === shiftId)
        );
      })
      .map((row) => ({
        id: row.id,
        fullName: row.fullName,
        employeeCode: row.employeeCode,
        shortCode: row.shortCode,
        departmentId: row.departmentId,
        department: row.department?.name ?? null,
        staffType: row.staffType,
        maxWeeklyHours: Number(row.workloads?.[0]?.weeklyHours ?? 24),
      }));
  }

  async listRoomOptions(user: JwtUser) {
    await this.assertCanAssignElectives(user);
    const rooms = await this.prisma.classroom.findMany({
      where: { tenantId: user.tid, deletedAt: null },
      include: { roomType: true },
      orderBy: { code: 'asc' },
      take: 300,
    });
    return rooms.map((room) => ({
      id: room.id,
      code: room.code,
      name: room.name,
      capacity: room.capacity,
      roomType: room.roomType?.name ?? null,
    }));
  }

  async listSlotOptions(user: JwtUser, shiftId?: string) {
    await this.assertCanAssignElectives(user);

    let useInstitutionalDayShift = !shiftId;
    if (shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: { tenantId: user.tid, id: shiftId, deletedAt: null },
        select: { code: true, name: true },
      });
      useInstitutionalDayShift = this.isInstitutionalDayShift(shift ?? {});
    }

    // Day Shift: always expose the published college grid (ignore stale templates).
    if (useInstitutionalDayShift) {
      const days = [1, 2, 3, 4, 5, 6];
      return days.flatMap((dayOfWeek) => {
        const periods =
          dayOfWeek === 6
            ? INSTITUTIONAL_DAY_SHIFT_PERIODS.filter(
                (p) => p.periodNo > 0,
              ).slice(0, 3)
            : INSTITUTIONAL_DAY_SHIFT_PERIODS;
        return periods.map((p) => ({
          dayOfWeek,
          dayName: DAY_NAMES[dayOfWeek],
          periodNo: p.periodNo,
          label: p.label,
          startTime: p.start,
          endTime: p.end,
          isBreak: Boolean(p.isBreak),
          slotTemplateId: null as string | null,
        }));
      });
    }

    const templates = await this.prisma.timetableSlotTemplate.findMany({
      where: {
        tenantId: user.tid,
        ...(shiftId ? { shiftId } : {}),
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
      take: 200,
    });
    if (templates.length) {
      const seen = new Set<string>();
      return templates
        .filter((t) => {
          const key = `${t.dayOfWeek}-${t.periodNo}-${this.formatTime(t.startTime)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((t) => ({
          dayOfWeek: t.dayOfWeek,
          dayName: DAY_NAMES[t.dayOfWeek] ?? `Day ${t.dayOfWeek}`,
          periodNo: t.periodNo,
          label: t.label,
          startTime: this.formatTime(t.startTime),
          endTime: this.formatTime(t.endTime),
          isBreak: Boolean((t as any).isBreak || (t as any).isLunch),
          slotTemplateId: t.id,
        }));
    }
    const days = [1, 2, 3, 4, 5, 6];
    return days.flatMap((dayOfWeek) =>
      DEFAULT_PERIODS.map((p) => ({
        dayOfWeek,
        dayName: DAY_NAMES[dayOfWeek],
        periodNo: p.periodNo,
        label: p.label,
        startTime: p.start,
        endTime: p.end,
        isBreak: Boolean(p.isBreak),
        slotTemplateId: null as string | null,
      })),
    );
  }

  private isInstitutionalDayShift(shift: {
    code?: string | null;
    name?: string | null;
  }) {
    const text = `${shift.code ?? ''} ${shift.name ?? ''}`.toLowerCase();
    return (
      !text.trim() ||
      text.includes('day') ||
      text.includes('shift ii') ||
      text.includes('shift_ii')
    );
  }

  async listDepartments(user: JwtUser) {
    await this.assertCanAssignElectives(user);
    return this.prisma.department.findMany({
      where: { tenantId: user.tid, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async assign(user: JwtUser, dto: AssignElectiveDto) {
    await this.assertCanAssignElectives(user);
    if (!dto.courseOfferingId?.trim()) {
      throw new BadRequestException('courseOfferingId is required');
    }
    if (!dto.shiftId?.trim()) {
      throw new BadRequestException('shiftId is required');
    }
    if (!dto.staffProfileId?.trim()) {
      throw new BadRequestException('staffProfileId is required');
    }

    const offering = await this.prisma.courseOffering.findFirst({
      where: {
        tenantId: user.tid,
        id: dto.courseOfferingId,
        deletedAt: null,
      },
      include: {
        course: true,
        categoryPool: true,
      },
    });
    if (!offering) throw new NotFoundException('Elective offering not found');
    const category = this.resolveOfferingCategory(offering);
    if (
      !ELECTIVE_FYUGP_CATEGORIES.includes(category as ElectiveFyugpCategory)
    ) {
      throw new BadRequestException(
        `Offering category ${category || '(empty)'} is not an elective (MDC/AEC/SEC/VAC/VTC)`,
      );
    }

    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId: user.tid,
        id: dto.staffProfileId,
        deletedAt: null,
        status: 'ACTIVE',
      },
    });
    if (!staff) {
      throw new BadRequestException('Invalid or inactive faculty selected');
    }

    const sectionCode = (dto.sectionCode ?? 'A').trim().toUpperCase() || 'A';
    let section = await this.prisma.offeringSection.findFirst({
      where: {
        tenantId: user.tid,
        courseOfferingId: offering.id,
        shiftId: dto.shiftId,
        sectionCode,
        deletedAt: null,
      },
    });

    if (!section) {
      section = await this.prisma.offeringSection.create({
        data: {
          tenantId: user.tid,
          courseOfferingId: offering.id,
          shiftId: dto.shiftId,
          sectionCode,
          capacity: dto.capacity ?? offering.capacity ?? 40,
          staffProfileId: dto.staffProfileId,
          classroomId: dto.classroomId ?? null,
          status: 'active',
          reservationRules: {
            teachingDepartmentId: dto.teachingDepartmentId ?? null,
            allocationStatus: 'DRAFT',
            notes: dto.notes ?? null,
            electiveAllocation: true,
          },
        },
      });
    } else {
      const rules = {
        ...((section.reservationRules ?? {}) as object),
        teachingDepartmentId: dto.teachingDepartmentId ?? null,
        notes: dto.notes ?? null,
        electiveAllocation: true,
        allocationStatus: 'DRAFT',
      };
      section = await this.prisma.offeringSection.update({
        where: { id: section.id },
        data: {
          staffProfileId: dto.staffProfileId,
          capacity:
            dto.capacity == null ? section.capacity : Number(dto.capacity),
          classroomId:
            dto.classroomId === undefined
              ? section.classroomId
              : dto.classroomId,
          reservationRules: rules as object,
        },
      });
    }

    await this.allocations.saveRow(user.tid, {
      offeringSectionId: section.id,
      staffProfileId: dto.staffProfileId,
      preferredRoomId: dto.classroomId ?? section.classroomId,
      workloadHours: dto.workloadHours,
      role: 'PRIMARY_FACULTY',
      status: 'DRAFT',
      notes: dto.notes,
      academicYearId: dto.academicYearId ?? undefined,
    });

    await this.prisma.timetablePlanEntry.updateMany({
      where: {
        tenantId: user.tid,
        offeringSectionId: section.id,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
      data: { staffProfileId: dto.staffProfileId },
    });
    // Programme grids (e.g. Sem 1 Garo) often hold the same MDC/VTC cell on a
    // different offering section. Stamp the allotted faculty onto those slots too.
    await this.prisma.timetablePlanEntry.updateMany({
      where: {
        tenantId: user.tid,
        courseId: offering.courseId,
        shiftId: dto.shiftId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        ...(offering.semesterSequence != null
          ? { semesterSequence: offering.semesterSequence }
          : {}),
      },
      data: {
        staffProfileId: dto.staffProfileId,
        ...(dto.classroomId ? { classroomId: dto.classroomId } : {}),
      },
    });

    const conflicts: { type: string; message: string }[] = [];
    const skippedDays: {
      dayOfWeek: number;
      dayName: string;
      reason: string;
    }[] = [];
    const scheduledDays: {
      id: string;
      planId: string;
      dayOfWeek: number;
      periodNo: number | null;
      startTime: Date;
      endTime: Date;
    }[] = [];

    const days = this.normalizeAssignDays(dto);
    const wantsSlot =
      days.length > 0 &&
      (dto.periodNo != null ||
        dto.saturdayPeriodNo != null ||
        Boolean(dto.startTime && dto.endTime));

    if (wantsSlot) {
      const plan = await this.resolvePlan(
        user,
        dto.shiftId,
        dto.planId,
        dto.academicYearId,
        offering.semesterSequence,
      );

      const allSlots = await this.listSlotOptions(user, dto.shiftId);
      const repeat = days.length > 1;
      for (const dayOfWeek of days) {
        if (dayOfWeek < 1 || dayOfWeek > 7) {
          throw new BadRequestException('dayOfWeek must be 1–7 (Mon–Sun)');
        }
        const { periodNo, startTime, endTime } = this.resolveDayPeriod(
          dto,
          dayOfWeek,
        );
        const dayHasPeriod = allSlots.some(
          (slot) =>
            slot.dayOfWeek === dayOfWeek &&
            (periodNo == null || slot.periodNo === periodNo),
        );
        if (!dayHasPeriod) {
          skippedDays.push({
            dayOfWeek,
            dayName: DAY_NAMES[dayOfWeek] ?? `Day ${dayOfWeek}`,
            reason:
              dayOfWeek === 6
                ? `Saturday only has periods 1–3. Set Saturday period to Period 2 (10:40–11:25) for VTC — Period ${periodNo ?? ''} is not on the Saturday grid.`
                : `Period ${periodNo ?? ''} is not on the ${DAY_NAMES[dayOfWeek]} grid`,
          });
          continue;
        }

        const dayConflicts: { type: string; message: string }[] = [];
        await this.ensureConflictFree(
          user.tid,
          {
            excludeEntryId: repeat
              ? undefined
              : (dto.timetablePlanEntryId ?? undefined),
            excludeOfferingSectionId: section.id,
            dayOfWeek,
            periodNo,
            startTime,
            endTime,
            staffProfileId: dto.staffProfileId,
            classroomId: dto.classroomId ?? section.classroomId,
          },
          dayConflicts,
        );
        if (
          dayConflicts.some(
            (c) => c.type === 'FACULTY_CLASH' || c.type === 'ROOM_CLASH',
          )
        ) {
          throw new BadRequestException({
            message: dayConflicts.map((c) => c.message).join(' · '),
            conflicts: dayConflicts,
          });
        }
        conflicts.push(...dayConflicts);

        const updateExisting =
          !repeat && dto.timetablePlanEntryId
            ? await this.prisma.timetablePlanEntry.findFirst({
                where: {
                  tenantId: user.tid,
                  id: dto.timetablePlanEntryId,
                  deletedAt: null,
                },
              })
            : null;

        if (updateExisting) {
          scheduledDays.push(
            await this.prisma.timetablePlanEntry.update({
              where: { id: updateExisting.id },
              data: {
                planId: plan.id,
                shiftId: dto.shiftId,
                dayOfWeek,
                periodNo,
                startTime,
                endTime,
                offeringSectionId: section.id,
                courseOfferingId: offering.id,
                courseId: offering.courseId,
                staffProfileId: dto.staffProfileId,
                classroomId: dto.classroomId ?? section.classroomId,
                semesterSequence: offering.semesterSequence,
                sectionCode: section.sectionCode,
                fyugpCategory: category,
                slotType: 'THEORY',
                status: 'SCHEDULED',
                source: 'MANUAL',
                notes: dto.notes ?? updateExisting.notes,
                metadata: {
                  ...((updateExisting.metadata ?? {}) as object),
                  electiveAllocation: true,
                  teachingDepartmentId: dto.teachingDepartmentId ?? null,
                  assignedById: user.sub,
                  assignedAt: new Date().toISOString(),
                },
              },
            }),
          );
          continue;
        }

        await this.prisma.timetablePlanEntry.updateMany({
          where: {
            tenantId: user.tid,
            offeringSectionId: section.id,
            dayOfWeek,
            deletedAt: null,
            status: { not: 'CANCELLED' },
          },
          data: { deletedAt: new Date(), status: 'CANCELLED' },
        });
        scheduledDays.push(
          await this.prisma.timetablePlanEntry.create({
            data: {
              tenantId: user.tid,
              planId: plan.id,
              shiftId: dto.shiftId,
              dayOfWeek,
              periodNo,
              startTime,
              endTime,
              offeringSectionId: section.id,
              courseOfferingId: offering.id,
              courseId: offering.courseId,
              staffProfileId: dto.staffProfileId,
              classroomId: dto.classroomId ?? section.classroomId,
              semesterSequence: offering.semesterSequence,
              sectionCode: section.sectionCode,
              fyugpCategory: category,
              slotType: 'THEORY',
              status: 'SCHEDULED',
              source: 'MANUAL',
              notes: dto.notes ?? null,
              metadata: {
                electiveAllocation: true,
                teachingDepartmentId: dto.teachingDepartmentId ?? null,
                assignedById: user.sub,
                assignedAt: new Date().toISOString(),
              },
            },
          }),
        );
      }

      if (days.length) {
        await this.prisma.timetablePlanEntry.updateMany({
          where: {
            tenantId: user.tid,
            offeringSectionId: section.id,
            dayOfWeek: { notIn: days },
            deletedAt: null,
            status: { not: 'CANCELLED' },
          },
          data: { deletedAt: new Date(), status: 'CANCELLED' },
        });
      }
    }

    const planEntry = scheduledDays[0] ?? null;

    const rows = await this.listRows(user, {
      shiftId: dto.shiftId,
      semesterSequence: offering.semesterSequence ?? undefined,
      category,
    });
    const row =
      rows.find((r) => r.offeringSectionId === section!.id) ??
      rows.find((r) => r.courseOfferingId === offering.id);

    return {
      row,
      planEntry: planEntry
        ? {
            id: planEntry.id,
            planId: planEntry.planId,
            dayOfWeek: planEntry.dayOfWeek,
            dayName: DAY_NAMES[planEntry.dayOfWeek],
            periodNo: planEntry.periodNo,
            startTime: this.formatTime(planEntry.startTime),
            endTime: this.formatTime(planEntry.endTime),
          }
        : null,
      planEntries: scheduledDays.map((entry) => ({
        id: entry.id,
        planId: entry.planId,
        dayOfWeek: entry.dayOfWeek,
        dayName: DAY_NAMES[entry.dayOfWeek],
        periodNo: entry.periodNo,
        startTime: this.formatTime(entry.startTime),
        endTime: this.formatTime(entry.endTime),
      })),
      skippedDays,
      conflicts,
    };
  }

  private resolveDayPeriod(
    dto: AssignElectiveDto,
    dayOfWeek: number,
  ): { periodNo: number | null; startTime: Date; endTime: Date } {
    const isSaturday = dayOfWeek === 6;
    const periodNo =
      isSaturday && dto.saturdayPeriodNo != null
        ? Number(dto.saturdayPeriodNo)
        : dto.periodNo != null
          ? Number(dto.periodNo)
          : null;
    const period =
      periodNo != null
        ? DEFAULT_PERIODS.find((p) => p.periodNo === periodNo)
        : null;
    const startSrc = isSaturday
      ? (period?.start ?? '10:40')
      : (dto.startTime ?? period?.start ?? '09:45');
    const endSrc = isSaturday
      ? (period?.end ?? '11:25')
      : (dto.endTime ?? period?.end ?? '10:40');
    return {
      periodNo,
      startTime: this.parseTime(startSrc),
      endTime: this.parseTime(endSrc),
    };
  }

  private normalizeAssignDays(dto: AssignElectiveDto): number[] {
    const fromList = (dto.daysOfWeek ?? [])
      .map((d) => Number(d))
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
    if (fromList.length) {
      return [...new Set(fromList)].sort((a, b) => a - b);
    }
    if (dto.dayOfWeek != null) return [Number(dto.dayOfWeek)];
    return [];
  }

  private async loadEnrolledDepartments(
    tenantId: string,
    offeringIds: string[],
  ) {
    const empty = new Map<
      string,
      { total: number; departments: Array<{ name: string; students: number }> }
    >();
    if (!offeringIds.length) return empty;
    const lines = await this.prisma.semesterRegistrationLine.findMany({
      where: {
        tenantId,
        offeringId: { in: offeringIds },
        status: { notIn: ['rejected'] },
        registration: { student: { deletedAt: null } },
      },
      select: {
        offeringId: true,
        registration: {
          select: {
            student: {
              select: {
                department: { select: { name: true } },
                programVersion: {
                  select: {
                    program: {
                      select: {
                        name: true,
                        department: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const counts = new Map<string, Map<string, number>>();
    for (const line of lines) {
      const dept =
        line.registration.student.department?.name ??
        line.registration.student.programVersion?.program.department?.name ??
        line.registration.student.programVersion?.program.name ??
        'Unassigned';
      const byDept = counts.get(line.offeringId) ?? new Map<string, number>();
      byDept.set(dept, (byDept.get(dept) ?? 0) + 1);
      counts.set(line.offeringId, byDept);
    }
    const result = empty;
    for (const [offeringId, byDept] of counts) {
      const departments = [...byDept.entries()]
        .map(([name, students]) => ({ name, students }))
        .sort((a, b) => b.students - a.students);
      result.set(offeringId, {
        total: departments.reduce((sum, row) => sum + row.students, 0),
        departments,
      });
    }
    return result;
  }

  private async resolvePlan(
    user: JwtUser,
    shiftId: string,
    planId?: string | null,
    academicYearId?: string | null,
    semesterSequence?: number | null,
  ) {
    if (planId) {
      const plan = await this.prisma.timetablePlan.findFirst({
        where: { tenantId: user.tid, id: planId, deletedAt: null },
      });
      if (!plan) throw new NotFoundException('Timetable plan not found');
      return plan;
    }
    const existing = await this.prisma.timetablePlan.findFirst({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        shiftId,
        status: {
          in: ['DRAFT', 'GENERATED', 'REVIEW', 'APPROVED', 'PUBLISHED'],
        },
        ...(academicYearId ? { academicYearId } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    if (existing) return existing;

    return this.prisma.timetablePlan.create({
      data: {
        tenantId: user.tid,
        shiftId,
        academicYearId: academicYearId ?? undefined,
        semesterSequence: semesterSequence ?? undefined,
        name: 'Elective / Pool Timetable',
        scopeType: 'SHIFT',
        status: 'DRAFT',
        approvalState: 'DRAFT',
        metadata: {
          electiveAllocationPlan: true,
          createdById: user.sub,
        },
        createdById: user.sub,
      },
    });
  }

  private async ensureConflictFree(
    tenantId: string,
    input: {
      excludeEntryId?: string;
      excludeOfferingSectionId?: string;
      dayOfWeek: number;
      periodNo: number | null;
      startTime: Date;
      endTime: Date;
      staffProfileId: string;
      classroomId?: string | null;
    },
    sink: { type: string; message: string }[],
  ) {
    const facultyClash = await this.prisma.timetablePlanEntry.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        staffProfileId: input.staffProfileId,
        dayOfWeek: input.dayOfWeek,
        ...(input.excludeEntryId ? { id: { not: input.excludeEntryId } } : {}),
        ...(input.excludeOfferingSectionId
          ? { offeringSectionId: { not: input.excludeOfferingSectionId } }
          : {}),
        ...(input.periodNo != null
          ? { periodNo: input.periodNo }
          : {
              startTime: { lt: input.endTime },
              endTime: { gt: input.startTime },
            }),
      },
      include: { plan: { select: { name: true } } },
    });
    if (facultyClash) {
      sink.push({
        type: 'FACULTY_CLASH',
        message: `Faculty clash on ${DAY_NAMES[input.dayOfWeek]} period ${input.periodNo ?? ''} (${facultyClash.plan?.name ?? 'another plan'})`,
      });
    }

    if (input.classroomId) {
      const roomClash = await this.prisma.timetablePlanEntry.findFirst({
        where: {
          tenantId,
          deletedAt: null,
          status: { not: 'CANCELLED' },
          classroomId: input.classroomId,
          dayOfWeek: input.dayOfWeek,
          ...(input.excludeEntryId
            ? { id: { not: input.excludeEntryId } }
            : {}),
          ...(input.excludeOfferingSectionId
            ? { offeringSectionId: { not: input.excludeOfferingSectionId } }
            : {}),
          ...(input.periodNo != null
            ? { periodNo: input.periodNo }
            : {
                startTime: { lt: input.endTime },
                endTime: { gt: input.startTime },
              }),
        },
        include: { plan: { select: { name: true } } },
      });
      if (roomClash) {
        sink.push({
          type: 'ROOM_CLASH',
          message: `Room clash on ${DAY_NAMES[input.dayOfWeek]} period ${input.periodNo ?? ''} (${roomClash.plan?.name ?? 'another plan'})`,
        });
      }
    }
  }

  private resolveOfferingCategory(offering: {
    category?: string | null;
    categoryPool?: { categoryType?: string | null } | null;
  }) {
    return String(
      offering.category ?? offering.categoryPool?.categoryType ?? '',
    )
      .trim()
      .toUpperCase();
  }

  private normalizeCategory(value?: string) {
    if (!value?.trim()) return null;
    const cat = value.trim().toUpperCase();
    return ELECTIVE_FYUGP_CATEGORIES.includes(cat as ElectiveFyugpCategory)
      ? cat
      : null;
  }

  private formatTime(value: Date | string | null | undefined) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(11, 16);
  }

  private parseTime(hhmm: string) {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm.trim());
    if (!match) {
      throw new BadRequestException(`Invalid time "${hhmm}" (use HH:mm)`);
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] ?? 0);
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
  }
}
