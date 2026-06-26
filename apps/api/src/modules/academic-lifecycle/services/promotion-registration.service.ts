import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AcademicEngineService } from '../../academic-engine/academic-engine.service';
import { AdminRegistrationService } from '../../academic-engine/services/admin-registration.service';
import { AllocationService } from '../../academic-engine/services/allocation.service';
import { SubjectRegistrationEngineService } from '../../academic-engine/services/subject-registration-engine.service';
import {
  buildPriorLineContextMap,
  priorLineSlotKey,
} from '../../academic-engine/domain/promotion-line-resolver';
import { BatchSemesterMappingService } from './batch-semester-mapping.service';

export type PromotionMappingLine = {
  category: string;
  majorPaperIndex?: number | null;
  departmentName?: string | null;
  from?: { code: string; title: string; offeringId: string } | null;
  to: { code: string; title: string; offeringId: string };
  offeringSectionId?: string | null;
  resolved: boolean;
  message?: string;
};

export type PromotionMappingPreview = {
  studentId: string;
  enrollmentNumber?: string | null;
  studentName?: string | null;
  programVersionId?: string | null;
  lines: PromotionMappingLine[];
  valid: boolean;
  messages: string[];
};

export type PromotionValidationResult = {
  valid: boolean;
  messages: string[];
  mappingPreview?: PromotionMappingPreview;
};

@Injectable()
export class PromotionRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly batchMapping: BatchSemesterMappingService,
    private readonly adminRegistration: AdminRegistrationService,
    private readonly registrationEngine: SubjectRegistrationEngineService,
    private readonly engine: AcademicEngineService,
    private readonly allocation: AllocationService,
  ) {}

  async previewMappings(
    tenantId: string,
    input: {
      institutionId: string;
      fromSequence: number;
      toSequence: number;
      studentIds?: string[];
      campusId?: string;
      shiftId?: string;
      admissionBatchId?: string;
    },
  ): Promise<PromotionMappingPreview[]> {
    const students = await this.resolveStudents(tenantId, input);
    const previews: PromotionMappingPreview[] = [];
    for (const student of students) {
      previews.push(
        await this.buildStudentMappingPreview(tenantId, student.id, input),
      );
    }
    return previews;
  }

  async validateStudent(
    tenantId: string,
    studentId: string,
    input: {
      institutionId: string;
      fromSequence: number;
      toSequence: number;
    },
  ): Promise<PromotionValidationResult> {
    const messages: string[] = [];
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId },
    });
    if (!standing) {
      return { valid: false, messages: ['No academic standing record'] };
    }
    if (standing.promotionLocked) {
      messages.push('Promotion is locked for this student');
    }
    if (standing.currentSemesterSequence !== input.fromSequence) {
      messages.push(
        `Expected semester ${input.fromSequence}, found ${standing.currentSemesterSequence}`,
      );
    }

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { programVersionId: true },
    });
    if (!student?.programVersionId) {
      messages.push('Student has no programme version');
    } else {
      const rule = await this.prisma.semesterStructureRule.findFirst({
        where: {
          tenantId,
          programVersionId: student.programVersionId,
          semesterSequence: input.toSequence,
        },
      });
      if (!rule) {
        messages.push(
          `No semester structure rule for target semester ${input.toSequence}`,
        );
      }
    }

    const duplicateRun = await this.prisma.semesterPromotionEntry.findFirst({
      where: {
        tenantId,
        studentId,
        fromSequence: input.fromSequence,
        toSequence: input.toSequence,
        status: { in: ['PROMOTED', 'COMPLETED'] },
        run: { status: 'APPLIED' },
      },
    });
    if (duplicateRun) {
      messages.push('Student already promoted for this semester transition');
    }

    const targetSemester = await this.batchMapping.resolveCalendarSemester(
      tenantId,
      input.institutionId,
      input.toSequence,
    );
    if (!targetSemester) {
      messages.push(`Calendar semester ${input.toSequence} is not configured`);
    } else {
      const existingReg = await this.prisma.semesterRegistration.findFirst({
        where: { tenantId, studentId, semesterId: targetSemester.id },
      });
      if (existingReg && existingReg.status !== 'draft') {
        messages.push('Target semester registration already exists');
      }
    }

    const mappingPreview = await this.buildStudentMappingPreview(
      tenantId,
      studentId,
      input,
    );
    if (!mappingPreview.valid) {
      messages.push(...mappingPreview.messages);
    }

    return {
      valid: messages.length === 0 && mappingPreview.valid,
      messages,
      mappingPreview,
    };
  }

  async resolveTargetLines(
    tenantId: string,
    studentId: string,
    fromSequence: number,
    toSequence: number,
  ) {
    const student = await this.prisma.student.findFirstOrThrow({
      where: { id: studentId, tenantId },
      include: {
        academicProfile: true,
        programChoices: { where: { status: 'active', deletedAt: null } },
      },
    });
    if (!student.programVersionId) {
      throw new BadRequestException('Student has no programme version');
    }

    return this.adminRegistration.buildAutoAssignLinesForStudent(
      tenantId,
      studentId,
      student.programVersionId,
      toSequence,
      {
        shiftId:
          student.primaryShiftId ??
          student.academicProfile?.preferredShiftId ??
          undefined,
        streamId: student.academicProfile?.streamId ?? undefined,
      },
    );
  }

  async applyForStudent(
    tenantId: string,
    input: {
      studentId: string;
      institutionId: string;
      fromSequence: number;
      toSequence: number;
      promotionRunId: string;
      actorId?: string;
    },
  ) {
    const validation = await this.validateStudent(tenantId, input.studentId, {
      institutionId: input.institutionId,
      fromSequence: input.fromSequence,
      toSequence: input.toSequence,
    });
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Promotion registration validation failed',
        issues: validation.messages,
      });
    }

    const student = await this.prisma.student.findFirstOrThrow({
      where: { id: input.studentId, tenantId },
      include: { academicProfile: true },
    });
    if (!student.programVersionId) {
      throw new BadRequestException('Student has no programme version');
    }

    const targetSemester = await this.batchMapping.resolveCalendarSemester(
      tenantId,
      input.institutionId,
      input.toSequence,
    );
    if (!targetSemester) {
      throw new BadRequestException(
        `Calendar semester ${input.toSequence} is not configured`,
      );
    }

    await this.archivePriorRegistration(
      tenantId,
      input.studentId,
      input.fromSequence,
      input.promotionRunId,
    );

    const lines = await this.resolveTargetLines(
      tenantId,
      input.studentId,
      input.fromSequence,
      input.toSequence,
    );

    let registration = await this.prisma.semesterRegistration.findFirst({
      where: {
        tenantId,
        studentId: input.studentId,
        semesterId: targetSemester.id,
      },
    });

    if (!registration) {
      registration = await this.engine.createRegistration(
        tenantId,
        input.studentId,
        {
          semesterId: targetSemester.id,
          semesterSequence: input.toSequence,
        },
        { bypassRegistrationWindow: true, promotionBypass: true },
      );
    } else if (registration.status !== 'draft') {
      throw new ConflictException(
        'Target semester registration already exists and is not editable',
      );
    }

    await this.registrationEngine.applyGeneratedLines(
      tenantId,
      registration.id,
      lines.map((line) => ({
        ...line,
        registrationSource: 'PROMOTION',
        generatedBy: 'PROMOTION_ENGINE',
      })),
      { assignedById: input.actorId },
    );

    return this.allocation.allocateRegistration(
      tenantId,
      registration.id,
      input.actorId,
    );
  }

  async rollbackForStudent(
    tenantId: string,
    input: {
      studentId: string;
      institutionId: string;
      fromSequence: number;
      toSequence: number;
      promotionRunId: string;
    },
  ) {
    const targetSemester = await this.batchMapping.resolveCalendarSemester(
      tenantId,
      input.institutionId,
      input.toSequence,
    );
    if (targetSemester) {
      const targetReg = await this.prisma.semesterRegistration.findFirst({
        where: {
          tenantId,
          studentId: input.studentId,
          semesterId: targetSemester.id,
          promotionRunId: input.promotionRunId,
        },
        include: { lines: true },
      });
      if (targetReg) {
        await this.prisma.semesterRegistrationLine.deleteMany({
          where: { registrationId: targetReg.id },
        });
        await this.prisma.semesterRegistration.delete({
          where: { id: targetReg.id },
        });
      }
    }

    await this.prisma.semesterRegistration.updateMany({
      where: {
        tenantId,
        studentId: input.studentId,
        semesterSequence: input.fromSequence,
        promotionRunId: input.promotionRunId,
        status: 'archived',
      },
      data: {
        status: 'completed',
        archivedAt: null,
        promotionRunId: null,
      },
    });
  }

  private async archivePriorRegistration(
    tenantId: string,
    studentId: string,
    fromSequence: number,
    promotionRunId: string,
  ) {
    const priorRegs = await this.prisma.semesterRegistration.findMany({
      where: {
        tenantId,
        studentId,
        semesterSequence: fromSequence,
        status: { in: ['completed', 'draft', 'submitted'] },
      },
    });
    for (const reg of priorRegs) {
      await this.prisma.semesterRegistration.update({
        where: { id: reg.id },
        data: {
          status: 'archived',
          archivedAt: new Date(),
          promotionRunId,
        },
      });
    }
  }

  private async buildStudentMappingPreview(
    tenantId: string,
    studentId: string,
    input: {
      institutionId: string;
      fromSequence: number;
      toSequence: number;
    },
  ): Promise<PromotionMappingPreview> {
    const messages: string[] = [];
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        user: { select: { displayName: true, email: true } },
        programChoices: { where: { status: 'active', deletedAt: null } },
      },
    });
    if (!student) {
      return {
        studentId,
        lines: [],
        valid: false,
        messages: ['Student not found'],
      };
    }

    const priorReg = await this.prisma.semesterRegistration.findFirst({
      where: {
        tenantId,
        studentId,
        semesterSequence: input.fromSequence,
        status: { in: ['completed', 'archived'] },
      },
      include: {
        lines: {
          where: { status: 'confirmed' },
          include: {
            offering: {
              include: { course: { include: { department: true } } },
            },
          },
        },
      },
    });

    const targetRule = student.programVersionId
      ? await this.prisma.semesterStructureRule.findFirst({
          where: {
            tenantId,
            programVersionId: student.programVersionId,
            semesterSequence: input.toSequence,
          },
        })
      : null;

    const lines: PromotionMappingLine[] = [];

    try {
      const generated = await this.resolveTargetLines(
        tenantId,
        studentId,
        input.fromSequence,
        input.toSequence,
      );

      const priorContext = await buildPriorLineContextMap(
        this.prisma,
        (priorReg?.lines ?? []).map((line) => ({
          category: line.category,
          offeringId: line.offeringId,
          offering: line.offering
            ? {
                majorPaperIndex: line.offering.majorPaperIndex,
                course: line.offering.course,
              }
            : null,
        })),
      );

      const offeringIds = [
        ...new Set(
          generated
            .map((l) => l.offeringId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const targetOfferings = await this.prisma.courseOffering.findMany({
        where: { id: { in: offeringIds } },
        include: { course: { include: { department: true } } },
      });
      const offeringById = new Map(targetOfferings.map((o) => [o.id, o]));

      for (const line of generated) {
        if (!line.offeringId) {
          messages.push(`Missing offering for ${line.category}`);
          continue;
        }
        const target = offeringById.get(line.offeringId);
        if (!target) {
          messages.push(`Target offering ${line.offeringId} not found`);
          continue;
        }
        const slotKey = priorLineSlotKey(line.category, target.majorPaperIndex);
        const prior = priorContext.get(slotKey);
        const majorChoice = student.programChoices.find(
          (c) => c.choiceType === 'MAJOR',
        );
        const minorChoice = student.programChoices.find(
          (c) => c.choiceType === 'MINOR',
        );
        const subjectSlug =
          line.category === 'MAJOR'
            ? majorChoice?.subjectSlug
            : line.category === 'MINOR'
              ? minorChoice?.subjectSlug
              : null;

        let fromInfo: PromotionMappingLine['from'] = null;
        if (prior) {
          fromInfo = {
            code: prior.course.code,
            title: prior.course.title ?? prior.course.code,
            offeringId: prior.offeringId,
          };
        }

        lines.push({
          category: line.category,
          majorPaperIndex: target.majorPaperIndex,
          departmentName: target.course.department?.name ?? null,
          from: fromInfo,
          to: {
            code: target.course.code,
            title: target.course.title,
            offeringId: target.id,
          },
          offeringSectionId: line.offeringSectionId ?? null,
          resolved: true,
        });
      }
    } catch (error) {
      messages.push(
        error instanceof Error
          ? error.message
          : 'Could not resolve target lines',
      );
    }

    if (!targetRule) {
      messages.push(`No structure rule for semester ${input.toSequence}`);
    }

    const studentName =
      student.user?.displayName?.trim() ||
      student.user?.email ||
      student.enrollmentNumber ||
      null;

    return {
      studentId,
      enrollmentNumber: student.enrollmentNumber,
      studentName,
      programVersionId: student.programVersionId,
      lines,
      valid: messages.length === 0 && lines.length > 0,
      messages,
    };
  }

  private async resolveStudents(
    tenantId: string,
    input: {
      fromSequence: number;
      studentIds?: string[];
      campusId?: string;
      shiftId?: string;
      admissionBatchId?: string;
    },
  ) {
    if (input.studentIds?.length) {
      return this.prisma.student.findMany({
        where: {
          tenantId,
          id: { in: input.studentIds },
          deletedAt: null,
        },
        select: { id: true },
      });
    }

    return this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        academicStanding: {
          currentSemesterSequence: input.fromSequence,
          lifecycleState: { in: ['ACTIVE', 'DETAINED'] },
          promotionLocked: false,
        },
        ...(input.campusId ? { campusId: input.campusId } : {}),
        ...(input.shiftId ? { primaryShiftId: input.shiftId } : {}),
        ...(input.admissionBatchId
          ? {
              academicProfile: {
                admissionBatchId: input.admissionBatchId,
              },
            }
          : {}),
      },
      select: { id: true },
    });
  }
}
