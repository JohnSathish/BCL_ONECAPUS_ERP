import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import {
  DEFAULT_DEGREE_MIN_CREDITS,
  DEFAULT_FYUGP_SEMESTER_RULES,
  DEFAULT_SEMESTER_CREDIT_TARGET,
  type SemesterRulePayload,
} from './domain/fyugp-templates';
import {
  buildPersistedRequirements,
  ruleRecordToPayload,
  upsertSemesterStructureRules,
} from './services/structure-rules.helper';
import { slugifySubject, type NepCategory } from './domain/nep-categories';
import { resolveAecSubjectSlug } from './domain/aec-eligibility';
import type { Class12Subject } from './domain/registration-context';
import { blockingValidationIssues, runValidators } from './domain/validators';
import type {
  CreateOfferingSectionDto,
  CreateProgramChoiceDto,
  CreateRegistrationDto,
  CreateRegistrationWindowDto,
  RegistrationLineDto,
  UpsertApprovalPolicyDto,
  UpsertStudentProfileDto,
  UpsertStructureDto,
} from './dto/academic-engine.dto';
import { AllocationService } from './services/allocation.service';
import { AnalyticsService } from './services/analytics.service';
import { ApprovalService } from './services/approval.service';
import { CreditLedgerService } from './services/credit-ledger.service';
import { CourseDeliveryFeeService } from '../../common/services/course-delivery-fee.service';
import { AcademicCatalogService } from '../programs-courses/academic-catalog.service';
import type { CatalogFilters } from './services/offerings.service';
import { OfferingsService } from './services/offerings.service';
import type { SectionMeta } from './domain/registration-context';
import { AcademicLifecycleService } from '../academic-lifecycle/academic-lifecycle.service';
import {
  RegistrationWorkflowService,
  type RegistrationWorkflowSettings,
} from './services/registration-workflow.service';
import { StudentMajorMinorTrackService } from './services/student-major-minor-track.service';
import { StudentVtcTrackService } from './services/student-vtc-track.service';
import { CourseEligibilityService } from './services/course-eligibility.service';
import {
  assignmentSourceForPool,
  MAPPING_SOURCE,
} from './domain/category-pools';

@Injectable()
export class AcademicEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly academicCatalog: AcademicCatalogService,
    private readonly offerings: OfferingsService,
    private readonly allocation: AllocationService,
    private readonly approval: ApprovalService,
    private readonly credits: CreditLedgerService,
    private readonly analytics: AnalyticsService,
    private readonly lifecycle: AcademicLifecycleService,
    private readonly deliveryFees: CourseDeliveryFeeService,
    private readonly registrationWorkflow: RegistrationWorkflowService,
    private readonly majorMinorTrack: StudentMajorMinorTrackService,
    private readonly vtcTrack: StudentVtcTrackService,
    private readonly courseEligibility: CourseEligibilityService,
  ) {}

  async getSummary(tenantId: string) {
    const [students, registrations, waitlisted, offerings] =
      await this.prisma.$transaction([
        this.prisma.student.count({ where: { tenantId, deletedAt: null } }),
        this.prisma.semesterRegistration.count({
          where: {
            tenantId,
            status: {
              in: ['submitted', 'pending_approval', 'approved', 'completed'],
            },
          },
        }),
        this.prisma.semesterRegistrationLine.count({
          where: { tenantId, status: 'waitlisted' },
        }),
        this.academicCatalog.countOfferings(tenantId, {
          semesterSequence: { lte: 3 },
        }),
      ]);
    return { students, registrations, waitlisted, offerings };
  }

  async getStructure(tenantId: string, programVersionId: string) {
    const template = await this.prisma.programStructureTemplate.findFirst({
      where: { tenantId, programVersionId },
      include: {
        stream: true,
        lastAppliedFyugpTemplate: { select: { id: true, templateName: true } },
      },
    });
    const rules = await this.prisma.semesterStructureRule.findMany({
      where: { tenantId, programVersionId },
      include: { lines: { orderBy: { categoryType: 'asc' } } },
      orderBy: { semesterSequence: 'asc' },
    });
    return { template, rules };
  }

  async upsertStructure(
    tenantId: string,
    programVersionId: string,
    dto: UpsertStructureDto,
  ) {
    await this.academicCatalog.assertProgramVersion(tenantId, programVersionId);

    const template = await this.prisma.programStructureTemplate.upsert({
      where: { programVersionId },
      create: {
        tenantId,
        programVersionId,
        streamId: dto.streamId,
        structureType: dto.structureType ?? 'FYUGP_4Y_8S',
        totalSemesters: dto.totalSemesters ?? 8,
        degreeMinCredits: dto.degreeMinCredits ?? DEFAULT_DEGREE_MIN_CREDITS,
        semesterCreditTarget:
          dto.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET,
      },
      update: {
        streamId: dto.streamId,
        structureType: dto.structureType,
        totalSemesters: dto.totalSemesters,
        ...(dto.degreeMinCredits !== undefined
          ? { degreeMinCredits: dto.degreeMinCredits }
          : {}),
        ...(dto.semesterCreditTarget !== undefined
          ? { semesterCreditTarget: dto.semesterCreditTarget }
          : {}),
      },
      include: { stream: true },
    });

    const rulesInput: SemesterRulePayload[] =
      dto.semesterRules ?? DEFAULT_FYUGP_SEMESTER_RULES;
    await upsertSemesterStructureRules(
      this.prisma,
      tenantId,
      programVersionId,
      rulesInput,
      template.semesterCreditTarget,
    );

    const rules = await this.prisma.semesterStructureRule.findMany({
      where: { programVersionId },
      include: { lines: { orderBy: { categoryType: 'asc' } } },
      orderBy: { semesterSequence: 'asc' },
    });
    return { template, rules };
  }

  listOfferings(
    tenantId: string,
    filters: {
      programVersionId?: string;
      semesterSequence?: number;
      category?: string;
    },
  ) {
    return this.offerings.listOfferings(tenantId, filters);
  }

  catalog(user: JwtUser, filters: CatalogFilters) {
    return this.offerings.catalog(user, filters);
  }

  listShifts(tenantId: string, campusId?: string) {
    return this.offerings.listShifts(tenantId, campusId);
  }

  listClassrooms(tenantId: string) {
    return this.offerings.listClassrooms(tenantId);
  }

  listOfferingSections(user: JwtUser, offeringId: string) {
    return this.offerings.listSections(user, offeringId);
  }

  createOfferingSection(
    user: JwtUser,
    offeringId: string,
    dto: CreateOfferingSectionDto,
  ) {
    return this.offerings.createSection(user, offeringId, dto);
  }

  updateOfferingCapacity(
    tenantId: string,
    offeringId: string,
    data: { capacity?: number; waitlistCapacity?: number },
  ) {
    return this.academicCatalog.updateOffering(tenantId, offeringId, data);
  }

  async getStudentProfile(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');

    const profile = await this.prisma.studentAcademicProfile.findUnique({
      where: { studentId },
      include: { stream: true },
    });
    const choices = await this.prisma.studentProgramChoice.findMany({
      where: { studentId, tenantId, status: 'active', deletedAt: null },
    });
    return { profile, choices };
  }

  async upsertStudentProfile(
    tenantId: string,
    studentId: string,
    dto: UpsertStudentProfileDto,
  ) {
    await this.assertStudent(tenantId, studentId);

    const stream = await this.prisma.academicStream.findFirst({
      where: {
        id: dto.streamId,
        tenantId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!stream) throw new BadRequestException('Invalid academic stream');

    const existing = await this.prisma.studentAcademicProfile.findUnique({
      where: { studentId },
    });
    if (
      existing?.streamId &&
      existing.streamId !== dto.streamId &&
      !dto.forceStreamChange
    ) {
      const standing = await this.prisma.studentAcademicStanding.findUnique({
        where: { studentId },
      });
      if (
        standing?.currentSemesterSequence &&
        standing.currentSemesterSequence > 0
      ) {
        throw new BadRequestException(
          'Academic stream cannot be changed after semester activation. Use admin override.',
        );
      }
    }

    const profile = await this.prisma.studentAcademicProfile.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        streamId: dto.streamId,
        admissionYearId: dto.admissionYearId,
        class12Subjects: (dto.class12Subjects ??
          []) as unknown as Prisma.InputJsonValue,
        languagePreferences: dto.languagePreferences as Prisma.InputJsonValue,
        languageEligibility: dto.languageEligibility as Prisma.InputJsonValue,
      },
      update: {
        streamId: dto.streamId,
        admissionYearId: dto.admissionYearId,
        class12Subjects:
          dto.class12Subjects as unknown as Prisma.InputJsonValue,
        languagePreferences: dto.languagePreferences as Prisma.InputJsonValue,
        languageEligibility: dto.languageEligibility as Prisma.InputJsonValue,
      },
      include: { stream: true },
    });
    return profile;
  }

  async createProgramChoice(
    tenantId: string,
    studentId: string,
    dto: CreateProgramChoiceDto,
  ) {
    await this.assertStudent(tenantId, studentId);
    await this.majorMinorTrack.assertCanChangeMajorMinor(tenantId, studentId);
    await this.prisma.studentProgramChoice.updateMany({
      where: {
        studentId,
        tenantId,
        choiceType: dto.choiceType,
        status: 'active',
      },
      data: { status: 'withdrawn', deletedAt: new Date() },
    });
    const choice = await this.prisma.studentProgramChoice.create({
      data: {
        tenantId,
        studentId,
        choiceType: dto.choiceType,
        subjectSlug: slugifySubject(dto.subjectSlug),
        departmentId: dto.departmentId,
        effectiveFromSemester: dto.effectiveFromSemester ?? 1,
        status: 'active',
      },
    });
    await this.majorMinorTrack.syncFromProgramChoices(tenantId, studentId);
    return choice;
  }

  async syncStudentTracks(tenantId: string, studentId: string) {
    await this.majorMinorTrack.syncFromProgramChoices(tenantId, studentId);
  }

  async unlockMajorMinorTrack(
    tenantId: string,
    studentId: string,
    userId: string,
    reason: string,
  ) {
    const track = await this.majorMinorTrack.unlockTrack(
      tenantId,
      studentId,
      userId,
      reason,
    );
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'academic-engine',
        action: 'major_minor_track_unlock',
        entityType: 'StudentMajorMinorTrack',
        entityId: track.id,
        metadata: { studentId, reason },
      },
    });
    return track;
  }

  async resetVtcTrack(
    tenantId: string,
    studentId: string,
    userId: string,
    reason: string,
    opts?: { trackGroupCode?: string; sem3OfferingId?: string },
  ) {
    const track = await this.vtcTrack.resetTrack(
      tenantId,
      studentId,
      userId,
      reason,
      opts,
    );
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'academic-engine',
        action: 'vtc_track_reset',
        entityType: 'StudentVtcTrack',
        entityId: track?.id ?? studentId,
        metadata: { studentId, reason, ...opts },
      },
    });
    return track;
  }

  async listRegistrationWindows(tenantId: string) {
    const windows = await this.prisma.registrationWindow.findMany({
      where: { tenantId },
      include: { semester: { include: { academicYear: true } } },
      orderBy: { opensAt: 'desc' },
    });
    const now = new Date();
    return windows.map((w) => ({
      ...w,
      status: w.locked
        ? ('LOCKED' as const)
        : now >= w.opensAt && now <= w.closesAt
          ? ('OPEN' as const)
          : ('CLOSED' as const),
    }));
  }

  createRegistrationWindow(tenantId: string, dto: CreateRegistrationWindowDto) {
    return this.prisma.registrationWindow.create({
      data: {
        tenantId,
        semesterId: dto.semesterId,
        name: dto.name,
        opensAt: new Date(dto.opensAt),
        closesAt: new Date(dto.closesAt),
      },
      include: { semester: true },
    });
  }

  async setWindowLocked(tenantId: string, windowId: string, locked: boolean) {
    const win = await this.prisma.registrationWindow.findFirst({
      where: { id: windowId, tenantId },
    });
    if (!win) throw new NotFoundException('Registration window not found');
    return this.prisma.registrationWindow.update({
      where: { id: windowId },
      data: { locked },
    });
  }

  async getRegistration(tenantId: string, id: string) {
    const reg = await this.prisma.semesterRegistration.findFirst({
      where: { id, tenantId },
      include: {
        lines: {
          include: {
            offering: { include: { course: true } },
            offeringSection: { include: { shift: true, seatLedger: true } },
          },
        },
        semester: true,
        student: { include: { user: { select: { email: true } } } },
      },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    return reg;
  }

  private async studentByUser(tenantId: string, userId: string) {
    const student = await this.prisma.student.findFirst({
      where: { userId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student record not found');
    return student;
  }

  async getMyRegistrationWorkflow(tenantId: string, userId: string) {
    const student = await this.studentByUser(tenantId, userId);
    return this.registrationWorkflow.getForStudent(tenantId, student.id);
  }

  async getMyRegistration(
    tenantId: string,
    userId: string,
    semesterId?: string,
  ) {
    const student = await this.studentByUser(tenantId, userId);
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId: student.id },
    });

    const reg = await this.prisma.semesterRegistration.findFirst({
      where: {
        tenantId,
        studentId: student.id,
        ...(semesterId ? { semesterId } : {}),
      },
      include: {
        lines: {
          include: {
            offering: { include: { course: true } },
            offeringSection: { include: { shift: true, seatLedger: true } },
          },
        },
        semester: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const [majorMinorTrack, vtcTrack, canChangeMajorMinor, academicProfile] =
      await Promise.all([
        this.majorMinorTrack.getTrack(tenantId, student.id),
        this.vtcTrack.getTrack(tenantId, student.id),
        this.majorMinorTrack.canChangeMajorMinor(tenantId, student.id),
        this.prisma.studentAcademicProfile.findUnique({
          where: { studentId: student.id },
        }),
      ]);

    return {
      student,
      registration: reg,
      standing,
      majorMinorTrack,
      vtcTrack,
      canChangeMajorMinor,
      class12Subjects:
        (academicProfile?.class12Subjects as { name: string }[] | null) ?? [],
    };
  }

  async createMyRegistration(
    tenantId: string,
    userId: string,
    dto: CreateRegistrationDto,
  ) {
    const student = await this.studentByUser(tenantId, userId);
    const workflow = await this.registrationWorkflow.getForStudent(
      tenantId,
      student.id,
    );
    this.registrationWorkflow.assertStudentSelfServiceAllowed(workflow);
    return this.createRegistration(tenantId, student.id, dto);
  }

  async updateMyRegistrationLines(
    tenantId: string,
    userId: string,
    registrationId: string,
    lines: RegistrationLineDto[],
  ) {
    const student = await this.studentByUser(tenantId, userId);
    const workflow = await this.registrationWorkflow.getForStudent(
      tenantId,
      student.id,
    );
    this.registrationWorkflow.assertStudentSelfServiceAllowed(workflow);
    const reg = await this.getRegistration(tenantId, registrationId);
    if (reg.studentId !== student.id)
      throw new NotFoundException('Registration not found');

    const sanitizedLines = lines.map(
      ({ eligibilityOverride: _o, eligibilityOverrideReason: _r, ...line }) =>
        line,
    );

    const merged = this.registrationWorkflow.mergeStudentLineUpdates(
      workflow,
      reg.lines.map((l) => ({
        category: l.category,
        offeringId: l.offeringId,
        offeringSectionId: l.offeringSectionId,
      })),
      sanitizedLines,
    );
    return this.updateRegistrationLines(tenantId, registrationId, merged);
  }

  async submitMyRegistration(
    tenantId: string,
    userId: string,
    registrationId: string,
  ) {
    const student = await this.studentByUser(tenantId, userId);
    const workflow = await this.registrationWorkflow.getForStudent(
      tenantId,
      student.id,
    );
    this.registrationWorkflow.assertStudentSelfServiceAllowed(workflow);
    const reg = await this.getRegistration(tenantId, registrationId);
    if (reg.studentId !== student.id)
      throw new NotFoundException('Registration not found');
    const submitted = await this.submitRegistration(
      tenantId,
      registrationId,
      userId,
    );
    await this.prisma.semesterRegistrationLine.updateMany({
      where: { registrationId },
      data: { registrationSource: 'STUDENT_SELECTED' },
    });
    return submitted;
  }

  async validateMyRegistration(
    tenantId: string,
    userId: string,
    registrationId: string,
  ) {
    const student = await this.studentByUser(tenantId, userId);
    const reg = await this.getRegistration(tenantId, registrationId);
    if (reg.studentId !== student.id)
      throw new NotFoundException('Registration not found');
    return this.validateRegistration(tenantId, registrationId);
  }

  async createRegistration(
    tenantId: string,
    studentId: string,
    dto: CreateRegistrationDto,
  ) {
    const student = await this.assertStudent(tenantId, studentId);

    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId },
    });
    if (!standing) {
      throw new BadRequestException(
        'Student academic standing not initialized. Contact administration.',
      );
    }
    if (standing.registrationLocked) {
      throw new BadRequestException('Registration is locked for this student');
    }
    if (standing.currentSemesterSequence !== dto.semesterSequence) {
      throw new BadRequestException(
        `Registration allowed only for semester ${standing.currentSemesterSequence}`,
      );
    }

    const campus = student.campusId
      ? await this.prisma.campus.findUnique({ where: { id: student.campusId } })
      : null;
    const institutionId = campus?.institutionId;
    if (institutionId) {
      const config = await this.lifecycle.getConfig(tenantId, institutionId);
      if (dto.semesterSequence > config.maxActiveSemesters) {
        throw new BadRequestException(
          `Semester ${dto.semesterSequence} exceeds institution limit (${config.maxActiveSemesters})`,
        );
      }
    }

    const calendarSem = await this.prisma.semester.findFirst({
      where: { id: dto.semesterId, tenantId, deletedAt: null },
    });
    if (!calendarSem) {
      throw new BadRequestException('Calendar semester not found');
    }
    if (calendarSem.status === 'FROZEN') {
      throw new BadRequestException(
        'Registration is locked — this semester is frozen',
      );
    }
    if (
      calendarSem.semesterNumber !== dto.semesterSequence ||
      !calendarSem.isActive ||
      calendarSem.status !== 'ACTIVE' ||
      !calendarSem.registrationOpen
    ) {
      throw new BadRequestException(
        'Registration is not open for this programme semester',
      );
    }

    if (institutionId) {
      const operational = await this.lifecycle.resolveOperationalSemester(
        tenantId,
        institutionId,
        dto.semesterSequence,
      );
      if (!operational || operational.id !== dto.semesterId) {
        throw new BadRequestException(
          'Semester does not match the active programme term for your institution',
        );
      }
    }

    try {
      return await this.prisma.semesterRegistration.create({
        data: {
          tenantId,
          studentId,
          semesterId: dto.semesterId,
          semesterSequence: dto.semesterSequence,
          status: 'draft',
        },
        include: { lines: true, semester: true },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'Registration already exists for this semester',
        );
      }
      throw e;
    }
  }

  async updateRegistrationLines(
    tenantId: string,
    registrationId: string,
    lines: RegistrationLineDto[],
    opts?: {
      registrationSource?: string;
      assignedById?: string;
      generatedBy?: string;
    },
  ) {
    const reg = await this.getRegistration(tenantId, registrationId);
    if (reg.status !== 'draft') {
      throw new BadRequestException('Only draft registrations can be edited');
    }

    const profile = await this.prisma.studentAcademicProfile.findUnique({
      where: { studentId: reg.studentId },
    });

    await this.prisma.semesterRegistrationLine.deleteMany({
      where: { registrationId },
    });

    if (lines.length > 0) {
      for (const line of lines) {
        if (
          line.eligibilityOverride &&
          !line.eligibilityOverrideReason?.trim()
        ) {
          throw new BadRequestException(
            'Eligibility override reason is required when overriding course eligibility',
          );
        }
      }

      const resolved = await Promise.all(
        lines.map((l) =>
          this.offerings.resolveSectionForLine(
            tenantId,
            l,
            profile?.preferredShiftId,
            profile?.streamId,
          ),
        ),
      );
      await this.prisma.semesterRegistrationLine.createMany({
        data: resolved.map((section, idx) => {
          const offering = section.courseOffering;
          const assignmentSource =
            offering.mappingSource === MAPPING_SOURCE.SHARED_POOL &&
            offering.categoryPoolId
              ? assignmentSourceForPool(offering.categoryPoolId)
              : MAPPING_SOURCE.DIRECT;
          return {
            tenantId,
            registrationId,
            offeringId: section.courseOfferingId,
            offeringSectionId: section.id,
            category: lines[idx].category,
            status: 'pending',
            priorityRank: idx + 1,
            assignmentSource,
            registrationSource:
              lines[idx].registrationSource ?? opts?.registrationSource ?? null,
            assignedById: opts?.assignedById ?? null,
            generatedBy: lines[idx].generatedBy ?? opts?.generatedBy ?? null,
            eligibilityOverride: lines[idx].eligibilityOverride ?? false,
            eligibilityOverrideReason: lines[idx].eligibilityOverride
              ? (lines[idx].eligibilityOverrideReason?.trim() ?? null)
              : null,
            credits: offering.course.credits,
          };
        }),
      });
    }

    await this.prisma.registrationAuditLog.create({
      data: {
        tenantId,
        registrationId,
        action: 'lines_updated',
        metadata: { lineCount: lines.length },
      },
    });

    for (const line of lines) {
      if (line.category === 'VTC' && line.offeringId) {
        await this.vtcTrack.recordSelection(
          tenantId,
          reg.studentId,
          reg.semesterSequence,
          line.offeringId,
        );
      }
    }
    if (reg.semesterSequence === 1) {
      await this.majorMinorTrack.syncFromProgramChoices(
        tenantId,
        reg.studentId,
      );
    }

    return this.getRegistration(tenantId, registrationId);
  }

  async validateRegistration(tenantId: string, registrationId: string) {
    const reg = await this.getRegistration(tenantId, registrationId);
    const student = await this.prisma.student.findFirstOrThrow({
      where: { id: reg.studentId },
    });
    if (!student.programVersionId) {
      throw new BadRequestException('Student has no program version assigned');
    }
    const ctx = await this.buildValidationContext(
      tenantId,
      reg,
      student.programVersionId,
    );
    const issues = runValidators(ctx);
    const blockingIssues = blockingValidationIssues(issues);
    const creditSummary = await this.credits.getDraftCreditSummary(
      tenantId,
      reg.studentId,
      registrationId,
    );
    const deliveryFeePreview = await this.deliveryFees.previewFromRegistration(
      tenantId,
      registrationId,
    );
    return {
      ok: blockingIssues.length === 0,
      issues,
      creditSummary,
      deliveryFeePreview,
    };
  }

  async getMyCreditSummary(tenantId: string, userId: string) {
    const student = await this.studentByUser(tenantId, userId);
    return this.credits.getCategoryBalances(tenantId, student.id);
  }

  async submitRegistration(
    tenantId: string,
    registrationId: string,
    actorId?: string,
  ) {
    const reg = await this.getRegistration(tenantId, registrationId);
    if (reg.status !== 'draft') {
      throw new BadRequestException('Registration already submitted');
    }

    const student = await this.prisma.student.findFirstOrThrow({
      where: { id: reg.studentId },
      include: { academicProfile: true },
    });
    if (!student.programVersionId) {
      throw new BadRequestException('Student has no program version assigned');
    }

    const primaryShiftId =
      student.primaryShiftId ?? student.academicProfile?.preferredShiftId;
    if (primaryShiftId) {
      for (const line of reg.lines) {
        if (!line.offeringSectionId) continue;
        const section = await this.prisma.offeringSection.findFirst({
          where: { id: line.offeringSectionId, tenantId },
        });
        if (section && section.shiftId !== primaryShiftId) {
          throw new BadRequestException(
            'All sections must belong to the student primary shift',
          );
        }
      }
      await this.prisma.semesterRegistration.update({
        where: { id: registrationId },
        data: { shiftId: primaryShiftId },
      });
    }

    const validationCtx = await this.buildValidationContext(
      tenantId,
      reg,
      student.programVersionId,
    );
    const issues = runValidators(validationCtx);
    const blockingIssues = blockingValidationIssues(issues);
    if (blockingIssues.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: blockingIssues,
      });
    }

    const window = await this.prisma.registrationWindow.findFirst({
      where: { tenantId, semesterId: reg.semesterId },
      orderBy: { opensAt: 'desc' },
    });
    const policy = await this.approval.resolvePolicy(tenantId, {
      programVersionId: student.programVersionId,
      registrationWindowId: window?.id,
    });

    await this.approval.submitForApproval(
      tenantId,
      registrationId,
      policy.mode,
      actorId,
    );

    if (policy.mode === 'auto') {
      return this.allocation.allocateRegistration(
        tenantId,
        registrationId,
        actorId,
      );
    }

    return this.getRegistration(tenantId, registrationId);
  }

  approveRegistration(
    tenantId: string,
    registrationId: string,
    actorId: string,
    roles: string[],
  ) {
    return this.approval.approve(tenantId, registrationId, actorId, roles);
  }

  rejectRegistration(
    tenantId: string,
    registrationId: string,
    actorId: string,
    comment: string,
  ) {
    return this.approval.reject(tenantId, registrationId, actorId, comment);
  }

  upsertApprovalPolicy(tenantId: string, dto: UpsertApprovalPolicyDto) {
    return this.approval.upsertPolicy(tenantId, dto);
  }

  listApprovalPolicies(tenantId: string) {
    return this.prisma.registrationApprovalPolicy.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  promoteWaitlist(tenantId: string, lineId: string, promotedById?: string) {
    return this.allocation.promoteWaitlist(tenantId, lineId, promotedById);
  }

  async mdcConflictReport(tenantId: string) {
    const students = await this.prisma.student.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        academicProfile: true,
        programChoices: { where: { status: 'active', deletedAt: null } },
        semesterRegistrations: {
          where: { status: 'completed' },
          include: {
            lines: {
              where: { category: 'MDC', status: 'confirmed' },
              include: { offering: { include: { course: true } } },
            },
          },
        },
      },
    });

    const conflicts: {
      studentId: string;
      enrollmentNumber: string;
      mdcCourse: string;
      conflictWith: string;
    }[] = [];

    for (const s of students) {
      const blocked = new Set<string>();
      for (const c of s.programChoices) blocked.add(c.subjectSlug);
      const class12 =
        (s.academicProfile?.class12Subjects as Class12Subject[]) ?? [];
      for (const sub of class12) blocked.add(slugifySubject(sub.name));

      for (const reg of s.semesterRegistrations) {
        for (const line of reg.lines) {
          const slug =
            line.offering.course.subjectSlug ??
            slugifySubject(line.offering.course.title);
          if (blocked.has(slug)) {
            conflicts.push({
              studentId: s.id,
              enrollmentNumber: s.enrollmentNumber,
              mdcCourse: line.offering.course.code,
              conflictWith: slug,
            });
          }
        }
      }
    }
    return { total: conflicts.length, conflicts };
  }

  listStreams(tenantId: string, institutionId?: string) {
    return this.prisma.academicStream.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        ...(institutionId
          ? { OR: [{ institutionId: null }, { institutionId }] }
          : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
    });
  }

  registrationAnalytics(tenantId: string, programVersionId?: string) {
    return this.analytics.registrationAnalytics(tenantId, programVersionId);
  }

  async seatUtilizationReport(tenantId: string, programVersionId?: string) {
    const sections = await this.analytics.seatUtilizationReport(
      tenantId,
      programVersionId,
    );

    const sectionIds = sections
      .filter((s) => (s.seatLedger?.waitlistCount ?? 0) > 0)
      .map((s) => s.id);

    const waitlistLines =
      sectionIds.length > 0
        ? await this.prisma.semesterRegistrationLine.findMany({
            where: {
              tenantId,
              offeringSectionId: { in: sectionIds },
              status: 'waitlisted',
            },
            orderBy: { priorityRank: 'asc' },
            select: { id: true, offeringSectionId: true },
          })
        : [];

    const firstLineBySection = new Map<string, string>();
    for (const line of waitlistLines) {
      if (
        line.offeringSectionId &&
        !firstLineBySection.has(line.offeringSectionId)
      ) {
        firstLineBySection.set(line.offeringSectionId, line.id);
      }
    }

    return sections.map((s) => ({
      offeringId: s.courseOfferingId,
      sectionId: s.id,
      courseCode: s.courseOffering.course.code,
      category: s.courseOffering.category,
      semesterSequence: s.courseOffering.semesterSequence,
      shift: s.shift.code,
      sectionCode: s.sectionCode,
      capacity: s.capacity,
      confirmed: s.seatLedger?.confirmedCount ?? 0,
      waitlisted: s.seatLedger?.waitlistCount ?? 0,
      utilizationPct: s.capacity
        ? Math.round(((s.seatLedger?.confirmedCount ?? 0) / s.capacity) * 100)
        : 0,
      firstWaitlistLineId: firstLineBySection.get(s.id) ?? null,
    }));
  }

  async bootstrapStudentAcademic(
    tenantId: string,
    studentId: string,
    options?: {
      streamId?: string;
      departmentId?: string;
      admissionYearId?: string;
      admissionBatchId?: string;
      institutionId?: string;
      majorSubjectSlug?: string;
      minorSubjectSlug?: string;
    },
  ) {
    const student = await this.assertStudent(tenantId, studentId);

    const stream =
      options?.streamId != null
        ? options.streamId
        : (
            await this.prisma.academicStream.findFirst({
              where: { tenantId, code: 'SCIENCE' },
            })
          )?.id;

    let admissionBatchId = options?.admissionBatchId;
    if (
      !admissionBatchId &&
      options?.admissionYearId &&
      options?.institutionId
    ) {
      const session = await this.prisma.academicYear.findFirst({
        where: { id: options.admissionYearId, tenantId },
      });
      if (session) {
        const batch = await this.lifecycle.resolveBatchForEnrollment(
          tenantId,
          options.institutionId,
          options.admissionYearId,
          session.startDate.getFullYear(),
        );
        admissionBatchId = batch.id;
      }
    }

    const existingProfile = await this.prisma.studentAcademicProfile.findUnique(
      {
        where: { studentId },
      },
    );
    if (!existingProfile) {
      await this.prisma.studentAcademicProfile.create({
        data: {
          tenantId,
          studentId,
          streamId: stream,
          admissionYearId: options?.admissionYearId,
          admissionBatchId,
          class12Subjects: [],
          languagePreferences: { preferred: 'english' },
          languageEligibility: { allowedSlugs: ['english', 'hindi'] },
        },
      });
    } else if (admissionBatchId && !existingProfile.admissionBatchId) {
      await this.prisma.studentAcademicProfile.update({
        where: { studentId },
        data: { admissionBatchId },
      });
    }

    await this.prisma.studentAcademicStanding.upsert({
      where: { studentId },
      create: {
        tenantId,
        studentId,
        currentSemesterSequence: 1,
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
      },
      update: {},
    });

    const departmentId = options?.departmentId;
    const choices: { choiceType: string; subjectSlug: string }[] = [];
    if (options?.majorSubjectSlug) {
      choices.push({
        choiceType: 'MAJOR',
        subjectSlug: options.majorSubjectSlug,
      });
    }
    if (options?.minorSubjectSlug) {
      choices.push({
        choiceType: 'MINOR',
        subjectSlug: options.minorSubjectSlug,
      });
    }

    for (const choice of choices) {
      const active = await this.prisma.studentProgramChoice.findFirst({
        where: {
          studentId,
          tenantId,
          choiceType: choice.choiceType,
          status: 'active',
          deletedAt: null,
        },
      });
      if (!active) {
        await this.prisma.studentProgramChoice.create({
          data: {
            tenantId,
            studentId,
            choiceType: choice.choiceType,
            subjectSlug: slugifySubject(choice.subjectSlug),
            departmentId,
            status: 'active',
            effectiveFromSemester: 1,
          },
        });
      }
    }

    return { studentId: student.id, bootstrapped: true };
  }

  private async assertStudent(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  private async buildValidationContext(
    tenantId: string,
    reg: {
      studentId: string;
      semesterId: string;
      semesterSequence: number;
      lines: {
        category: string;
        offeringId: string;
        offeringSectionId: string | null;
        eligibilityOverride?: boolean;
        eligibilityOverrideReason?: string | null;
      }[];
    },
    programVersionId: string,
  ) {
    const sectionIds = reg.lines
      .map((l) => l.offeringSectionId)
      .filter((id): id is string => Boolean(id));

    const [
      profile,
      choices,
      rule,
      programTemplate,
      window,
      sections,
      priorRegs,
      eligibility,
      policy,
      majorMinorTrackRow,
      vtcTrackRow,
    ] = await Promise.all([
      this.prisma.studentAcademicProfile.findUnique({
        where: { studentId: reg.studentId },
      }),
      this.prisma.studentProgramChoice.findMany({
        where: { studentId: reg.studentId, status: 'active', deletedAt: null },
      }),
      this.prisma.semesterStructureRule.findUnique({
        where: {
          programVersionId_semesterSequence: {
            programVersionId,
            semesterSequence: reg.semesterSequence,
          },
        },
        include: { lines: true },
      }),
      this.prisma.programStructureTemplate.findFirst({
        where: { tenantId, programVersionId },
      }),
      this.prisma.registrationWindow.findFirst({
        where: { tenantId, semesterId: reg.semesterId },
        orderBy: { opensAt: 'desc' },
      }),
      this.prisma.offeringSection.findMany({
        where: { id: { in: sectionIds }, tenantId, deletedAt: null },
        include: {
          shift: true,
          seatLedger: true,
          courseOffering: { include: { course: true } },
          eligibleStreams: {
            include: {
              stream: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.semesterRegistration.findFirst({
        where: {
          tenantId,
          studentId: reg.studentId,
          status: 'completed',
          semesterSequence: reg.semesterSequence - 1,
        },
        include: { lines: { where: { status: 'confirmed' } } },
      }),
      this.prisma.eligibilityRuleSet.findUnique({ where: { tenantId } }),
      this.approval.resolvePolicy(tenantId, {
        programVersionId,
      }),
      this.prisma.studentMajorMinorTrack.findUnique({
        where: { studentId: reg.studentId },
      }),
      this.prisma.studentVtcTrack.findUnique({
        where: { studentId: reg.studentId },
      }),
    ]);

    if (!rule)
      throw new BadRequestException('Semester structure rule not configured');

    const fallbackCreditTarget =
      programTemplate?.semesterCreditTarget ?? DEFAULT_SEMESTER_CREDIT_TARGET;
    const rulePayload = ruleRecordToPayload(rule, fallbackCreditTarget);
    const persisted = buildPersistedRequirements(
      rulePayload,
      fallbackCreditTarget,
      programTemplate?.degreeMinCredits ?? 120,
    );

    const windowPolicy = window
      ? await this.approval.resolvePolicy(tenantId, {
          programVersionId,
          registrationWindowId: window.id,
        })
      : policy;

    const now = new Date();
    const windowOpen = window
      ? !window.locked && now >= window.opensAt && now <= window.closesAt
      : true;

    const priorConfirmedByCategory: Partial<Record<NepCategory, string>> = {};
    if (priorRegs) {
      for (const line of priorRegs.lines) {
        priorConfirmedByCategory[line.category as NepCategory] =
          line.offeringId;
      }
    }

    const studentStream = profile?.streamId
      ? await this.prisma.academicStream.findFirst({
          where: { id: profile.streamId, tenantId },
          select: { id: true, code: true, name: true },
        })
      : null;

    const buildMeta = (s: (typeof sections)[0]): SectionMeta => {
      const streamRows = s.eligibleStreams ?? [];
      const allowedStreamLabels = streamRows.map(
        (row) => row.stream?.code ?? row.stream?.name ?? row.academicStreamId,
      );
      return {
        offeringId: s.courseOfferingId,
        programVersionId: s.courseOffering.programVersionId ?? null,
        courseId: s.courseOffering.courseId,
        courseCode: s.courseOffering.course.code,
        courseTitle: s.courseOffering.course.title,
        category: (s.courseOffering.category ?? 'ELECTIVE') as NepCategory,
        subjectSlug:
          s.courseOffering.category === 'AEC'
            ? resolveAecSubjectSlug(s.courseOffering.course)
            : (s.courseOffering.course.subjectSlug ??
              slugifySubject(s.courseOffering.course.title)),
        semesterSequence: s.courseOffering.semesterSequence,
        shiftId: s.shiftId,
        shiftCode: s.shift.code,
        sectionCode: s.sectionCode,
        capacity: s.capacity,
        waitlistCapacity: s.waitlistCapacity,
        confirmedCount: s.seatLedger?.confirmedCount ?? 0,
        waitlistCount: s.seatLedger?.waitlistCount ?? 0,
        courseCredits: Number(s.courseOffering.course.credits),
        vtcTrackGroupCode: s.courseOffering.course.vtcTrackGroupCode,
        vtcTrackStage: s.courseOffering.course.vtcTrackStage,
        prerequisiteOfferingIds: Array.isArray(
          s.courseOffering.prerequisiteOfferingIds,
        )
          ? (s.courseOffering.prerequisiteOfferingIds as string[])
          : [],
        allowedStreamIds: streamRows.map((row) => row.academicStreamId),
        allowedStreamLabels,
        eligibilityRules:
          (s.courseOffering.course.eligibilityRules as Record<
            string,
            unknown
          >) ?? {},
      };
    };

    const sectionMeta = new Map(sections.map((s) => [s.id, buildMeta(s)]));
    const offeringMeta = new Map(
      sections.map((s) => [s.courseOfferingId, buildMeta(s)]),
    );

    const draftCreditsByCategory: Record<string, number> = {};
    let totalDraftCredits = 0;
    for (const line of reg.lines) {
      if (!line.offeringSectionId) continue;
      const meta = sectionMeta.get(line.offeringSectionId);
      if (!meta) continue;
      draftCreditsByCategory[line.category] =
        (draftCreditsByCategory[line.category] ?? 0) + meta.courseCredits;
      totalDraftCredits += meta.courseCredits;
    }

    const confirmedEntries = await this.prisma.creditLedgerEntry.findMany({
      where: { tenantId, studentId: reg.studentId, entryType: 'registration' },
    });
    const confirmedCreditsByCategory: Record<string, number> = {};
    for (const e of confirmedEntries) {
      const meta = e.metadata as { category?: string } | null;
      const cat = meta?.category ?? 'OTHER';
      confirmedCreditsByCategory[cat] =
        (confirmedCreditsByCategory[cat] ?? 0) + Number(e.credits);
    }

    const rules = (eligibility?.rules as Record<string, unknown>) ?? {};

    const [studentRow, programVersionRow, studentEligibilityContext] =
      await Promise.all([
        this.prisma.student.findUnique({
          where: { id: reg.studentId },
          select: { campusId: true },
        }),
        this.prisma.programVersion.findFirst({
          where: { id: programVersionId, tenantId, deletedAt: null },
          select: { programId: true },
        }),
        this.courseEligibility.buildContextFromStudent(tenantId, reg.studentId),
      ]);
    let maxActiveSemesters = 8;
    let workflowSettings: RegistrationWorkflowSettings = {
      mode: 'ADMIN_ONLY',
      allowStudentSelfService: false,
      studentElectiveCategories: ['MDC', 'SEC', 'AEC', 'VAC', 'VTC'],
    };
    if (studentRow?.campusId) {
      const campus = await this.prisma.campus.findUnique({
        where: { id: studentRow.campusId },
        select: { institutionId: true },
      });
      if (campus?.institutionId) {
        const instConfig =
          await this.prisma.institutionAcademicConfig.findUnique({
            where: { institutionId: campus.institutionId },
          });
        maxActiveSemesters = instConfig?.maxActiveSemesters ?? 8;
        workflowSettings = this.registrationWorkflow.parseWorkflow(
          instConfig?.registrationWorkflow,
        );
      }
    }

    return {
      tenantId,
      studentId: reg.studentId,
      programVersionId,
      semesterSequence: reg.semesterSequence,
      semesterId: reg.semesterId,
      selections: reg.lines
        .filter((l) => l.offeringSectionId)
        .map((l) => ({
          category: l.category as NepCategory,
          offeringId: l.offeringId,
          offeringSectionId: l.offeringSectionId!,
          eligibilityOverride: l.eligibilityOverride ?? false,
          eligibilityOverrideReason: l.eligibilityOverrideReason ?? null,
        })),
      class12Subjects: (profile?.class12Subjects as Class12Subject[]) ?? [],
      activeChoices: choices.map((c) => ({
        choiceType: c.choiceType as 'MAJOR' | 'MINOR',
        subjectSlug: c.subjectSlug,
      })),
      categoryCounts: rulePayload.categoryCounts,
      continuityRules: rulePayload.continuityRules,
      categoryRequirements: persisted.categoryRequirements,
      semesterCreditTarget: persisted.semesterCreditTarget,
      degreeMinCredits: persisted.degreeMinCredits,
      languageEligibility: profile?.languageEligibility as Record<
        string,
        unknown
      > | null,
      preferredShiftId: profile?.preferredShiftId,
      studentStreamId: profile?.streamId ?? null,
      studentStreamLabel:
        studentStream?.code ?? studentStream?.name ?? profile?.streamId ?? null,
      windowOpen,
      windowLocked: window?.locked ?? false,
      priorConfirmedByCategory,
      majorMinorTrackLocked: majorMinorTrackRow?.isTrackLocked ?? false,
      vtcTrackGroupCode: vtcTrackRow?.trackGroupCode ?? null,
      offeringMeta,
      sectionMeta,
      creditPolicy: {
        minCredits: persisted.semesterCreditTarget,
        maxCredits: persisted.semesterCreditTarget,
      },
      draftCreditsByCategory,
      totalDraftCredits,
      confirmedCreditsByCategory,
      vacPolicy: {
        mandatoryVacRequired: Boolean(rules.mandatoryVacRequired ?? false),
      },
      shiftPolicy: windowPolicy.shiftPolicy,
      eligibilityRules: rules,
      maxActiveSemesters,
      studentElectiveCategories: workflowSettings.studentElectiveCategories,
      registrationWorkflowMode: workflowSettings.mode,
      programId: programVersionRow?.programId ?? null,
      completedStudy: studentEligibilityContext.completedStudy,
      studentEligibilityContext,
    };
  }
}
