import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { isStudentEligibleForSection } from '../../../common/utils/stream-eligibility';
import { OfferingSectionStreamsService } from '../../../common/services/offering-section-streams.service';
import { sectionStreamInclude } from '../../programs-courses/academic-catalog.service';
import { AcademicEngineService } from '../academic-engine.service';
import type { RegistrationLineDto } from '../dto/academic-engine.dto';
import { courseMatchesSubjectPath } from '../domain/course-subject-slug';
import { slugifySubject } from '../domain/nep-categories';
import {
  RegistrationWorkflowService,
  type RegistrationWorkflowSettings,
} from './registration-workflow.service';
import {
  mandatoryFlagForCategory,
  shouldAutoAssignCategory,
  unfilledElectiveSlots,
  type AssignMode,
  type BulkGenerateMode,
} from '../domain/registration-category-classification';
import { CurriculumResolutionService } from './curriculum-resolution.service';
import {
  requiredMajorPaperCount,
  resolveMajorPaperForSlot,
} from '../domain/major-paper-assignment';
import { StudentMajorMinorTrackService } from './student-major-minor-track.service';
import { StudentVtcTrackService } from './student-vtc-track.service';
import { CourseEligibilityService } from './course-eligibility.service';

export type {
  RegistrationWorkflowSettings,
  RegistrationWorkflowMode,
} from './registration-workflow.service';

export type ListRegistrationsFilters = {
  semesterId?: string;
  programVersionId?: string;
  admissionBatchId?: string;
  shiftId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type BulkAutoAssignDto = {
  semesterId: string;
  semesterSequence: number;
  programVersionId?: string;
  admissionBatchId?: string;
  shiftId?: string;
  submitAfterAssign?: boolean;
  studentIds?: string[];
  assignMode?: AssignMode;
};

export type BulkGenerateDto = {
  semesterId: string;
  semesterSequence: number;
  programVersionId?: string;
  admissionBatchId?: string;
  shiftId?: string;
  studentIds?: string[];
  mode: BulkGenerateMode;
  submitAfter?: boolean;
  assignMode?: AssignMode;
};

@Injectable()
export class AdminRegistrationService {
  private readonly logger = new Logger(AdminRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AcademicEngineService,
    private readonly sectionStreams: OfferingSectionStreamsService,
    private readonly workflow: RegistrationWorkflowService,
    private readonly curriculum: CurriculumResolutionService,
    private readonly majorMinorTrack: StudentMajorMinorTrackService,
    private readonly vtcTrack: StudentVtcTrackService,
    private readonly courseEligibility: CourseEligibilityService,
  ) {}

  parseWorkflow(raw: unknown): RegistrationWorkflowSettings {
    return this.workflow.parseWorkflow(raw);
  }

  async getWorkflowForStudent(tenantId: string, studentId: string) {
    return this.workflow.getForStudent(tenantId, studentId);
  }

  async getWorkflowForInstitution(tenantId: string, institutionId: string) {
    return this.workflow.getForInstitution(tenantId, institutionId);
  }

  async updateWorkflow(
    tenantId: string,
    institutionId: string,
    settings: Partial<RegistrationWorkflowSettings>,
  ) {
    return this.workflow.updateForInstitution(
      tenantId,
      institutionId,
      settings,
    );
  }

  assertStudentSelfServiceAllowed(workflow: RegistrationWorkflowSettings) {
    this.workflow.assertStudentSelfServiceAllowed(workflow);
  }

  async listRegistrations(tenantId: string, filters: ListRegistrationsFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const skip = (page - 1) * limit;

    const search = filters.search?.trim();
    const studentWhere = {
      tenantId,
      deletedAt: null,
      ...(filters.programVersionId
        ? { programVersionId: filters.programVersionId }
        : {}),
      ...(filters.shiftId ? { primaryShiftId: filters.shiftId } : {}),
      ...(filters.admissionBatchId
        ? {
            academicProfile: { admissionBatchId: filters.admissionBatchId },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                enrollmentNumber: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                user: {
                  email: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                masterProfile: {
                  fullName: { contains: search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };

    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where: studentWhere,
        skip,
        take: limit,
        orderBy: { enrollmentNumber: 'asc' },
        include: {
          user: { select: { email: true } },
          masterProfile: { select: { fullName: true } },
          academicStanding: true,
          academicProfile: {
            include: { admissionBatch: { select: { batchCode: true } } },
          },
          programVersion: {
            include: { program: { select: { code: true, name: true } } },
          },
          semesterRegistrations: {
            where: {
              ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
              ...(filters.status ? { status: filters.status } : {}),
            },
            include: {
              lines: {
                include: {
                  offering: { include: { course: true } },
                },
              },
              semester: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.student.count({ where: studentWhere }),
    ]);

    return {
      page,
      limit,
      total,
      items: students.map((s) => ({
        studentId: s.id,
        enrollmentNumber: s.enrollmentNumber,
        email: s.user.email,
        fullName: s.masterProfile?.fullName ?? s.user.email,
        programCode: s.programVersion?.program.code,
        programName: s.programVersion?.program.name,
        batchCode: s.academicProfile?.admissionBatch?.batchCode,
        currentSemester: s.academicStanding?.currentSemesterSequence ?? 1,
        registrationLocked: s.academicStanding?.registrationLocked ?? false,
        registration: s.semesterRegistrations[0] ?? null,
      })),
    };
  }

  async getStudentRegistrationContext(
    tenantId: string,
    studentId: string,
    semesterId?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
      include: {
        user: { select: { email: true } },
        masterProfile: { select: { fullName: true } },
        academicStanding: true,
        academicProfile: { include: { stream: true } },
        programChoices: { where: { status: 'active', deletedAt: null } },
        programVersion: { include: { program: true } },
        primaryShift: true,
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const standing = student.academicStanding;
    const seq = standing?.currentSemesterSequence ?? 1;

    let targetSemesterId = semesterId;
    if (!targetSemesterId && student.campusId) {
      const campus = await this.prisma.campus.findUnique({
        where: { id: student.campusId },
      });
      if (campus?.institutionId) {
        const sem = await this.prisma.semester.findFirst({
          where: {
            tenantId,
            institutionId: campus.institutionId,
            semesterNumber: seq,
            isActive: true,
            deletedAt: null,
          },
          orderBy: { startDate: 'desc' },
        });
        targetSemesterId = sem?.id;
      }
    }

    const registration = targetSemesterId
      ? await this.prisma.semesterRegistration.findFirst({
          where: { tenantId, studentId, semesterId: targetSemesterId },
          include: {
            lines: {
              include: {
                offering: { include: { course: true } },
                offeringSection: { include: { shift: true } },
              },
            },
            semester: true,
          },
        })
      : null;

    const workflow = await this.getWorkflowForStudent(tenantId, studentId);

    const [majorMinorTrack, vtcTrack, canChangeMajorMinor] = await Promise.all([
      this.majorMinorTrack.getTrack(tenantId, studentId),
      this.vtcTrack.getTrack(tenantId, studentId),
      this.majorMinorTrack.canChangeMajorMinor(tenantId, studentId),
    ]);

    return {
      student: {
        id: student.id,
        enrollmentNumber: student.enrollmentNumber,
        email: student.user.email,
        fullName: student.masterProfile?.fullName,
        programVersionId: student.programVersionId,
        programCode: student.programVersion?.program.code,
        primaryShiftId: student.primaryShiftId,
        primaryShiftCode: student.primaryShift?.code,
        streamId: student.academicProfile?.streamId,
        streamCode: student.academicProfile?.stream?.code,
      },
      standing,
      choices: student.programChoices,
      registration,
      semesterId: targetSemesterId,
      semesterSequence: seq,
      workflow,
      majorMinorTrack,
      vtcTrack,
      canChangeMajorMinor,
      class12Subjects:
        (student.academicProfile?.class12Subjects as
          | { name: string }[]
          | null) ?? [],
    };
  }

  async autoAssignRegistration(
    tenantId: string,
    registrationId: string,
    actorId?: string,
    assignMode: AssignMode = 'COMPULSORY_ONLY',
  ) {
    const reg = await this.engine.getRegistration(tenantId, registrationId);
    if (reg.status !== 'draft') {
      throw new BadRequestException(
        'Only draft registrations can be auto-assigned',
      );
    }

    const lines = await this.buildAutoAssignLines(tenantId, reg, assignMode);
    await this.engine.updateRegistrationLines(tenantId, registrationId, lines, {
      registrationSource: 'AUTO_GENERATED',
      assignedById: actorId,
    });

    await this.prisma.registrationAuditLog.create({
      data: {
        tenantId,
        registrationId,
        action: 'auto_assigned',
        actorId,
        metadata: { lineCount: lines.length, assignMode },
      },
    });

    return this.engine.getRegistration(tenantId, registrationId);
  }

  async bulkAutoAssign(
    tenantId: string,
    dto: BulkAutoAssignDto,
    actorId?: string,
  ) {
    return this.bulkGenerate(
      tenantId,
      {
        ...dto,
        mode: 'FULL',
        submitAfter: dto.submitAfterAssign,
        assignMode: dto.assignMode ?? 'ALL_CATEGORIES',
      },
      actorId,
    );
  }

  async bulkGenerate(tenantId: string, dto: BulkGenerateDto, actorId?: string) {
    const studentWhere = {
      tenantId,
      deletedAt: null,
      ...(dto.programVersionId
        ? { programVersionId: dto.programVersionId }
        : {}),
      ...(dto.shiftId ? { primaryShiftId: dto.shiftId } : {}),
      ...(dto.admissionBatchId
        ? { academicProfile: { admissionBatchId: dto.admissionBatchId } }
        : {}),
      ...(dto.studentIds?.length ? { id: { in: dto.studentIds } } : {}),
    };

    const students = await this.prisma.student.findMany({
      where: studentWhere,
      select: { id: true },
    });

    const assignMode =
      dto.assignMode ??
      (dto.mode === 'FULL' ? 'ALL_CATEGORIES' : 'COMPULSORY_ONLY');

    const results: {
      studentId: string;
      ok: boolean;
      registrationId?: string;
      status?: string;
      electiveSlots?: {
        category: string;
        required: number;
        filled: number;
        remaining: number;
      }[];
      error?: string;
    }[] = [];

    for (const { id: studentId } of students) {
      try {
        const existing = await this.prisma.semesterRegistration.findFirst({
          where: {
            tenantId,
            studentId,
            semesterId: dto.semesterId,
          },
        });

        const created = !existing;
        let registration = existing
          ? await this.engine.getRegistration(tenantId, existing.id)
          : await this.engine.createRegistration(tenantId, studentId, {
              semesterId: dto.semesterId,
              semesterSequence: dto.semesterSequence,
            });

        if (dto.mode !== 'DRAFT_ONLY') {
          if (registration.status !== 'draft') {
            results.push({
              studentId,
              ok: false,
              registrationId: registration.id,
              status: registration.status,
              error: `Registration status is ${registration.status}`,
            });
            continue;
          }

          const modeForAssign =
            dto.mode === 'FULL' ? 'ALL_CATEGORIES' : assignMode;
          await this.autoAssignRegistration(
            tenantId,
            registration.id,
            actorId,
            modeForAssign,
          );
          registration = await this.engine.getRegistration(
            tenantId,
            registration.id,
          );
        }

        let electiveSlots:
          | {
              category: string;
              required: number;
              filled: number;
              remaining: number;
            }[]
          | undefined;

        if (
          dto.mode === 'PREPARE_ELECTIVES' ||
          dto.mode === 'COMPULSORY_ONLY'
        ) {
          electiveSlots = await this.computeElectiveSlots(
            tenantId,
            studentId,
            dto.semesterSequence,
            registration.lines.map((l) => l.category),
          );
        }

        if (dto.submitAfter && registration.status === 'draft') {
          await this.engine.submitRegistration(
            tenantId,
            registration.id,
            actorId,
          );
          registration = await this.engine.getRegistration(
            tenantId,
            registration.id,
          );
        }

        results.push({
          studentId,
          ok: true,
          registrationId: registration.id,
          status: registration.status,
          electiveSlots,
          ...(created ? {} : {}),
        });
      } catch (e) {
        results.push({
          studentId,
          ok: false,
          error: e instanceof Error ? e.message : 'Generation failed',
        });
      }
    }

    return {
      total: students.length,
      successful: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  private async computeElectiveSlots(
    tenantId: string,
    studentId: string,
    semesterSequence: number,
    lineCategories: string[],
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { programVersionId: true },
    });
    if (!student?.programVersionId) return [];

    const rule = await this.prisma.semesterStructureRule.findFirst({
      where: {
        tenantId,
        programVersionId: student.programVersionId,
        semesterSequence,
      },
      include: { lines: true },
    });
    if (!rule) return [];

    const workflow = await this.getWorkflowForStudent(tenantId, studentId);
    const filledByCategory: Record<string, number> = {};
    for (const cat of lineCategories) {
      filledByCategory[cat] = (filledByCategory[cat] ?? 0) + 1;
    }

    return unfilledElectiveSlots(
      rule.categoryCounts as Record<string, number>,
      rule.lines,
      workflow.studentElectiveCategories,
      filledByCategory,
    );
  }

  async setRegistrationFrozen(
    tenantId: string,
    frozen: boolean,
    filters: {
      studentIds?: string[];
      admissionBatchId?: string;
      programVersionId?: string;
    },
  ) {
    const where = {
      tenantId,
      student: {
        tenantId,
        deletedAt: null,
        ...(filters.studentIds?.length
          ? { id: { in: filters.studentIds } }
          : {}),
        ...(filters.programVersionId
          ? { programVersionId: filters.programVersionId }
          : {}),
        ...(filters.admissionBatchId
          ? { academicProfile: { admissionBatchId: filters.admissionBatchId } }
          : {}),
      },
    };

    const updated = await this.prisma.studentAcademicStanding.updateMany({
      where,
      data: { registrationLocked: frozen },
    });

    return { updated: updated.count, frozen };
  }

  async buildAutoAssignLinesForStudent(
    tenantId: string,
    studentId: string,
    programVersionId: string,
    semesterSequence: number,
    opts?: {
      shiftId?: string;
      streamId?: string;
      assignMode?: AssignMode;
      skipCategories?: string[];
    },
  ): Promise<RegistrationLineDto[]> {
    const semester = await this.prisma.semester.findFirst({
      where: { tenantId, semesterNumber: semesterSequence },
      orderBy: { startDate: 'desc' },
    });
    return this.buildAutoAssignLines(
      tenantId,
      {
        id: 'pending',
        studentId,
        semesterSequence,
        semesterId: semester?.id ?? 'pending',
      },
      opts?.assignMode ?? 'COMPULSORY_ONLY',
      {
        programVersionId,
        shiftId: opts?.shiftId,
        streamId: opts?.streamId,
        skipCategories: opts?.skipCategories,
      },
    );
  }

  private async buildAutoAssignLines(
    tenantId: string,
    reg: {
      id: string;
      studentId: string;
      semesterSequence: number;
      semesterId: string;
    },
    assignMode: AssignMode = 'COMPULSORY_ONLY',
    overrides?: {
      programVersionId?: string;
      shiftId?: string;
      streamId?: string;
      skipCategories?: string[];
    },
  ): Promise<RegistrationLineDto[]> {
    const student = await this.prisma.student.findFirstOrThrow({
      where: { id: reg.studentId, tenantId },
      include: {
        academicProfile: true,
        programChoices: { where: { status: 'active', deletedAt: null } },
      },
    });
    const programVersionId =
      overrides?.programVersionId ?? student.programVersionId;
    if (!programVersionId) {
      throw new BadRequestException('Student has no program version');
    }

    const rule = await this.prisma.semesterStructureRule.findFirst({
      where: {
        tenantId,
        programVersionId,
        semesterSequence: reg.semesterSequence,
      },
      include: { lines: true },
    });
    if (!rule) {
      throw new BadRequestException(
        `No semester structure rule for sequence ${reg.semesterSequence}`,
      );
    }

    const workflow = await this.getWorkflowForStudent(tenantId, reg.studentId);
    const eligibilityCtx = await this.courseEligibility.buildContextFromStudent(
      tenantId,
      reg.studentId,
    );
    const categoryCounts = rule.categoryCounts as Record<string, number>;
    const continuityRules = (rule.continuityRules ?? {}) as Record<
      string,
      string
    >;

    const priorReg = await this.prisma.semesterRegistration.findFirst({
      where: {
        tenantId,
        studentId: reg.studentId,
        semesterSequence: reg.semesterSequence - 1,
        status: 'completed',
      },
      include: { lines: { where: { status: 'confirmed' } } },
    });
    const priorByCategoryAndPaper = new Map<string, string>();
    const priorMajorLines = (priorReg?.lines ?? []).filter(
      (l) => l.category === 'MAJOR',
    );
    for (let i = 0; i < priorMajorLines.length; i++) {
      priorByCategoryAndPaper.set(
        `MAJOR-${i + 1}`,
        priorMajorLines[i]!.offeringId,
      );
    }
    for (const line of priorReg?.lines ?? []) {
      if (line.category !== 'MAJOR') {
        priorByCategoryAndPaper.set(line.category, line.offeringId);
      }
    }

    const majorChoice = student.programChoices.find(
      (c) => c.choiceType === 'MAJOR',
    );
    const minorChoice = student.programChoices.find(
      (c) => c.choiceType === 'MINOR',
    );
    const class12Slugs = new Set(
      (
        (student.academicProfile?.class12Subjects as { name: string }[]) ?? []
      ).map((s) => slugifySubject(s.name)),
    );
    if (majorChoice) class12Slugs.add(majorChoice.subjectSlug);
    if (minorChoice) class12Slugs.add(minorChoice.subjectSlug);

    const shiftId =
      overrides?.shiftId ??
      student.primaryShiftId ??
      student.academicProfile?.preferredShiftId;
    const streamId = overrides?.streamId ?? student.academicProfile?.streamId;

    const baseWhere = await this.curriculum.resolveCatalogSectionWhere(
      tenantId,
      programVersionId,
      reg.semesterSequence,
    );

    let sections = await this.prisma.offeringSection.findMany({
      where: {
        ...baseWhere,
        ...(shiftId ? { shiftId } : {}),
      },
      include: {
        shift: true,
        seatLedger: true,
        courseOffering: {
          include: { course: { include: { department: true } } },
        },
        ...sectionStreamInclude,
      },
    });

    sections = await this.curriculum.filterSectionsByPoolExclusions(
      tenantId,
      programVersionId,
      sections,
    );

    const eligibleSections = sections.filter((s) => {
      if (!streamId) return true;
      if (!s.courseOffering.categoryPoolId) return true;
      const streamIds = this.sectionStreams.eligibleStreamIdsFromSection(s);
      return isStudentEligibleForSection(streamId, streamIds);
    });

    const skipCategories = new Set(overrides?.skipCategories ?? []);
    const lines: RegistrationLineDto[] = [];

    const pickBestSection = <
      T extends {
        capacity: number;
        seatLedger?: { confirmedCount?: number | null } | null;
      },
    >(
      pool: T[],
    ): T | undefined => {
      return [...pool].sort((a, b) => {
        const availA = a.capacity - (a.seatLedger?.confirmedCount ?? 0);
        const availB = b.capacity - (b.seatLedger?.confirmedCount ?? 0);
        return availB - availA;
      })[0];
    };

    for (const [category, count] of Object.entries(categoryCounts)) {
      if (skipCategories.has(category)) continue;
      const mandatory = mandatoryFlagForCategory(category, rule.lines);

      if (
        category === 'MAJOR' &&
        requiredMajorPaperCount(categoryCounts) > 1 &&
        shouldAutoAssignCategory(
          category,
          mandatory,
          workflow.studentElectiveCategories,
          assignMode,
        )
      ) {
        let majorSections = eligibleSections.filter(
          (s) => s.courseOffering.category === 'MAJOR',
        );
        if (majorChoice) {
          majorSections = majorSections.filter((s) =>
            courseMatchesSubjectPath(
              s.courseOffering.course,
              majorChoice.subjectSlug,
            ),
          );
        }

        const bestSectionByCourseId = new Map<
          string,
          (typeof eligibleSections)[0]
        >();
        for (const section of majorSections) {
          const courseId = section.courseOffering.courseId;
          const existing = bestSectionByCourseId.get(courseId);
          if (
            !existing ||
            section.capacity - (section.seatLedger?.confirmedCount ?? 0) >
              existing.capacity - (existing.seatLedger?.confirmedCount ?? 0)
          ) {
            bestSectionByCourseId.set(courseId, section);
          }
        }

        const uniqueSections = [...bestSectionByCourseId.values()];
        this.logger.debug(
          `MAJOR auto-assign: fetched ${uniqueSections.length} unique papers, required ${count}`,
        );
        this.logger.debug(
          `MAJOR auto-assign: sorted course codes ${uniqueSections
            .map((s) => s.courseOffering.course.code)
            .sort()
            .join(', ')}`,
        );

        const usedCourseIds = new Set<string>();
        for (let paperIndex = 0; paperIndex < count; paperIndex++) {
          let slotPool = uniqueSections;

          if (continuityRules[category] === 'LOCK') {
            const priorOfferingId = priorByCategoryAndPaper.get(
              `MAJOR-${paperIndex + 1}`,
            );
            if (priorOfferingId) {
              slotPool = slotPool.filter(
                (s) => s.courseOfferingId === priorOfferingId,
              );
            }
          }

          const offeringRows = slotPool.map((s) => ({
            majorPaperIndex: s.courseOffering.majorPaperIndex,
            displayOrder: s.courseOffering.displayOrder,
            courseId: s.courseOffering.courseId,
            course: { code: s.courseOffering.course.code },
            section: s,
          }));

          const pickedRow = resolveMajorPaperForSlot(
            offeringRows,
            paperIndex,
            usedCourseIds,
          );
          if (!pickedRow) {
            throw new BadRequestException(
              `No eligible section for MAJOR paper ${paperIndex + 1}`,
            );
          }

          usedCourseIds.add(pickedRow.courseId);
          const picked = pickBestSection([pickedRow.section]);
          if (!picked) {
            throw new BadRequestException(
              `No eligible section for MAJOR paper ${paperIndex + 1}`,
            );
          }

          this.logger.debug(
            `MAJOR auto-assign: slot ${paperIndex + 1} → ${picked.courseOffering.course.code} (${picked.courseOfferingId})`,
          );

          lines.push({
            category,
            offeringId: picked.courseOfferingId,
            offeringSectionId: picked.id,
          });
        }
        continue;
      }

      for (let paperIndex = 0; paperIndex < count; paperIndex++) {
        if (
          !shouldAutoAssignCategory(
            category,
            mandatory,
            workflow.studentElectiveCategories,
            assignMode,
          )
        ) {
          continue;
        }

        const majorPaperIndex =
          category === 'MAJOR' && count > 1 ? paperIndex + 1 : undefined;

        let pool = eligibleSections.filter(
          (s) => s.courseOffering.category === category,
        );

        if (majorPaperIndex != null) {
          pool = pool.filter(
            (s) => s.courseOffering.majorPaperIndex === majorPaperIndex,
          );
        }

        if (continuityRules[category] === 'LOCK') {
          const priorOfferingId =
            priorByCategoryAndPaper.get(
              majorPaperIndex != null ? `MAJOR-${majorPaperIndex}` : category,
            ) ?? priorByCategoryAndPaper.get(category);
          if (priorOfferingId) {
            pool = pool.filter((s) => s.courseOfferingId === priorOfferingId);
          }
        }

        if (category === 'MAJOR' && majorChoice) {
          const majorPool = pool.filter((s) =>
            courseMatchesSubjectPath(
              s.courseOffering.course,
              majorChoice.subjectSlug,
            ),
          );
          if (majorPool.length > 0) pool = majorPool;
        }

        if (category === 'MINOR' && minorChoice) {
          const minorPool = pool.filter((s) =>
            courseMatchesSubjectPath(
              s.courseOffering.course,
              minorChoice.subjectSlug,
            ),
          );
          if (minorPool.length > 0) pool = minorPool;
        }

        if (category === 'MDC') {
          pool = pool.filter((s) => {
            const slug =
              s.courseOffering.course.subjectSlug ??
              slugifySubject(s.courseOffering.course.title);
            return !class12Slugs.has(slug);
          });
        }

        if (category === 'VTC') {
          pool = await this.vtcTrack.filterVtcSectionsSync(
            tenantId,
            reg.studentId,
            reg.semesterSequence,
            pool,
          );
        }

        pool = this.courseEligibility.filterSections(pool, eligibilityCtx);

        const picked = pickBestSection(pool);
        if (!picked) {
          throw new BadRequestException(
            `No eligible section for ${category}${majorPaperIndex ? ` paper ${majorPaperIndex}` : ''}`,
          );
        }

        lines.push({
          category,
          offeringId: picked.courseOfferingId,
          offeringSectionId: picked.id,
        });
      }
    }

    return lines;
  }
}
