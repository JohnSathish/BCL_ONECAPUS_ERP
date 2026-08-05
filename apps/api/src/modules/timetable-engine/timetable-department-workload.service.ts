import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { formatShiftTime } from '../../common/utils/shift-scope.util';
import { PrismaService } from '../../database/prisma.service';
import { TimetableAllocationService } from './timetable-allocation.service';

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

const ELECTIVE_FYUGP_CATEGORIES = new Set(['MDC', 'AEC', 'SEC', 'VAC', 'VTC']);

const FYUGP_SEMESTERS_BY_MODE: Record<'ODD' | 'EVEN', number[]> = {
  ODD: [1, 3, 5],
  EVEN: [2, 4, 6],
};

@Injectable()
export class TimetableDepartmentWorkloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocations: TimetableAllocationService,
  ) {}

  async resolveDepartmentScope(
    user: JwtUser,
    requestedDepartmentId?: string,
  ): Promise<{ departmentIds: string[]; isCentral: boolean }> {
    const permissions = new Set(user.permissions ?? []);
    const isCentral =
      permissions.has('shift:timetable:manage') ||
      permissions.has('academic:timetable:manage');
    if (isCentral) {
      return {
        departmentIds: requestedDepartmentId ? [requestedDepartmentId] : [],
        isCentral: true,
      };
    }
    const headed = await this.allocations.departmentIdsForUser(
      user.tid,
      user.sub,
    );
    if (!headed.length) {
      throw new BadRequestException(
        'No headed department found. Only HODs or timetable managers can use department workload.',
      );
    }
    if (requestedDepartmentId && !headed.includes(requestedDepartmentId)) {
      throw new BadRequestException(
        'You can only access your own department workload',
      );
    }
    return {
      departmentIds: requestedDepartmentId ? [requestedDepartmentId] : headed,
      isCentral: false,
    };
  }

  async listPlans(
    user: JwtUser,
    filters: {
      academicYearId?: string;
      shiftId?: string;
      semesterMode?: string;
    } = {},
  ) {
    const semesterMode =
      String(filters.semesterMode ?? 'ODD').toUpperCase() === 'EVEN'
        ? 'EVEN'
        : 'ODD';
    const plans = await this.prisma.timetablePlan.findMany({
      where: {
        tenantId: user.tid,
        deletedAt: null,
        status: {
          in: [
            'DRAFT',
            'UNDER_REVIEW',
            'APPROVED',
            'PUBLISHED',
            'DEPARTMENT_REVIEW',
          ],
        },
        ...(filters.academicYearId
          ? { academicYearId: filters.academicYearId }
          : {}),
        ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
        OR: [
          { metadata: { path: ['semesterMode'], equals: semesterMode } },
          { metadata: { equals: {} as any } },
          { metadata: { equals: null as any } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        name: true,
        status: true,
        approvalState: true,
        academicYearId: true,
        shiftId: true,
        departmentId: true,
        semesterSequence: true,
        updatedAt: true,
        metadata: true,
      },
    });
    return plans.map((p) => ({
      ...p,
      semesterMode:
        ((p.metadata as any)?.semesterMode as string) ?? semesterMode,
    }));
  }

  async listSheet(
    user: JwtUser,
    filters: {
      planId?: string;
      departmentId?: string;
      semesterMode?: string;
      shiftId?: string;
      academicYearId?: string;
    },
  ) {
    const scope = await this.resolveDepartmentScope(user, filters.departmentId);
    const semesterMode =
      String(filters.semesterMode ?? 'ODD').toUpperCase() === 'EVEN'
        ? 'EVEN'
        : 'ODD';

    let planId = filters.planId;
    if (!planId) {
      const plans = await this.listPlans(user, {
        academicYearId: filters.academicYearId,
        shiftId: filters.shiftId,
        semesterMode,
      });
      planId = plans[0]?.id;
    }

    if (planId) {
      const slotRows = await this.listSlotRows(
        user.tid,
        planId,
        scope.departmentIds,
        scope.isCentral,
      );
      if (slotRows.length || filters.planId) {
        const plan = await this.prisma.timetablePlan.findFirst({
          where: { tenantId: user.tid, id: planId, deletedAt: null },
        });
        return {
          mode: 'SLOTS' as const,
          plan: plan
            ? {
                id: plan.id,
                name: plan.name,
                status: plan.status,
                approvalState: plan.approvalState,
              }
            : null,
          departmentIds: scope.departmentIds,
          rows: slotRows,
        };
      }
    }

    const allocFilters: Record<string, string | undefined> = {
      semesterMode,
      shiftId: filters.shiftId,
      academicYearId: filters.academicYearId,
    };
    if (scope.departmentIds.length === 1) {
      allocFilters.departmentId = scope.departmentIds[0];
    }
    let rows = await this.allocations.listRows(user.tid, allocFilters);
    if (scope.departmentIds.length > 1) {
      rows = rows.filter((r) =>
        scope.departmentIds.includes(String(r.departmentId)),
      );
    } else if (scope.departmentIds.length === 1 && !allocFilters.departmentId) {
      rows = rows.filter((r) => r.departmentId === scope.departmentIds[0]);
    }

    return {
      mode: 'SUBJECTS' as const,
      plan: null,
      departmentIds: scope.departmentIds,
      rows: rows.map((r) => ({
        id: r.offeringSectionId,
        entryId: null,
        offeringSectionId: r.offeringSectionId,
        dayOfWeek: null,
        dayName: null,
        periodNo: null,
        startTime: null,
        endTime: null,
        subjectSlot: r.paperType ?? null,
        fyugpCategory: r.paperType ?? null,
        subjectCode: r.subjectCode,
        subjectName: r.subjectName,
        semester: r.semester,
        sectionCode: (r as any).sectionCode ?? null,
        departmentId: r.departmentId,
        department: r.department,
        staffProfileId: r.staffProfileId,
        staffName: r.staffName,
        classroomId: r.preferredRoomId,
        classroomCode: r.preferredRoom,
        weeklyHours: r.weeklyHours,
        maxWeeklyHours: r.maxWeeklyHours,
        assignedWeeklyHours: r.assignedWeeklyHours,
        workloadStatus: r.workloadStatus,
        status: r.status,
        source: 'ALLOCATION',
      })),
    };
  }

  private async listSlotRows(
    tenantId: string,
    planId: string,
    departmentIds: string[],
    isCentral: boolean,
  ) {
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        planId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
      include: {
        teachingSubjectGroup: {
          select: {
            id: true,
            title: true,
            fyugpCategory: true,
            departmentId: true,
          },
        },
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { periodNo: 'asc' },
        { startTime: 'asc' },
      ],
    });

    const courseIds = [
      ...new Set(entries.map((e) => e.courseId).filter(Boolean) as string[]),
    ];
    const staffIds = [
      ...new Set(
        entries.map((e) => e.staffProfileId).filter(Boolean) as string[],
      ),
    ];
    const classroomIds = [
      ...new Set(entries.map((e) => e.classroomId).filter(Boolean) as string[]),
    ];
    const offeringSectionIds = [
      ...new Set(
        entries.map((e) => e.offeringSectionId).filter(Boolean) as string[],
      ),
    ];

    const [courses, staff, classrooms, sections, workloads] = await Promise.all(
      [
        courseIds.length
          ? this.prisma.course.findMany({
              where: { tenantId, id: { in: courseIds } },
              include: { department: true },
            })
          : Promise.resolve([]),
        staffIds.length
          ? this.prisma.staffProfile.findMany({
              where: { tenantId, id: { in: staffIds } },
            })
          : Promise.resolve([]),
        classroomIds.length
          ? this.prisma.classroom.findMany({
              where: { tenantId, id: { in: classroomIds } },
            })
          : Promise.resolve([]),
        offeringSectionIds.length
          ? this.prisma.offeringSection.findMany({
              where: { tenantId, id: { in: offeringSectionIds } },
              include: {
                courseOffering: {
                  include: { course: { include: { department: true } } },
                },
              },
            })
          : Promise.resolve([]),
        staffIds.length
          ? this.prisma.staffWorkload.findMany({
              where: { staffProfileId: { in: staffIds } },
            })
          : Promise.resolve([]),
      ],
    );

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const classroomById = new Map(classrooms.map((r) => [r.id, r]));
    const sectionById = new Map(sections.map((s) => [s.id, s]));
    const workloadByStaff = new Map(
      workloads.map((w) => [w.staffProfileId, Number(w.weeklyHours ?? 24)]),
    );

    const enriched = entries.map((entry) => {
      const course = entry.courseId ? courseById.get(entry.courseId) : null;
      const section = entry.offeringSectionId
        ? sectionById.get(entry.offeringSectionId)
        : null;
      const group = entry.teachingSubjectGroup;
      const dept =
        course?.department ??
        section?.courseOffering?.course?.department ??
        null;
      const departmentId = dept?.id ?? group?.departmentId ?? null;
      return { entry, course, section, dept, departmentId, group };
    });

    const filtered = enriched.filter(({ departmentId, entry, group }) => {
      const category = String(
        entry.fyugpCategory ?? group?.fyugpCategory ?? '',
      ).toUpperCase();
      // Electives are managed on Elective Staff Allocation (cross-dept).
      if (ELECTIVE_FYUGP_CATEGORIES.has(category)) return false;
      if (isCentral && !departmentIds.length) return true;
      if (!departmentId) return isCentral;
      return departmentIds.includes(departmentId);
    });

    return filtered.map(({ entry, course, dept, departmentId, group }) => {
      const meta = (entry.metadata ?? {}) as Record<string, unknown>;
      const staffProfile = entry.staffProfileId
        ? staffById.get(entry.staffProfileId)
        : null;
      const classroom = entry.classroomId
        ? classroomById.get(entry.classroomId)
        : null;
      const maxWeekly = entry.staffProfileId
        ? (workloadByStaff.get(entry.staffProfileId) ?? 24)
        : 24;
      return {
        id: entry.id,
        entryId: entry.id,
        offeringSectionId: entry.offeringSectionId,
        dayOfWeek: entry.dayOfWeek,
        dayName: DAY_NAMES[entry.dayOfWeek] ?? `Day ${entry.dayOfWeek}`,
        periodNo: entry.periodNo,
        startTime: entry.startTime ? formatShiftTime(entry.startTime) : null,
        endTime: entry.endTime ? formatShiftTime(entry.endTime) : null,
        subjectSlot:
          entry.fyugpCategory ?? group?.fyugpCategory ?? entry.slotType ?? null,
        fyugpCategory: entry.fyugpCategory,
        subjectCode: course?.code ?? null,
        subjectName: course?.title ?? group?.title ?? 'Subject',
        semester: entry.semesterSequence,
        sectionCode: entry.sectionCode,
        departmentId: departmentId,
        department: dept?.name ?? null,
        staffProfileId: entry.staffProfileId,
        staffName: staffProfile?.fullName ?? null,
        classroomId: entry.classroomId,
        classroomCode: classroom?.code ?? null,
        weeklyHours: null,
        maxWeeklyHours: maxWeekly,
        assignedWeeklyHours: null,
        workloadStatus: null,
        status: (meta.allocationStatus as string) ?? 'DRAFT',
        source: 'PLAN_ENTRY',
      };
    });
  }

  async assign(
    user: JwtUser,
    payload: {
      entryId?: string;
      offeringSectionId?: string;
      staffProfileId?: string | null;
      classroomId?: string | null;
      workloadHours?: number | null;
      status?: string;
    },
  ) {
    if (payload.entryId) {
      return this.assignPlanEntry(user, payload);
    }
    if (payload.offeringSectionId) {
      await this.assertSectionAccess(user, payload.offeringSectionId);
      if (payload.staffProfileId) {
        await this.assertFacultyFreeForSection(
          user.tid,
          payload.offeringSectionId,
          payload.staffProfileId,
        );
      }
      return this.allocations.saveRow(user.tid, {
        offeringSectionId: payload.offeringSectionId,
        staffProfileId: payload.staffProfileId,
        preferredRoomId: payload.classroomId,
        workloadHours: payload.workloadHours,
        status: payload.status ?? 'DRAFT',
      });
    }
    throw new BadRequestException('entryId or offeringSectionId is required');
  }

  private async assignPlanEntry(
    user: JwtUser,
    payload: {
      entryId?: string;
      staffProfileId?: string | null;
      classroomId?: string | null;
      status?: string;
    },
  ) {
    const entry = await this.prisma.timetablePlanEntry.findFirst({
      where: {
        tenantId: user.tid,
        id: payload.entryId,
        deletedAt: null,
      },
    });
    if (!entry) throw new NotFoundException('Timetable slot not found');

    const departmentId = await this.resolveEntryDepartmentId(
      user.tid,
      entry.courseId,
      entry.offeringSectionId,
    );
    const scope = await this.resolveDepartmentScope(
      user,
      departmentId ?? undefined,
    );
    if (
      !scope.isCentral &&
      departmentId &&
      !scope.departmentIds.includes(departmentId)
    ) {
      throw new BadRequestException(
        'HOD can assign faculty only for their department slots',
      );
    }

    if (payload.staffProfileId) {
      await this.assertNoFacultyClash(
        user.tid,
        entry.planId,
        entry.id,
        entry.dayOfWeek,
        entry.periodNo,
        entry.startTime,
        entry.endTime,
        payload.staffProfileId,
      );
    }
    if (payload.classroomId) {
      await this.assertNoRoomClash(
        user.tid,
        entry.planId,
        entry.id,
        entry.dayOfWeek,
        entry.periodNo,
        entry.startTime,
        entry.endTime,
        payload.classroomId,
      );
    }

    const meta = {
      ...((entry.metadata ?? {}) as object),
      allocationStatus: payload.status ?? 'DRAFT',
      assignedById: user.sub,
      assignedAt: new Date().toISOString(),
    };

    const updated = await this.prisma.timetablePlanEntry.update({
      where: { id: entry.id },
      data: {
        staffProfileId:
          payload.staffProfileId === undefined
            ? entry.staffProfileId
            : payload.staffProfileId,
        classroomId:
          payload.classroomId === undefined
            ? entry.classroomId
            : payload.classroomId,
        source: 'MANUAL',
        metadata: meta as any,
      },
    });

    if (entry.offeringSectionId && payload.staffProfileId) {
      await this.allocations.saveRow(user.tid, {
        offeringSectionId: entry.offeringSectionId,
        staffProfileId: payload.staffProfileId,
        preferredRoomId: payload.classroomId ?? entry.classroomId,
        status: payload.status ?? 'DRAFT',
      });
    }

    await this.prisma.timetableAuditLog.create({
      data: {
        tenantId: user.tid,
        planId: entry.planId,
        action: 'DEPARTMENT_WORKLOAD_ASSIGN',
        entityType: 'TimetablePlanEntry',
        entityId: entry.id,
        actorId: user.sub,
        beforeState: {
          staffProfileId: entry.staffProfileId,
          classroomId: entry.classroomId,
        } as any,
        afterState: {
          staffProfileId: updated.staffProfileId,
          classroomId: updated.classroomId,
        } as any,
      },
    });

    return updated;
  }

  async facultyAvailability(
    user: JwtUser,
    staffProfileId: string,
    filters: { planId?: string; semesterMode?: string } = {},
  ) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId: user.tid,
        id: staffProfileId,
        deletedAt: null,
      },
      include: { workloads: true, department: true },
    });
    if (!staff) throw new NotFoundException('Faculty not found');

    const maxWeekly = Number(staff.workloads?.[0]?.weeklyHours ?? 24);
    const semesterMode =
      String(filters.semesterMode ?? 'ODD').toUpperCase() === 'EVEN'
        ? 'EVEN'
        : 'ODD';
    const allowedSemesters = FYUGP_SEMESTERS_BY_MODE[semesterMode];

    const assignments = await this.prisma.staffSubjectAssignment.findMany({
      where: {
        tenantId: user.tid,
        staffProfileId,
        semesterNo: { in: allowedSemesters },
      },
      include: {
        offeringSection: {
          include: { courseOffering: { include: { course: true } } },
        },
      },
    });

    const assignedHours = assignments.reduce(
      (sum, a) => sum + Number(a.workloadHours ?? 0),
      0,
    );

    const entryWhere: any = {
      tenantId: user.tid,
      staffProfileId,
      deletedAt: null,
      status: { not: 'CANCELLED' },
    };
    if (filters.planId) entryWhere.planId = filters.planId;

    const occupied = await this.prisma.timetablePlanEntry.findMany({
      where: entryWhere,
      orderBy: [{ dayOfWeek: 'asc' }, { periodNo: 'asc' }],
      take: 200,
    });
    const occupiedCourseIds = [
      ...new Set(occupied.map((e) => e.courseId).filter(Boolean) as string[]),
    ];
    const occupiedRoomIds = [
      ...new Set(
        occupied.map((e) => e.classroomId).filter(Boolean) as string[],
      ),
    ];
    const [occupiedCourses, occupiedRooms] = await Promise.all([
      occupiedCourseIds.length
        ? this.prisma.course.findMany({
            where: { tenantId: user.tid, id: { in: occupiedCourseIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      occupiedRoomIds.length
        ? this.prisma.classroom.findMany({
            where: { tenantId: user.tid, id: { in: occupiedRoomIds } },
            select: { id: true, code: true },
          })
        : Promise.resolve([]),
    ]);
    const occupiedCourseById = new Map(
      occupiedCourses.map((c) => [c.id, c.title]),
    );
    const occupiedRoomById = new Map(occupiedRooms.map((r) => [r.id, r.code]));

    return {
      staffProfileId: staff.id,
      staffName: staff.fullName,
      employeeCode: staff.employeeCode,
      shortCode: staff.shortCode,
      department: staff.department?.name ?? null,
      employmentType: staff.staffType ?? null,
      maxWeeklyHours: maxWeekly,
      assignedWeeklyHours: assignedHours,
      remainingHours: Math.max(0, maxWeekly - assignedHours),
      workloadStatus:
        assignedHours > maxWeekly
          ? 'RED'
          : assignedHours >= maxWeekly * 0.85
            ? 'YELLOW'
            : 'GREEN',
      assignedSubjects: assignments.map((a) => ({
        offeringSectionId: a.offeringSectionId,
        subjectCode: a.offeringSection?.courseOffering?.course?.code,
        subjectName: a.offeringSection?.courseOffering?.course?.title,
        semester: a.semesterNo,
        weeklyHours: Number(a.workloadHours ?? 0),
        category: a.category,
      })),
      occupiedSlots: occupied.map((e) => ({
        entryId: e.id,
        planId: e.planId,
        dayOfWeek: e.dayOfWeek,
        dayName: DAY_NAMES[e.dayOfWeek] ?? `Day ${e.dayOfWeek}`,
        periodNo: e.periodNo,
        startTime: e.startTime ? formatShiftTime(e.startTime) : null,
        endTime: e.endTime ? formatShiftTime(e.endTime) : null,
        subjectName: e.courseId
          ? (occupiedCourseById.get(e.courseId) ?? null)
          : null,
        classroomCode: e.classroomId
          ? (occupiedRoomById.get(e.classroomId) ?? null)
          : null,
      })),
    };
  }

  async transitionStatus(
    user: JwtUser,
    dto: {
      sectionIds?: string[];
      entryIds?: string[];
      planId?: string;
      status: string;
    },
  ) {
    const status = String(dto.status || '')
      .trim()
      .toUpperCase();
    const allowed = [
      'DRAFT',
      'SUBMITTED',
      'HOD_APPROVED',
      'ACADEMIC_OFFICE_APPROVED',
      'PUBLISHED',
    ];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Status must be one of ${allowed.join(', ')}`,
      );
    }

    const permissions = new Set(user.permissions ?? []);
    const isCentral =
      permissions.has('shift:timetable:manage') ||
      permissions.has('academic:timetable:manage');
    if (
      ['ACADEMIC_OFFICE_APPROVED', 'PUBLISHED'].includes(status) &&
      !isCentral
    ) {
      throw new BadRequestException(
        'Only Academic Office / timetable managers can approve or publish',
      );
    }

    let updated = 0;
    if (dto.sectionIds?.length) {
      for (const sectionId of dto.sectionIds) {
        await this.assertSectionAccess(user, sectionId);
      }
      const result = await this.allocations.submitRows(
        user.tid,
        dto.sectionIds,
        status,
      );
      updated += result.updated;
    }

    if (dto.entryIds?.length) {
      const entries = await this.prisma.timetablePlanEntry.findMany({
        where: {
          tenantId: user.tid,
          id: { in: dto.entryIds },
          deletedAt: null,
        },
      });
      for (const entry of entries) {
        const departmentId = await this.resolveEntryDepartmentId(
          user.tid,
          entry.courseId,
          entry.offeringSectionId,
        );
        const scope = await this.resolveDepartmentScope(
          user,
          departmentId ?? undefined,
        );
        if (
          !scope.isCentral &&
          departmentId &&
          !scope.departmentIds.includes(departmentId)
        ) {
          throw new BadRequestException(
            'Cannot update status for another department slot',
          );
        }
        await this.prisma.timetablePlanEntry.update({
          where: { id: entry.id },
          data: {
            metadata: {
              ...((entry.metadata ?? {}) as object),
              allocationStatus: status,
              statusChangedById: user.sub,
              statusChangedAt: new Date().toISOString(),
            } as any,
          },
        });
        updated += 1;
      }
    }

    if (dto.planId && status === 'SUBMITTED') {
      await this.prisma.timetablePlan.update({
        where: { id: dto.planId },
        data: {
          status: 'UNDER_REVIEW',
          approvalState: 'DEPARTMENT_REVIEW',
          submittedAt: new Date(),
        },
      });
    }
    if (dto.planId && status === 'HOD_APPROVED') {
      await this.prisma.timetablePlan.update({
        where: { id: dto.planId },
        data: {
          approvalState: 'DEPARTMENT_REVIEW',
          status: 'UNDER_REVIEW',
        },
      });
    }
    if (dto.planId && status === 'ACADEMIC_OFFICE_APPROVED') {
      await this.prisma.timetablePlan.update({
        where: { id: dto.planId },
        data: {
          status: 'APPROVED',
          approvalState: 'ACADEMIC_OFFICE_APPROVED',
          approvedAt: new Date(),
          approvedById: user.sub,
        },
      });
    }

    return { updated, status };
  }

  private async assertSectionAccess(user: JwtUser, offeringSectionId: string) {
    const section = await this.prisma.offeringSection.findFirst({
      where: { tenantId: user.tid, id: offeringSectionId, deletedAt: null },
      include: {
        courseOffering: {
          include: {
            course: true,
            programVersion: { include: { program: true } },
          },
        },
      },
    });
    if (!section) throw new NotFoundException('Section not found');
    const departmentId =
      section.courseOffering?.course?.departmentId ??
      section.courseOffering?.programVersion?.program?.departmentId;
    await this.resolveDepartmentScope(user, departmentId ?? undefined);
  }

  private async assertFacultyFreeForSection(
    tenantId: string,
    offeringSectionId: string,
    staffProfileId: string,
  ) {
    // Soft check: warn via BadRequest if staff already primary on many concurrent sections
    // Full slot clash is enforced when assigning plan entries.
    const staff = await this.prisma.staffProfile.findFirst({
      where: {
        tenantId,
        id: staffProfileId,
        deletedAt: null,
        status: 'ACTIVE',
      },
    });
    if (!staff) throw new BadRequestException('Invalid or inactive faculty');
  }

  private async resolveEntryDepartmentId(
    tenantId: string,
    courseId?: string | null,
    offeringSectionId?: string | null,
  ): Promise<string | null> {
    if (courseId) {
      const course = await this.prisma.course.findFirst({
        where: { tenantId, id: courseId },
        select: { departmentId: true },
      });
      if (course?.departmentId) return course.departmentId;
    }
    if (offeringSectionId) {
      const section = await this.prisma.offeringSection.findFirst({
        where: { tenantId, id: offeringSectionId },
        include: {
          courseOffering: {
            include: {
              course: { select: { departmentId: true } },
              programVersion: {
                include: {
                  program: { select: { departmentId: true } },
                },
              },
            },
          },
        },
      });
      return (
        section?.courseOffering?.course?.departmentId ??
        section?.courseOffering?.programVersion?.program?.departmentId ??
        null
      );
    }
    return null;
  }

  private async assertNoFacultyClash(
    tenantId: string,
    planId: string,
    entryId: string,
    dayOfWeek: number,
    periodNo: number | null,
    startTime: Date | null,
    endTime: Date | null,
    staffProfileId: string,
  ) {
    const clash = await this.prisma.timetablePlanEntry.findFirst({
      where: {
        tenantId,
        planId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        staffProfileId,
        dayOfWeek,
        id: { not: entryId },
        ...(periodNo != null
          ? { periodNo }
          : startTime && endTime
            ? {
                startTime: { lt: endTime },
                endTime: { gt: startTime },
              }
            : {}),
      },
    });
    if (clash) {
      const clashCourse = clash.courseId
        ? await this.prisma.course.findFirst({
            where: { tenantId, id: clash.courseId },
            select: { title: true },
          })
        : null;
      throw new BadRequestException(
        `Faculty clash: already assigned on ${DAY_NAMES[dayOfWeek] ?? 'that day'} period ${clash.periodNo ?? ''} (${clashCourse?.title ?? 'another class'})`,
      );
    }
  }

  private async assertNoRoomClash(
    tenantId: string,
    planId: string,
    entryId: string,
    dayOfWeek: number,
    periodNo: number | null,
    startTime: Date | null,
    endTime: Date | null,
    classroomId: string,
  ) {
    const clash = await this.prisma.timetablePlanEntry.findFirst({
      where: {
        tenantId,
        planId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        classroomId,
        dayOfWeek,
        id: { not: entryId },
        ...(periodNo != null
          ? { periodNo }
          : startTime && endTime
            ? {
                startTime: { lt: endTime },
                endTime: { gt: startTime },
              }
            : {}),
      },
    });
    if (clash) {
      const clashCourse = clash.courseId
        ? await this.prisma.course.findFirst({
            where: { tenantId, id: clash.courseId },
            select: { title: true },
          })
        : null;
      throw new BadRequestException(
        `Room clash: already used on ${DAY_NAMES[dayOfWeek] ?? 'that day'} for ${clashCourse?.title ?? 'another class'}`,
      );
    }
  }
}
