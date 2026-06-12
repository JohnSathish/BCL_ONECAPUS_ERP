import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { parseTimeToDate } from '../../common/utils/shift-scope.util';
import { PrismaService } from '../../database/prisma.service';
import type { AcademicCycle } from '../academic-lifecycle/utils/cycle.util';

type Slot = {
  id?: string;
  dayOfWeek: number;
  periodNo: number;
  label: string;
  startTime: Date;
  endTime: Date;
  durationMinutes?: number;
  isBreak?: boolean;
  isLunch?: boolean;
  isSaturdayHalfDay?: boolean;
};

type Occupancy = {
  staff: Map<string, string[]>;
  room: Map<string, string[]>;
  section: Map<string, string[]>;
};

const FYUGP_SEMESTERS_BY_CYCLE: Record<AcademicCycle, number[]> = {
  ODD: [1, 3, 5],
  EVEN: [2, 4, 6],
};

const COMMON_STREAM_CATEGORIES = new Set(['AEC', 'SEC', 'VAC', 'MDC']);

const DEFAULT_STREAM_DEPARTMENTS: Record<string, string[]> = {
  ARTS: [
    'ECONOMICS',
    'EDUCATION',
    'ENGLISH',
    'GARO',
    'GEOGRAPHY',
    'HISTORY',
    'PHILOSOPHY',
    'POLITICAL SCIENCE',
    'SOCIOLOGY',
  ],
  SCIENCE: ['BOTANY', 'CHEMISTRY', 'MATHEMATICS', 'ZOOLOGY', 'PHYSICS'],
  COMMERCE: ['COMMERCE'],
};

@Injectable()
export class TimetableGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(tenantId: string, planId: string) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Timetable plan not found');

    const scope = await this.resolveGenerationScope(tenantId, plan);
    if (
      plan.semesterSequence &&
      !scope.allowedSemesters.includes(plan.semesterSequence)
    ) {
      throw new BadRequestException(
        `Semester ${plan.semesterSequence} is inactive in current ${scope.semesterMode} academic cycle.`,
      );
    }

    const slots = (await this.ensureSlotTemplates(tenantId, plan)).filter(
      (slot) => !slot.isBreak && !slot.isLunch,
    );
    await this.prisma.timetablePlanEntry.deleteMany({
      where: {
        tenantId,
        planId,
        source: 'AUTO',
        isLocked: false,
      },
    });

    const sections = await this.prisma.offeringSection.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['active', 'ACTIVE'] },
        ...(plan.shiftId ? { shiftId: plan.shiftId } : {}),
        courseOffering: {
          deletedAt: null,
          semesterSequence: { in: scope.targetSemesters },
          ...(plan.programVersionId
            ? { programVersionId: plan.programVersionId }
            : {}),
          ...(plan.semesterId ? { semesterId: plan.semesterId } : {}),
          ...(plan.semesterSequence
            ? { semesterSequence: plan.semesterSequence }
            : {}),
          course: { requiresTimetableSlots: true, deletedAt: null },
        },
      },
      include: {
        classroom: { include: { roomType: true } },
        staffProfile: { include: { department: true } },
        eligibleStreams: { include: { stream: true } },
        subjectAssignments: {
          where: {
            AND: [
              ...(plan.shiftId
                ? [{ OR: [{ shiftId: plan.shiftId }, { shiftId: null }] }]
                : []),
              ...(plan.academicYearId
                ? [
                    {
                      OR: [
                        { academicYearId: plan.academicYearId },
                        { academicYearId: null },
                      ],
                    },
                  ]
                : []),
            ],
          },
          include: { staffProfile: { include: { department: true } } },
          orderBy: { isPrimaryFaculty: 'desc' },
        },
        courseOffering: {
          include: {
            course: { include: { department: true } },
            programVersion: {
              include: { program: { include: { department: true } } },
            },
            semester: true,
          },
        },
      },
      orderBy: [{ sectionCode: 'asc' }],
    });
    const scopedSections = sections.filter((section: any) =>
      this.sectionMatchesStream(section, scope),
    );
    const availableRooms = await this.prisma.classroom.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        availableForTimetable: true,
      } as any,
      include: { roomType: true },
      orderBy: [{ capacity: 'asc' }, { code: 'asc' }],
    });

    const lockedEntries = await this.prisma.timetablePlanEntry.findMany({
      where: { tenantId, planId, deletedAt: null, isLocked: true },
    });
    const occupancy = this.buildOccupancy(lockedEntries);
    const entries: any[] = [];
    const sortedSections = [...scopedSections].sort(
      (a: any, b: any) =>
        this.categoryRank(a.courseOffering?.category) -
        this.categoryRank(b.courseOffering?.category),
    );

    for (const section of sortedSections as any[]) {
      const course = section.courseOffering.course;
      const category = section.courseOffering.category ?? course.courseType;
      const facultyTeam = this.facultyTeamForSection(section);
      const facultyId =
        facultyTeam[0]?.staffProfileId ?? section.staffProfileId;
      const classroomId =
        this.compatibleRoomForSection(
          section,
          course,
          category,
          availableRooms,
          plan.shiftId,
        )?.id ?? section.classroomId;
      const theorySlots = Math.max(
        course.theoryHoursPerWeek || course.totalTheoryContactHours || 0,
        course.hasPractical ? 0 : Number(course.credits ?? 0),
      );
      const practicalHours = course.practicalHoursPerWeek || 0;

      await this.placeTheorySlots({
        entries,
        occupancy,
        slots,
        plan,
        section,
        course,
        facultyId,
        facultyTeam,
        classroomId,
        category,
        count: Math.min(Math.ceil(theorySlots), 6),
      });

      if (course.hasPractical || course.labRequired || practicalHours > 0) {
        await this.placePracticalBlock({
          entries,
          occupancy,
          slots,
          plan,
          section,
          course,
          facultyId,
          facultyTeam,
          classroomId,
          category,
        });
      }
    }

    if (entries.length) {
      await this.prisma.timetablePlanEntry.createMany({ data: entries });
    }

    await this.prisma.timetablePlan.update({
      where: { id: planId },
      data: {
        status: 'DRAFT',
        approvalState: 'DRAFT',
        generatedAt: new Date(),
        generationSummary: {
          generatedEntries: entries.length,
          consideredSections: scopedSections.length,
          skippedSections: sections.length - sortedSections.length,
          semesterMode: scope.semesterMode,
          allowedSemesters: scope.allowedSemesters,
          blockedSemesters: scope.blockedSemesters,
          stream: scope.stream
            ? {
                id: scope.stream.id,
                code: scope.stream.code,
                name: scope.stream.name,
              }
            : null,
          shiftId: plan.shiftId,
        },
      },
    });

    return {
      planId,
      generatedEntries: entries.length,
      consideredSections: scopedSections.length,
      semesterMode: scope.semesterMode,
      allowedSemesters: scope.allowedSemesters,
      blockedSemesters: scope.blockedSemesters,
      stream: scope.stream,
    };
  }

  async ensureSlotTemplatesForPlan(tenantId: string, planId: string) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Timetable plan not found');
    return this.ensureSlotTemplates(tenantId, plan);
  }

  private async ensureSlotTemplates(
    tenantId: string,
    plan: any,
  ): Promise<Slot[]> {
    const shift = plan.shiftId
      ? await this.prisma.shift.findFirst({
          where: { tenantId, id: plan.shiftId, deletedAt: null },
        })
      : null;
    const existing = await this.prisma.timetableSlotTemplate.findMany({
      where: { tenantId, planId: plan.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    if (existing.length) {
      if (
        this.isInstitutionalDayShift(shift ?? {}) &&
        !this.hasInstitutionalDayShiftShape(existing)
      ) {
        const protectedEntries = await this.prisma.timetablePlanEntry.count({
          where: {
            tenantId,
            planId: plan.id,
            deletedAt: null,
            OR: [{ isLocked: true }, { source: { not: 'AUTO' } }],
          },
        });
        if (!protectedEntries) {
          await this.prisma.timetableSlotTemplate.deleteMany({
            where: { tenantId, planId: plan.id },
          });
        } else {
          return existing;
        }
      } else {
        return existing;
      }
    }
    const rows = this.buildSlotRowsForShift(tenantId, plan, shift);

    await this.prisma.timetableSlotTemplate.createMany({ data: rows });
    return this.prisma.timetableSlotTemplate.findMany({
      where: { tenantId, planId: plan.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  private buildSlotRowsForShift(tenantId: string, plan: any, shift: any) {
    const customPolicy = (plan.metadata as any)?.slotPolicy;
    if (customPolicy?.periods?.length) {
      return this.buildRowsFromCustomPolicy(tenantId, plan, customPolicy);
    }
    if (!shift || this.isInstitutionalDayShift(shift)) {
      return this.buildInstitutionalDayShiftRows(tenantId, plan);
    }
    return this.buildGenericShiftRows(tenantId, plan, shift);
  }

  private buildInstitutionalDayShiftRows(tenantId: string, plan: any) {
    const weekdayPeriods = [
      [1, 'Period 1', '09:45', '10:30'],
      [2, 'Period 2', '10:30', '11:15'],
      [3, 'Period 3', '11:15', '12:00'],
      [4, 'Period 4', '12:00', '12:45'],
      [0, 'BREAK', '12:45', '13:15'],
      [5, 'Period 5', '13:15', '14:00'],
      [6, 'Period 6', '14:00', '14:45'],
      [7, 'Period 7', '14:45', '15:30'],
    ] as const;
    const saturdayPeriods = weekdayPeriods.slice(0, 4);
    const rows: any[] = [];
    for (let day = 1; day <= 6; day += 1) {
      const source = day === 6 ? saturdayPeriods : weekdayPeriods;
      for (const [periodNo, label, start, end] of source) {
        const isBreak = label === 'BREAK';
        rows.push({
          tenantId,
          planId: plan.id,
          shiftId: plan.shiftId,
          dayOfWeek: day,
          periodNo,
          label,
          startTime: parseTimeToDate(`${start}:00`),
          endTime: parseTimeToDate(`${end}:00`),
          durationMinutes: this.diffMinutes(start, end),
          isBreak,
          isLunch: isBreak,
          isSaturdayHalfDay: day === 6,
          allowedCategories: isBreak ? [] : undefined,
          metadata: {
            policy: 'INSTITUTIONAL_DAY_SHIFT',
            totalPeriods: day === 6 ? 4 : 7,
            saturdayBlockedPeriods: day === 6 ? [5, 6, 7] : [],
          },
        });
      }
    }
    return rows;
  }

  private buildGenericShiftRows(tenantId: string, plan: any, shift: any) {
    const start = shift?.startTime
      ? this.timeToMinutes(shift.startTime)
      : this.timeStringToMinutes('09:00');
    const periodMinutes = 60;
    const rows: any[] = [];
    for (let day = 1; day <= 6; day += 1) {
      const maxPeriods = day === 6 ? 4 : 6;
      let cursor = start;
      for (let period = 1; period <= maxPeriods; period += 1) {
        rows.push({
          tenantId,
          planId: plan.id,
          shiftId: plan.shiftId,
          dayOfWeek: day,
          periodNo: period,
          label: `Period ${period}`,
          startTime: this.minutesToDate(cursor),
          endTime: this.minutesToDate(cursor + periodMinutes),
          durationMinutes: periodMinutes,
          isSaturdayHalfDay: day === 6,
          metadata: { policy: 'GENERIC_SHIFT' },
        });
        cursor += periodMinutes;
      }
    }
    return rows;
  }

  private buildRowsFromCustomPolicy(tenantId: string, plan: any, policy: any) {
    const workingDays = Array.isArray(policy.workingDays)
      ? policy.workingDays
      : [1, 2, 3, 4, 5, 6];
    const saturdayPeriods = Number(policy.saturdayPeriods ?? 4);
    const rows: any[] = [];
    for (const day of workingDays) {
      for (const period of policy.periods) {
        if (
          day === 6 &&
          policy.saturdayHalfDay &&
          period.periodNo > saturdayPeriods
        ) {
          continue;
        }
        rows.push({
          tenantId,
          planId: plan.id,
          shiftId: plan.shiftId,
          dayOfWeek: day,
          periodNo: period.periodNo ?? 0,
          label: period.label ?? `Period ${period.periodNo}`,
          startTime: parseTimeToDate(`${period.startTime}:00`),
          endTime: parseTimeToDate(`${period.endTime}:00`),
          durationMinutes: this.diffMinutes(period.startTime, period.endTime),
          isBreak: Boolean(period.isBreak),
          isLunch: Boolean(period.isLunch),
          isSaturdayHalfDay: day === 6 && Boolean(policy.saturdayHalfDay),
          allowedCategories: period.allowedCategories ?? undefined,
          metadata: { policy: 'CUSTOM_SHIFT_POLICY' },
        });
      }
    }
    return rows;
  }

  private async resolveGenerationScope(tenantId: string, plan: any) {
    const metadata = (plan.metadata ?? {}) as any;
    const config = await this.prisma.institutionAcademicConfig.findFirst({
      where: {
        tenantId,
        ...(plan.institutionId ? { institutionId: plan.institutionId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    const semesterMode = this.normalizeCycle(
      config?.currentCycle ?? metadata.semesterMode ?? 'ODD',
    );
    const allowedSemesters = FYUGP_SEMESTERS_BY_CYCLE[semesterMode];
    const blockedSemesters =
      semesterMode === 'ODD'
        ? FYUGP_SEMESTERS_BY_CYCLE.EVEN
        : FYUGP_SEMESTERS_BY_CYCLE.ODD;
    const requestedSemesters: number[] = plan.semesterSequence
      ? [plan.semesterSequence]
      : Array.isArray(metadata.semesters)
        ? metadata.semesters.map(Number)
        : allowedSemesters;
    const targetSemesters = requestedSemesters.filter((semester) =>
      allowedSemesters.includes(semester),
    );
    const streamId = metadata.streamId || metadata.academicStreamId || null;
    const stream = streamId
      ? await this.prisma.academicStream.findFirst({
          where: { id: streamId, tenantId, deletedAt: null, isActive: true },
        })
      : null;
    return {
      semesterMode,
      allowedSemesters,
      blockedSemesters,
      targetSemesters,
      stream,
      streamDepartments: this.streamDepartments(stream),
    };
  }

  private sectionMatchesStream(
    section: any,
    scope: { stream: any; streamDepartments: Set<string> },
  ) {
    if (!scope.stream) return true;
    const category = String(
      section.courseOffering?.category ??
        section.courseOffering?.course?.courseType ??
        '',
    ).toUpperCase();
    const eligibleStreamIds = (section.eligibleStreams ?? []).map(
      (row: any) => row.academicStreamId,
    );
    if (eligibleStreamIds.length) {
      return eligibleStreamIds.includes(scope.stream.id);
    }
    if (COMMON_STREAM_CATEGORIES.has(category)) {
      return true;
    }
    const departmentCandidates = [
      section.courseOffering?.course?.department,
      section.courseOffering?.programVersion?.program?.department,
    ].filter(Boolean);
    return departmentCandidates.some((department: any) =>
      scope.streamDepartments.has(
        this.normalizeDepartmentName(department?.name ?? department?.code),
      ),
    );
  }

  private streamDepartments(stream?: { code?: string; name?: string } | null) {
    const key = this.normalizeDepartmentName(
      stream?.code ?? stream?.name ?? '',
    );
    const byCode = DEFAULT_STREAM_DEPARTMENTS[key] ?? [];
    const byName =
      DEFAULT_STREAM_DEPARTMENTS[
        this.normalizeDepartmentName(stream?.name ?? '')
      ] ?? [];
    return new Set(
      [...byCode, ...byName].map((value) =>
        this.normalizeDepartmentName(value),
      ),
    );
  }

  private normalizeCycle(value: unknown): AcademicCycle {
    return String(value ?? 'ODD').toUpperCase() === 'EVEN' ? 'EVEN' : 'ODD';
  }

  private async placeTheorySlots(params: {
    entries: any[];
    occupancy: Occupancy;
    slots: Slot[];
    plan: any;
    section: any;
    course: any;
    facultyId?: string;
    facultyTeam?: any[];
    classroomId?: string;
    category?: string;
    count: number;
  }) {
    if (!params.count) return;
    let placed = 0;
    const usedDays = new Set<number>();
    for (const slot of this.preferredSlots(params.slots, params.category)) {
      if (placed >= params.count) break;
      if (usedDays.has(slot.dayOfWeek) && placed < 3) continue;
      if (!this.canUseSlot(params.occupancy, slot, params)) continue;
      params.entries.push(this.entryData(params, slot, 'THEORY'));
      this.markSlot(params.occupancy, slot, params);
      usedDays.add(slot.dayOfWeek);
      placed += 1;
    }
  }

  private async placePracticalBlock(params: {
    entries: any[];
    occupancy: Occupancy;
    slots: Slot[];
    plan: any;
    section: any;
    course: any;
    facultyId?: string;
    facultyTeam?: any[];
    classroomId?: string;
    category?: string;
  }) {
    const byDay = new Map<number, Slot[]>();
    for (const slot of params.slots) {
      byDay.set(slot.dayOfWeek, [...(byDay.get(slot.dayOfWeek) ?? []), slot]);
    }
    for (const daySlots of byDay.values()) {
      for (let index = 0; index < daySlots.length - 1; index += 1) {
        const block = [daySlots[index], daySlots[index + 1]];
        if (
          block.every((slot) => this.canUseSlot(params.occupancy, slot, params))
        ) {
          for (const slot of block) {
            params.entries.push(this.entryData(params, slot, 'LAB'));
            this.markSlot(params.occupancy, slot, params);
          }
          return;
        }
      }
    }
  }

  private preferredSlots(slots: Slot[], category?: string) {
    const rank = this.categoryRank(category);
    return [...slots]
      .filter((slot) => !slot.isBreak && !slot.isLunch)
      .sort((a, b) => {
        if (rank <= 1 && a.dayOfWeek !== b.dayOfWeek)
          return a.dayOfWeek - b.dayOfWeek;
        if (a.dayOfWeek === 6 && b.dayOfWeek !== 6) return 1;
        if (b.dayOfWeek === 6 && a.dayOfWeek !== 6) return -1;
        return a.periodNo - b.periodNo;
      });
  }

  private canUseSlot(
    occupancy: Occupancy,
    slot: Slot,
    params: { facultyId?: string; classroomId?: string; section: any },
  ) {
    if (slot.isBreak || slot.isLunch) return false;
    const key = this.slotKey(slot);
    if (
      params.facultyId &&
      occupancy.staff.get(params.facultyId)?.includes(key)
    ) {
      return false;
    }
    if (
      params.classroomId &&
      occupancy.room.get(params.classroomId)?.includes(key)
    ) {
      return false;
    }
    if (
      params.section.id &&
      occupancy.section.get(params.section.id)?.includes(key)
    ) {
      return false;
    }
    return true;
  }

  private markSlot(
    occupancy: Occupancy,
    slot: Slot,
    params: { facultyId?: string; classroomId?: string; section: any },
  ) {
    const key = this.slotKey(slot);
    if (params.facultyId) this.pushMap(occupancy.staff, params.facultyId, key);
    if (params.classroomId)
      this.pushMap(occupancy.room, params.classroomId, key);
    this.pushMap(occupancy.section, params.section.id, key);
  }

  private entryData(
    params: {
      plan: any;
      section: any;
      course: any;
      facultyId?: string;
      facultyTeam?: any[];
      classroomId?: string;
      category?: string;
    },
    slot: Slot,
    slotType: string,
  ) {
    const category = params.category ?? 'GENERAL';
    const isCombined = ['MDC', 'AEC', 'SEC', 'VAC'].includes(category);
    return {
      tenantId: params.plan.tenantId,
      planId: params.plan.id,
      slotTemplateId: slot.id,
      shiftId: params.section.shiftId ?? params.plan.shiftId,
      dayOfWeek: slot.dayOfWeek,
      periodNo: slot.periodNo,
      startTime: slot.startTime,
      endTime: slot.endTime,
      offeringSectionId: params.section.id,
      courseOfferingId: params.section.courseOfferingId,
      courseId: params.course.id,
      staffProfileId: params.facultyId,
      classroomId: params.classroomId,
      semesterSequence: params.section.courseOffering.semesterSequence,
      sectionCode: params.section.sectionCode,
      slotType,
      fyugpCategory: category,
      isCombined,
      combinedGroupKey: isCombined
        ? `${category}:${params.course.id}:${slot.dayOfWeek}:${slot.periodNo}`
        : null,
      source: 'AUTO',
      metadata: {
        courseCode: params.course.code,
        courseTitle: params.course.title,
        facultyTeam: params.facultyTeam ?? [],
        schedulingMode:
          (params.section.reservationRules as any)?.facultySchedulingMode ??
          'PRIMARY_PER_SLOT',
      },
    };
  }

  private facultyTeamForSection(section: any) {
    const assignments = section.subjectAssignments ?? [];
    return assignments.map((assignment: any) => ({
      staffProfileId: assignment.staffProfileId,
      role: assignment.isPrimaryFaculty ? 'PRIMARY_FACULTY' : 'CO_FACULTY',
      allocationPercent: assignment.isPrimaryFaculty ? 100 : null,
      weeklyHours:
        assignment.workloadHours == null
          ? null
          : Number(assignment.workloadHours),
      isPrimary: assignment.isPrimaryFaculty,
      shortCode: assignment.staffProfile?.shortCode ?? null,
      employeeCode: assignment.staffProfile?.employeeCode ?? null,
      staffName: assignment.staffProfile?.fullName ?? null,
    }));
  }

  private buildOccupancy(entries: any[]): Occupancy {
    const occupancy: Occupancy = {
      staff: new Map(),
      room: new Map(),
      section: new Map(),
    };
    for (const entry of entries) {
      const key = this.slotKey(entry);
      if (entry.staffProfileId)
        this.pushMap(occupancy.staff, entry.staffProfileId, key);
      if (entry.classroomId)
        this.pushMap(occupancy.room, entry.classroomId, key);
      if (entry.offeringSectionId) {
        this.pushMap(occupancy.section, entry.offeringSectionId, key);
      }
    }
    return occupancy;
  }

  private pushMap(map: Map<string, string[]>, key: string, value: string) {
    map.set(key, [...(map.get(key) ?? []), value]);
  }

  private slotKey(slot: { dayOfWeek: number; startTime: Date; endTime: Date }) {
    return `${slot.dayOfWeek}:${slot.startTime.toISOString()}:${slot.endTime.toISOString()}`;
  }

  private categoryRank(category?: string | null) {
    const normalized = String(category ?? '').toUpperCase();
    const order = ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'];
    const index = order.indexOf(normalized);
    return index === -1 ? 99 : index;
  }

  private compatibleRoomForSection(
    section: any,
    course: any,
    category: string | null | undefined,
    rooms: any[],
    shiftId?: string | null,
  ) {
    const preferred = rooms.find((room) => room.id === section.classroomId);
    if (
      preferred &&
      this.roomMatchesSection(preferred, section, course, category, shiftId)
    ) {
      return preferred;
    }
    return rooms.find((room) =>
      this.roomMatchesSection(room, section, course, category, shiftId),
    );
  }

  private roomMatchesSection(
    room: any,
    section: any,
    course: any,
    category: string | null | undefined,
    shiftId?: string | null,
  ) {
    const normalizedCategory = String(
      category ?? course?.courseType ?? '',
    ).toUpperCase();
    const requiredCapacity = Number(section.capacity ?? 0);
    const capacity = Number(
      course?.hasPractical || course?.labRequired
        ? (room.practicalCapacity ?? room.capacity ?? 0)
        : (room.capacity ?? 0),
    );
    if (requiredCapacity && capacity < requiredCapacity) return false;

    const shifts = Array.isArray(room.shiftAvailability)
      ? room.shiftAvailability
      : [];
    if (shiftId && shifts.length && !shifts.includes(shiftId)) return false;

    if ((course?.hasPractical || course?.labRequired) && !this.isLabRoom(room))
      return false;
    if (
      COMMON_STREAM_CATEGORIES.has(normalizedCategory) &&
      !this.isSharedHallCompatible(room, normalizedCategory)
    )
      return false;

    const restrictionMode = String(
      room.departmentRestrictionMode ?? 'ALL',
    ).toUpperCase();
    const deptId =
      course?.departmentId ??
      course?.department?.id ??
      section.courseOffering?.programVersion?.program?.departmentId;
    const restricted = Array.isArray(room.restrictedDepartmentIds)
      ? room.restrictedDepartmentIds
      : [];
    if (
      restrictionMode === 'ONLY' &&
      deptId &&
      restricted.length &&
      !restricted.includes(deptId)
    ) {
      return false;
    }
    if (restrictionMode === 'EXCLUDE' && deptId && restricted.includes(deptId))
      return false;
    return true;
  }

  private isLabRoom(room?: any) {
    const text =
      `${room?.code ?? ''} ${room?.name ?? ''} ${room?.roomType?.code ?? ''} ${room?.roomType?.name ?? ''}`.toLowerCase();
    return (
      Boolean(room?.isPracticalLab) ||
      text.includes('lab') ||
      text.includes('laboratory')
    );
  }

  private isSharedHallCompatible(room: any, category: string) {
    if (room.isSharedHall || room.availableForCombined) return true;
    if (category === 'MDC' && room.supportsMdc) return true;
    if (category === 'VAC' && room.supportsVac) return true;
    if (category === 'AEC' && room.supportsAec) return true;
    if (category === 'SEC' && room.supportsSec) return true;
    const supported = Array.isArray(room.supportedCategories)
      ? room.supportedCategories
      : [];
    return supported
      .map((value: string) => value.toUpperCase())
      .includes(category);
  }

  private timeToMinutes(value: Date) {
    return (
      value.getUTCHours() * 60 +
      value.getUTCMinutes() +
      value.getUTCSeconds() / 60
    );
  }

  private timeStringToMinutes(value: string) {
    const date = parseTimeToDate(value);
    return this.timeToMinutes(date);
  }

  private minutesToDate(value: number) {
    const hours = Math.floor(value / 60);
    const minutes = Math.floor(value % 60);
    return parseTimeToDate(
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
    );
  }

  private isInstitutionalDayShift(shift: { code?: string; name?: string }) {
    const text = `${shift.code ?? ''} ${shift.name ?? ''}`.toLowerCase();
    return !text.trim() || text.includes('day');
  }

  private hasInstitutionalDayShiftShape(slots: Slot[]) {
    const monday = slots.filter((slot) => slot.dayOfWeek === 1);
    const saturday = slots.filter((slot) => slot.dayOfWeek === 6);
    return (
      monday.length === 8 &&
      saturday.length === 4 &&
      monday.some(
        (slot) =>
          (slot.isBreak || slot.isLunch) &&
          this.timeToMinutes(slot.startTime) ===
            this.timeStringToMinutes('12:45') &&
          this.timeToMinutes(slot.endTime) ===
            this.timeStringToMinutes('13:15'),
      ) &&
      saturday.every((slot) => slot.periodNo <= 4)
    );
  }

  private diffMinutes(start: string, end: string) {
    return this.timeStringToMinutes(start) < this.timeStringToMinutes(end)
      ? this.timeStringToMinutes(end) - this.timeStringToMinutes(start)
      : 0;
  }

  private normalizeDepartmentName(value?: string | null) {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }
}
