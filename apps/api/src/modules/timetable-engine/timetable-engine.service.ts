import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import {
  formatShiftTime,
  parseTimeToDate,
} from '../../common/utils/shift-scope.util';
import { PrismaService } from '../../database/prisma.service';
import { TimetableAllocationExcelService } from './timetable-allocation-excel.service';
import { TimetableAllocationService } from './timetable-allocation.service';
import { TimetableBulkService } from './timetable-bulk.service';
import { TimetableConflictService } from './timetable-conflict.service';
import { TimetableGeneratorService } from './timetable-generator.service';
import { TimetablePrintService } from './timetable-print.service';
import { TimetableReadinessService } from './timetable-readiness.service';
import { TimetableRoutineExcelService } from './timetable-routine-excel.service';
import { TimetableSlotRuleService } from './timetable-slot-rule.service';
import { TimetableStreamMasterService } from './timetable-stream-master.service';
import { StudentAttendanceService } from '../student-attendance/student-attendance.service';
import { CommunicationTriggerService } from '../communication/services/communication-trigger.service';

type PlanFilters = {
  shiftId?: string;
  streamId?: string;
  semesterMode?: string;
  status?: string;
  academicYearId?: string;
  programVersionId?: string;
  semesterSequence?: number;
};

const FYUGP_SEMESTERS_BY_CYCLE: Record<'ODD' | 'EVEN', number[]> = {
  ODD: [1, 3, 5],
  EVEN: [2, 4, 6],
};

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

type EntryPayload = {
  planId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  shiftId?: string;
  slotTemplateId?: string;
  periodNo?: number;
  offeringSectionId?: string;
  courseOfferingId?: string;
  courseId?: string;
  staffProfileId?: string;
  classroomId?: string;
  semesterSequence?: number;
  sectionCode?: string;
  slotType?: string;
  fyugpCategory?: string;
  combinedGroupKey?: string;
  isCombined?: boolean;
  isLocked?: boolean;
  notes?: string;
  metadata?: Record<string, unknown>;
  facultyTeam?: Array<{
    staffProfileId: string;
    role?: string;
    allocationPercent?: number;
  }>;
};

@Injectable()
export class TimetableEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocations: TimetableAllocationService,
    private readonly allocationExcel: TimetableAllocationExcelService,
    private readonly generator: TimetableGeneratorService,
    private readonly conflicts: TimetableConflictService,
    private readonly print: TimetablePrintService,
    private readonly streamMaster: TimetableStreamMasterService,
    private readonly slotRules: TimetableSlotRuleService,
    private readonly readinessService: TimetableReadinessService,
    private readonly bulk: TimetableBulkService,
    private readonly routineExcel: TimetableRoutineExcelService,
    private readonly attendance: StudentAttendanceService,
    private readonly communication: CommunicationTriggerService,
  ) {}

  listPlans(user: JwtUser, filters: PlanFilters = {}) {
    return this.prisma.timetablePlan.findMany({
      where: {
        AND: [
          ...(filters.streamId
            ? [
                {
                  metadata: {
                    path: ['streamId'],
                    equals: filters.streamId,
                  } as any,
                },
              ]
            : []),
          ...(filters.semesterMode
            ? [
                {
                  metadata: {
                    path: ['semesterMode'],
                    equals: filters.semesterMode.toUpperCase(),
                  } as any,
                },
              ]
            : []),
        ],
        tenantId: user.tid,
        deletedAt: null,
        ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.academicYearId
          ? { academicYearId: filters.academicYearId }
          : {}),
        ...(filters.programVersionId
          ? { programVersionId: filters.programVersionId }
          : {}),
        ...(filters.semesterSequence
          ? { semesterSequence: filters.semesterSequence }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async createPlan(
    user: JwtUser,
    dto: {
      name: string;
      institutionId?: string;
      campusId?: string;
      academicYearId?: string;
      departmentId?: string;
      programVersionId?: string;
      semesterId?: string;
      semesterSequence?: number;
      shiftId?: string;
      streamId?: string;
      semesterMode?: string;
      generationScope?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
      scopeType?: string;
    },
  ) {
    const context = await this.academicCycleContext(
      user.tid,
      dto.institutionId,
    );
    const requestedMode = this.normalizeCycle(
      dto.semesterMode ?? context.currentCycle,
    );
    if (requestedMode !== context.currentCycle) {
      throw new BadRequestException(
        `Semester mode ${requestedMode} is inactive in current ${context.currentCycle} academic cycle.`,
      );
    }
    const semesterMode = context.currentCycle;
    const allowedSemesters = FYUGP_SEMESTERS_BY_CYCLE[semesterMode];
    if (
      dto.semesterSequence &&
      !allowedSemesters.includes(dto.semesterSequence)
    ) {
      throw new BadRequestException(
        `Semester ${dto.semesterSequence} is inactive in current ${semesterMode} academic cycle.`,
      );
    }
    const stream = dto.streamId
      ? await this.prisma.academicStream.findFirst({
          where: {
            id: dto.streamId,
            tenantId: user.tid,
            deletedAt: null,
            isActive: true,
          },
        })
      : null;
    if (dto.streamId && !stream) {
      throw new BadRequestException('Invalid or inactive academic stream');
    }
    const plan = await this.prisma.timetablePlan.create({
      data: {
        tenantId: user.tid,
        name: dto.name.trim(),
        institutionId: dto.institutionId,
        campusId: dto.campusId,
        academicYearId: dto.academicYearId,
        departmentId: dto.departmentId,
        programVersionId: dto.programVersionId,
        semesterId: dto.semesterId,
        semesterSequence: dto.semesterSequence,
        shiftId: dto.shiftId,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        scopeType: dto.scopeType ?? (dto.streamId ? 'STREAM' : 'INSTITUTION'),
        metadata: {
          semesterMode,
          allowedSemesters,
          blockedSemesters: this.blockedSemesters(semesterMode),
          streamId: stream?.id ?? null,
          streamCode: stream?.code ?? null,
          streamName: stream?.name ?? null,
          generationScope:
            dto.generationScope ?? (stream ? 'STREAM' : 'ALL_STREAMS'),
        },
        createdById: user.sub,
      },
    });
    await this.audit(
      user,
      plan.id,
      'CREATE_PLAN',
      'TimetablePlan',
      plan.id,
      null,
      plan,
    );
    await this.generator.ensureSlotTemplatesForPlan(user.tid, plan.id);
    return plan;
  }

  async createManualPlan(
    user: JwtUser,
    dto: Parameters<TimetableEngineService['createPlan']>[1],
  ) {
    const plan = await this.createPlan(user, {
      ...dto,
      name: dto.name?.trim() || 'Manual Timetable',
      generationScope: 'MANUAL',
    });
    return plan;
  }

  async deletePlan(user: JwtUser, planId: string) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { id: planId, tenantId: user.tid, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Timetable plan not found');
    if (plan.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Published plans cannot be deleted. Select another plan or archive this one from admin settings.',
      );
    }
    const updated = await this.prisma.timetablePlan.update({
      where: { id: planId },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
        approvalState: 'ARCHIVED',
      },
    });
    await this.audit(
      user,
      planId,
      'DELETE_PLAN',
      'TimetablePlan',
      planId,
      plan,
      updated,
    );
    return updated;
  }

  generatePlan(user: JwtUser, planId: string) {
    return this.generator.generate(user.tid, planId);
  }

  async context(user: JwtUser) {
    const cycle = await this.academicCycleContext(user.tid);
    const [streams, shifts, academicYearRows] = await Promise.all([
      this.prisma.academicStream.findMany({
        where: { tenantId: user.tid, deletedAt: null, isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.shift.findMany({
        where: {
          tenantId: user.tid,
          deletedAt: null,
          status: { in: ['ACTIVE', 'active'] },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.academicYear.findMany({
        where: { tenantId: user.tid, deletedAt: null },
        orderBy: [{ startDate: 'desc' }, { updatedAt: 'desc' }],
      }),
    ]);
    const academicYears = this.dedupeAcademicYears(academicYearRows);
    return {
      currentAcademicMode: cycle.currentCycle,
      allowedSemesters: cycle.allowedSemesters,
      blockedSemesters: cycle.blockedSemesters,
      streams: this.groupStreamsForContext(streams),
      shifts: shifts.map((shift) => ({
        id: shift.id,
        code: shift.code,
        name: shift.name,
        startTime: formatShiftTime(shift.startTime),
        endTime: formatShiftTime(shift.endTime),
      })),
      academicYears,
    };
  }

  async dashboard(user: JwtUser) {
    const cycle = await this.academicCycleContext(user.tid);
    const plans = await this.prisma.timetablePlan.findMany({
      where: { tenantId: user.tid, deletedAt: null },
      select: { id: true, status: true, shiftId: true, metadata: true },
    });
    const byStream = new Map<string, number>();
    const byShift = new Map<string, number>();
    for (const plan of plans) {
      const metadata = (plan.metadata ?? {}) as any;
      const streamName =
        metadata.streamName ?? metadata.streamCode ?? 'All Streams';
      byStream.set(streamName, (byStream.get(streamName) ?? 0) + 1);
      const shiftKey = plan.shiftId ?? 'No Shift';
      byShift.set(shiftKey, (byShift.get(shiftKey) ?? 0) + 1);
    }
    return {
      currentActiveCycle: cycle.currentCycle,
      allowedSemesters: cycle.allowedSemesters,
      blockedSemesters: cycle.blockedSemesters,
      generatedPlansByStream: Array.from(byStream.entries()).map(
        ([label, count]) => ({
          label,
          count,
        }),
      ),
      generatedPlansByShift: Array.from(byShift.entries()).map(
        ([label, count]) => ({
          label,
          count,
        }),
      ),
      pendingTimetables: plans.filter((plan) => plan.status !== 'PUBLISHED')
        .length,
      publishedTimetables: plans.filter((plan) => plan.status === 'PUBLISHED')
        .length,
    };
  }

  validatePlan(user: JwtUser, planId: string) {
    return this.conflicts.validatePlan(user.tid, planId);
  }

  matrix(
    user: JwtUser,
    planId: string,
    filters?: Parameters<TimetablePrintService['matrix']>[2],
  ) {
    return this.print.matrix(user.tid, planId, filters);
  }

  printPayload(user: JwtUser, planId: string) {
    return this.print.noticeBoardPayload(user.tid, planId);
  }

  streamMasterRoutine(user: JwtUser, planId: string) {
    return this.streamMaster.masterRoutine(user.tid, planId);
  }

  teachingAllocations(
    user: JwtUser,
    filters: {
      academicYearId?: string;
      streamId?: string;
      shiftId?: string;
      semesterMode?: string;
      departmentId?: string;
    },
  ) {
    return this.allocations.listRows(
      user.tid,
      this.scopeDepartmentFilter(user, filters),
    );
  }

  async saveTeachingAllocation(user: JwtUser, dto: any) {
    await this.assertDepartmentAllocationAccess(user, dto.offeringSectionId);
    return this.allocations.saveRow(user.tid, dto);
  }

  submitTeachingAllocations(
    user: JwtUser,
    dto: { sectionIds: string[]; status?: string },
  ) {
    return this.allocations.submitRows(
      user.tid,
      dto.sectionIds ?? [],
      dto.status,
    );
  }

  autoAssignTeachingAllocations(
    user: JwtUser,
    dto: {
      academicYearId?: string;
      streamId?: string;
      shiftId?: string;
      semesterMode?: string;
      departmentId?: string;
    },
  ) {
    return this.allocations.autoAssign(
      user.tid,
      this.scopeDepartmentFilter(user, dto),
    );
  }

  clonePreviousRoutine(
    user: JwtUser,
    dto: { sourcePlanId: string; targetPlanId: string },
  ) {
    return this.allocations.clonePrevious(
      user.tid,
      dto.sourcePlanId,
      dto.targetPlanId,
    );
  }

  slotCategoryRules(user: JwtUser, planId: string) {
    return this.slotRules.listRules(user.tid, planId);
  }

  saveSlotCategoryRules(user: JwtUser, planId: string, dto: { rules: any[] }) {
    return this.slotRules.configureCategoryRules(
      user.tid,
      planId,
      dto.rules ?? [],
    );
  }

  teachingAllocationTemplate(
    user: JwtUser,
    filters: Record<string, string | undefined>,
  ) {
    return this.allocationExcel.allocationTemplate(user.tid, filters);
  }

  validateTeachingAllocationWorkbook(user: JwtUser, buffer: Buffer) {
    return this.allocationExcel.validateAllocationUpload(user.tid, buffer);
  }

  commitTeachingAllocationWorkbook(user: JwtUser, buffer: Buffer) {
    return this.allocationExcel.commitAllocationUpload(user.tid, buffer);
  }

  allocationReadiness(
    user: JwtUser,
    filters: Record<string, string | undefined>,
  ) {
    return this.readinessService.readiness(
      user.tid,
      this.scopeDepartmentFilter(user, filters),
    );
  }

  validationCenter(user: JwtUser, planId: string) {
    return this.readinessService.planValidation(user.tid, planId);
  }

  async createManualEntry(user: JwtUser, dto: EntryPayload) {
    const plan = await this.assertEditablePlan(user.tid, dto.planId);
    const entry = await this.prisma.timetablePlanEntry.create({
      data: {
        tenantId: user.tid,
        planId: plan.id,
        shiftId: dto.shiftId ?? plan.shiftId,
        slotTemplateId: dto.slotTemplateId,
        dayOfWeek: dto.dayOfWeek,
        periodNo: dto.periodNo,
        startTime: parseTimeToDate(dto.startTime),
        endTime: parseTimeToDate(dto.endTime),
        offeringSectionId: dto.offeringSectionId,
        courseOfferingId: dto.courseOfferingId,
        courseId: dto.courseId,
        staffProfileId: dto.staffProfileId,
        classroomId: dto.classroomId,
        semesterSequence: dto.semesterSequence,
        sectionCode: dto.sectionCode,
        slotType: dto.slotType ?? 'THEORY',
        fyugpCategory: dto.fyugpCategory,
        combinedGroupKey: dto.combinedGroupKey,
        isCombined: dto.isCombined ?? Boolean(dto.combinedGroupKey),
        isLocked: dto.isLocked ?? true,
        source: 'MANUAL',
        notes: dto.notes,
        metadata: {
          ...(dto.metadata ?? {}),
          ...(dto.facultyTeam?.length
            ? {
                facultyTeam: dto.facultyTeam,
                sessionFacultyMode: 'TEAM_TEACHING',
              }
            : { sessionFacultyMode: 'PRIMARY' }),
        } as any,
      },
    });
    await this.audit(
      user,
      plan.id,
      'CREATE_ENTRY',
      'TimetablePlanEntry',
      entry.id,
      null,
      entry,
    );
    return entry;
  }

  async updateEntry(
    user: JwtUser,
    entryId: string,
    dto: Partial<EntryPayload>,
  ) {
    const existing = await this.prisma.timetablePlanEntry.findFirst({
      where: { id: entryId, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Timetable entry not found');
    await this.assertEditablePlan(user.tid, existing.planId);
    const updated = await this.prisma.timetablePlanEntry.update({
      where: { id: entryId },
      data: {
        shiftId: dto.shiftId,
        slotTemplateId: dto.slotTemplateId,
        dayOfWeek: dto.dayOfWeek,
        periodNo: dto.periodNo,
        startTime: dto.startTime ? parseTimeToDate(dto.startTime) : undefined,
        endTime: dto.endTime ? parseTimeToDate(dto.endTime) : undefined,
        offeringSectionId: dto.offeringSectionId,
        courseOfferingId: dto.courseOfferingId,
        courseId: dto.courseId,
        staffProfileId: dto.staffProfileId,
        classroomId: dto.classroomId,
        semesterSequence: dto.semesterSequence,
        sectionCode: dto.sectionCode,
        slotType: dto.slotType,
        fyugpCategory: dto.fyugpCategory,
        combinedGroupKey: dto.combinedGroupKey,
        isCombined: dto.isCombined,
        isLocked: dto.isLocked,
        source: 'MANUAL',
        notes: dto.notes,
        ...(dto.metadata || dto.facultyTeam
          ? {
              metadata: {
                ...((existing.metadata ?? {}) as object),
                ...(dto.metadata ?? {}),
                ...(dto.facultyTeam?.length
                  ? {
                      facultyTeam: dto.facultyTeam,
                      sessionFacultyMode: 'TEAM_TEACHING',
                    }
                  : {}),
              } as any,
            }
          : {}),
      },
    });
    await this.audit(
      user,
      existing.planId,
      'UPDATE_ENTRY',
      'TimetablePlanEntry',
      entryId,
      existing,
      updated,
    );
    return updated;
  }

  async submitReview(user: JwtUser, planId: string) {
    return this.transition(user, planId, {
      status: 'UNDER_REVIEW',
      approvalState: 'DEPARTMENT_REVIEW',
      submittedAt: new Date(),
    });
  }

  async deleteEntry(user: JwtUser, entryId: string) {
    const existing = await this.prisma.timetablePlanEntry.findFirst({
      where: { id: entryId, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Timetable entry not found');
    await this.assertEditablePlan(user.tid, existing.planId);
    const updated = await this.prisma.timetablePlanEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
    await this.audit(
      user,
      existing.planId,
      'DELETE_ENTRY',
      'TimetablePlanEntry',
      entryId,
      existing,
      updated,
    );
    return updated;
  }

  copyDaySchedule(
    user: JwtUser,
    planId: string,
    sourceDay: number,
    targetDay: number,
  ) {
    return this.bulk.copyDaySchedule(user.tid, planId, sourceDay, targetDay);
  }

  copySemesterSchedule(
    user: JwtUser,
    planId: string,
    sourceSemester: number,
    targetSemester: number,
  ) {
    return this.bulk.copySemesterSchedule(
      user.tid,
      planId,
      sourceSemester,
      targetSemester,
    );
  }

  duplicateEntry(
    user: JwtUser,
    entryId: string,
    targetDay: number,
    targetPeriodNo?: number,
  ) {
    return this.bulk.duplicateEntry(
      user.tid,
      entryId,
      targetDay,
      targetPeriodNo,
    );
  }

  bulkMovePeriods(
    user: JwtUser,
    planId: string,
    fromPeriod: number,
    toPeriod: number,
    dayOfWeek?: number,
  ) {
    return this.bulk.bulkMovePeriods(
      user.tid,
      planId,
      fromPeriod,
      toPeriod,
      dayOfWeek,
    );
  }

  bulkReplaceFaculty(
    user: JwtUser,
    planId: string,
    fromStaffProfileId: string,
    toStaffProfileId: string,
  ) {
    return this.bulk.bulkReplaceFaculty(
      user.tid,
      planId,
      fromStaffProfileId,
      toStaffProfileId,
    );
  }

  bulkReplaceRooms(
    user: JwtUser,
    planId: string,
    fromClassroomId: string,
    toClassroomId: string,
  ) {
    return this.bulk.bulkReplaceRooms(
      user.tid,
      planId,
      fromClassroomId,
      toClassroomId,
    );
  }

  routineTemplate(user: JwtUser, planId: string) {
    return this.routineExcel.routineTemplate(user.tid, planId);
  }

  validateRoutineUpload(user: JwtUser, planId: string, buffer: Buffer) {
    return this.routineExcel.validateRoutineUpload(user.tid, planId, buffer);
  }

  commitRoutineUpload(
    user: JwtUser,
    planId: string,
    buffer: Buffer,
    options?: { overrideConflicts?: boolean },
  ) {
    return this.routineExcel.commitRoutineUpload(
      user.tid,
      planId,
      buffer,
      options,
    );
  }

  exportRoutine(user: JwtUser, planId: string, scope?: string) {
    return this.routineExcel.exportRoutine(
      user.tid,
      planId,
      (scope as 'draft' | 'published' | 'faculty' | 'room') ?? 'draft',
    );
  }

  async approve(
    user: JwtUser,
    planId: string,
    dto?: { acknowledgeWarnings?: boolean; overrideReason?: string },
  ) {
    const validation = await this.conflicts.validatePlan(user.tid, planId);
    if (validation.blockingConflicts && !dto?.acknowledgeWarnings) {
      throw new BadRequestException(
        `Cannot approve timetable: ${validation.blockingConflicts} blocking conflicts found.`,
      );
    }
    if (dto?.acknowledgeWarnings && validation.totalConflicts) {
      await this.audit(
        user,
        planId,
        'CONFLICT_OVERRIDE',
        'TimetablePlan',
        planId,
        null,
        {
          overrideReason: dto.overrideReason,
          totalConflicts: validation.totalConflicts,
        },
      );
    }
    return this.transition(user, planId, {
      status: 'APPROVED',
      approvalState: 'ACADEMIC_OFFICE_APPROVED',
      approvedAt: new Date(),
      approvedById: user.sub,
    });
  }

  async publish(
    user: JwtUser,
    planId: string,
    dto?: { acknowledgeWarnings?: boolean; overrideReason?: string },
  ) {
    const validation = await this.conflicts.validatePlan(user.tid, planId);
    if (validation.blockingConflicts && !dto?.acknowledgeWarnings) {
      throw new BadRequestException(
        `Cannot publish timetable: ${validation.blockingConflicts} blocking conflicts found. Use acknowledgeWarnings to override warnings.`,
      );
    }
    if (dto?.acknowledgeWarnings && validation.totalConflicts) {
      await this.audit(
        user,
        planId,
        'CONFLICT_OVERRIDE',
        'TimetablePlan',
        planId,
        null,
        {
          overrideReason: dto.overrideReason,
          totalConflicts: validation.totalConflicts,
        },
      );
    }
    const plan = await this.transition(user, planId, {
      status: 'PUBLISHED',
      approvalState: 'PUBLISHED',
      publishedAt: new Date(),
      publishedById: user.sub,
    });
    await this.mirrorPublishedEntries(user.tid, planId);
    try {
      await this.attendance.generateFromTimetable(user, {
        date: new Date().toISOString().slice(0, 10),
        timetablePlanId: planId,
      });
    } catch {
      // Attendance generation is best-effort on publish
    }
    void this.notifyTimetablePublished(user.tid, plan);
    return plan;
  }

  private async notifyTimetablePublished(
    tenantId: string,
    plan: {
      id: string;
      name: string;
      shiftId?: string | null;
      semesterSequence?: number | null;
    },
  ) {
    const shift = plan.shiftId
      ? await this.prisma.shift.findFirst({
          where: { id: plan.shiftId, tenantId },
          select: { name: true },
        })
      : null;
    const institutionName =
      await this.communication.getInstitutionName(tenantId);
    const semester = plan.semesterSequence
      ? `Semester ${plan.semesterSequence}`
      : '';

    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(plan.shiftId ? { primaryShiftId: plan.shiftId } : {}),
      },
      include: {
        user: {
          select: { id: true, email: true, displayName: true, isActive: true },
        },
        masterProfile: { select: { fullName: true, email: true } },
      },
      take: 2000,
    });

    await this.communication.triggerBulk({
      tenantId,
      templateCode: 'TIMETABLE_PUBLISHED',
      triggerKey: `timetable.published.${plan.id}`,
      entityType: 'timetable_plan_student',
      channels: ['EMAIL', 'IN_APP'],
      recipients: students
        .filter((s) => s.user.isActive)
        .map((s) => {
          const displayName =
            s.masterProfile?.fullName ?? s.user.displayName ?? s.user.email;
          return {
            entityId: s.id,
            recipient: {
              recipientType: 'STUDENT' as const,
              userId: s.userId,
              studentId: s.id,
              displayName,
              email: s.masterProfile?.email ?? s.user.email,
            },
            variables: {
              student_name: displayName,
              plan_name: plan.name,
              shift_name: shift?.name ?? '',
              semester,
              institution_name: institutionName,
            },
          };
        }),
    });
  }

  async substitutions(user: JwtUser, planId: string) {
    return this.prisma.timetableSubstitution.findMany({
      where: { tenantId: user.tid, planId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubstitution(
    user: JwtUser,
    dto: {
      planId: string;
      originalEntryId?: string;
      newEntryId?: string;
      action: string;
      substituteStaffProfileId?: string;
      classroomId?: string;
      sessionDate?: string;
      reason?: string;
    },
  ) {
    const sub = await this.prisma.timetableSubstitution.create({
      data: {
        tenantId: user.tid,
        planId: dto.planId,
        originalEntryId: dto.originalEntryId,
        newEntryId: dto.newEntryId,
        action: dto.action,
        substituteStaffProfileId: dto.substituteStaffProfileId,
        classroomId: dto.classroomId,
        sessionDate: dto.sessionDate ? new Date(dto.sessionDate) : null,
        reason: dto.reason,
        createdById: user.sub,
      },
    });
    await this.audit(
      user,
      dto.planId,
      'CREATE_SUBSTITUTION',
      'TimetableSubstitution',
      sub.id,
      null,
      sub,
    );
    return sub;
  }

  async facultyWeek(
    user: JwtUser,
    staffProfileId?: string,
    filters?: { shiftId?: string; streamId?: string },
  ) {
    const resolvedStaffId = staffProfileId ?? (await this.staffIdForUser(user));
    if (!resolvedStaffId) return { entries: [] };
    const plan = await this.latestPublishedPlan(user.tid, filters);
    if (!plan) return { entries: [] };
    const matrix = await this.print.matrix(user.tid, plan.id, {
      staffProfileId: resolvedStaffId,
    });
    return { plan, ...matrix };
  }

  async studentWeek(
    user: JwtUser,
    filters?: { shiftId?: string; streamId?: string },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId: user.tid, userId: user.sub, deletedAt: null },
      include: {
        semesterRegistrations: {
          include: { lines: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      } as any,
    } as any);
    const plan = await this.latestPublishedPlan(user.tid, {
      shiftId:
        filters?.shiftId ?? (student as any)?.primaryShiftId ?? undefined,
      streamId: filters?.streamId ?? (student as any)?.streamId ?? undefined,
    });
    if (!plan) return { entries: [] };

    const lines: { offeringId?: string; offeringSectionId?: string | null }[] =
      (student as any)?.semesterRegistrations?.[0]?.lines ?? [];
    const offeringIds = [
      ...new Set(lines.map((line) => line.offeringId).filter(Boolean)),
    ] as string[];
    if (!offeringIds.length) return { plan, entries: [] };

    const sectionByOffering = new Map<string, Set<string | null>>();
    for (const line of lines) {
      if (!line.offeringId) continue;
      if (!sectionByOffering.has(line.offeringId)) {
        sectionByOffering.set(line.offeringId, new Set());
      }
      sectionByOffering
        .get(line.offeringId)!
        .add(line.offeringSectionId ?? null);
    }

    const allEntries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId: user.tid,
        planId: plan.id,
        deletedAt: null,
        courseOfferingId: { in: offeringIds },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const entries = allEntries.filter((entry) => {
      if (!entry.courseOfferingId) return false;
      const enrolledSections = sectionByOffering.get(entry.courseOfferingId);
      if (!enrolledSections) return false;
      if (entry.offeringSectionId == null) return true;
      if (enrolledSections.has(null)) return true;
      return enrolledSections.has(entry.offeringSectionId);
    });

    return {
      plan,
      entries: entries.map((entry) => ({
        ...entry,
        startTime: formatShiftTime(entry.startTime),
        endTime: formatShiftTime(entry.endTime),
      })),
    };
  }

  async roomWeek(
    user: JwtUser,
    classroomId: string,
    filters?: { shiftId?: string; streamId?: string },
  ) {
    const plan = await this.latestPublishedPlan(user.tid, filters);
    if (!plan) return { entries: [] };
    return {
      plan,
      ...(await this.print.matrix(user.tid, plan.id, { classroomId })),
    };
  }

  async todayLectureSessions(
    user: JwtUser,
    date = new Date(),
    filters?: { shiftId?: string; streamId?: string; staffProfileId?: string },
  ) {
    const plan = await this.latestPublishedPlan(user.tid, filters);
    if (!plan) return [];
    const dayOfWeek = date.getDay() || 7;
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId: user.tid,
        planId: plan.id,
        dayOfWeek,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        ...(filters?.staffProfileId
          ? { staffProfileId: filters.staffProfileId }
          : {}),
      },
      orderBy: { startTime: 'asc' },
    });
    return entries.map((entry) => ({
      ...entry,
      sessionDate: date.toISOString().slice(0, 10),
      startTime: formatShiftTime(entry.startTime),
      endTime: formatShiftTime(entry.endTime),
    }));
  }

  private async transition(
    user: JwtUser,
    planId: string,
    data: Record<string, unknown>,
  ) {
    const existing = await this.prisma.timetablePlan.findFirst({
      where: { id: planId, tenantId: user.tid, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Timetable plan not found');
    const updated = await this.prisma.timetablePlan.update({
      where: { id: planId },
      data,
    });
    await this.audit(
      user,
      planId,
      'PLAN_TRANSITION',
      'TimetablePlan',
      planId,
      existing,
      updated,
    );
    return updated;
  }

  private async assertEditablePlan(tenantId: string, planId: string) {
    const plan = await this.prisma.timetablePlan.findFirst({
      where: { id: planId, tenantId, deletedAt: null },
    });
    if (!plan) throw new NotFoundException('Timetable plan not found');
    if (plan.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Published timetable is locked. Use substitution or create a new revision.',
      );
    }
    return plan;
  }

  private async mirrorPublishedEntries(tenantId: string, planId: string) {
    const entries = await this.prisma.timetablePlanEntry.findMany({
      where: {
        tenantId,
        planId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
      },
    });
    await this.prisma.timetableEntry.deleteMany({
      where: { tenantId, timetablePlanId: planId },
    });
    if (!entries.length) return;
    await this.prisma.timetableEntry.createMany({
      data: entries
        .filter((entry) => entry.shiftId)
        .map((entry) => ({
          tenantId,
          shiftId: entry.shiftId as string,
          timetablePlanId: planId,
          timetablePlanEntryId: entry.id,
          offeringSectionId: entry.offeringSectionId,
          staffProfileId: entry.staffProfileId,
          classroomId: entry.classroomId,
          dayOfWeek: entry.dayOfWeek,
          startTime: entry.startTime,
          endTime: entry.endTime,
          status: 'scheduled',
        })),
    });
  }

  private async latestPublishedPlan(
    tenantId: string,
    filters?: { shiftId?: string; streamId?: string; academicYearId?: string },
  ) {
    return this.prisma.timetablePlan.findFirst({
      where: {
        tenantId,
        status: 'PUBLISHED',
        deletedAt: null,
        ...(filters?.shiftId ? { shiftId: filters.shiftId } : {}),
        ...(filters?.academicYearId
          ? { academicYearId: filters.academicYearId }
          : {}),
        ...(filters?.streamId
          ? {
              metadata: { path: ['streamId'], equals: filters.streamId } as any,
            }
          : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  private async staffIdForUser(user: JwtUser) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { tenantId: user.tid, portalUserId: user.sub, deletedAt: null },
      select: { id: true },
    });
    return staff?.id;
  }

  private async academicCycleContext(tenantId: string, institutionId?: string) {
    const config = await this.prisma.institutionAcademicConfig.findFirst({
      where: {
        tenantId,
        ...(institutionId ? { institutionId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    const currentCycle = this.normalizeCycle(config?.currentCycle ?? 'ODD');
    return {
      currentCycle,
      allowedSemesters: FYUGP_SEMESTERS_BY_CYCLE[currentCycle],
      blockedSemesters: this.blockedSemesters(currentCycle),
    };
  }

  private blockedSemesters(cycle: 'ODD' | 'EVEN') {
    return cycle === 'ODD'
      ? FYUGP_SEMESTERS_BY_CYCLE.EVEN
      : FYUGP_SEMESTERS_BY_CYCLE.ODD;
  }

  private normalizeCycle(value: unknown): 'ODD' | 'EVEN' {
    return String(value ?? 'ODD').toUpperCase() === 'EVEN' ? 'EVEN' : 'ODD';
  }

  private normalizeDepartmentName(value?: string | null) {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private groupStreamsForContext(
    streams: Array<{
      id: string;
      code: string;
      name: string;
      description?: string | null;
    }>,
  ) {
    const groupCodes = new Set(['ARTS', 'SCIENCE', 'COMMERCE']);
    const departmentStreams = streams.filter(
      (stream) => !groupCodes.has(stream.code.toUpperCase()),
    );
    const departmentsByGroup = new Map<string, string[]>();
    for (const stream of departmentStreams) {
      const group =
        this.streamGroupFromDescription(stream.description) ?? 'OTHER';
      const list = departmentsByGroup.get(group) ?? [];
      list.push(stream.name);
      departmentsByGroup.set(group, list);
    }
    return streams.map((stream) => {
      const code = stream.code.toUpperCase();
      const group = this.streamGroupFromDescription(stream.description);
      return {
        id: stream.id,
        code: stream.code,
        name: stream.name,
        group: group ?? (groupCodes.has(code) ? code : null),
        departments: groupCodes.has(code)
          ? (departmentsByGroup.get(code) ??
            DEFAULT_STREAM_DEPARTMENTS[code] ??
            [])
          : [],
      };
    });
  }

  private streamGroupFromDescription(description?: string | null) {
    const match = String(description ?? '').match(/group:([A-Z]+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  private dedupeAcademicYears<
    T extends {
      id: string;
      name: string;
      status?: string | null;
      startDate?: Date | null;
    },
  >(years: T[]) {
    const byName = new Map<string, T>();
    for (const year of years) {
      const key = year.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, year);
        continue;
      }
      const preferCurrent =
        year.status === 'ACTIVE' && existing.status !== 'ACTIVE'
          ? year
          : existing.status === 'ACTIVE' && year.status !== 'ACTIVE'
            ? existing
            : (year.startDate?.getTime() ?? 0) >=
                (existing.startDate?.getTime() ?? 0)
              ? year
              : existing;
      byName.set(key, preferCurrent);
    }
    return Array.from(byName.values()).sort(
      (a, b) => (b.startDate?.getTime() ?? 0) - (a.startDate?.getTime() ?? 0),
    );
  }

  private scopeDepartmentFilter<T extends { departmentId?: string }>(
    user: JwtUser,
    filters: T,
  ): T {
    if (this.isCentralTimetableUser(user)) return filters;
    return filters;
  }

  private async assertDepartmentAllocationAccess(
    user: JwtUser,
    offeringSectionId?: string,
  ) {
    if (this.isCentralTimetableUser(user)) return;
    if (!offeringSectionId)
      throw new BadRequestException('Offering section is required');
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
    const departmentId =
      section?.courseOffering?.course?.departmentId ??
      section?.courseOffering?.programVersion?.program?.departmentId;
    if (!departmentId)
      throw new BadRequestException('Teaching section has no department');
    const allowedDepartments = await this.allocations.departmentIdsForUser(
      user.tid,
      user.sub,
    );
    if (!allowedDepartments.includes(departmentId)) {
      throw new BadRequestException(
        'HOD can update only their own department allocations',
      );
    }
  }

  private isCentralTimetableUser(user: JwtUser) {
    const permissions = new Set(user.permissions ?? []);
    return (
      permissions.has('shift:timetable:manage') ||
      permissions.has('academic:timetable:manage')
    );
  }

  private audit(
    user: JwtUser,
    planId: string,
    action: string,
    entityType: string,
    entityId: string,
    beforeState: unknown,
    afterState: unknown,
  ) {
    return this.prisma.timetableAuditLog.create({
      data: {
        tenantId: user.tid,
        planId,
        action,
        entityType,
        entityId,
        actorId: user.sub,
        beforeState: beforeState as any,
        afterState: afterState as any,
        rollbackPayload: beforeState ? { restore: beforeState } : undefined,
      },
    });
  }
}
