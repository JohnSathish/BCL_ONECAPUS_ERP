import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { InstitutionAcademicConfigService } from './institution-academic-config.service';
import { PromotionEligibilityService } from './promotion-eligibility.service';
import { ProgrammeCompletionService } from './programme-completion.service';
import { lockMajorMinorTrackOnPromotion } from '../../academic-engine/domain/student-major-minor-track.lock';
import type {
  CreatePromotionRunDto,
  IndividualPromotionDto,
  PromotionPreviewQueryDto,
} from '../dto/academic-lifecycle.dto';

@Injectable()
export class PromotionRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: InstitutionAcademicConfigService,
    private readonly eligibility: PromotionEligibilityService,
    private readonly completion: ProgrammeCompletionService,
  ) {}

  async preview(tenantId: string, query: PromotionPreviewQueryDto) {
    const config = await this.configService.get(tenantId, query.institutionId);
    if (query.toSequence > config.maxActiveSemesters) {
      throw new BadRequestException(
        `Cannot promote beyond semester ${config.maxActiveSemesters}`,
      );
    }
    if (query.toSequence !== query.fromSequence + 1) {
      throw new BadRequestException(
        'Promotion preview supports only consecutive semester progression',
      );
    }

    const students = await this.eligibility.findCandidateStudentIds(
      tenantId,
      query.fromSequence,
      {
        campusId: query.campusId,
        shiftId: query.shiftId,
        departmentId: query.departmentId,
        programVersionId: query.programVersionId,
        admissionBatchId: query.admissionBatchId,
      },
    );

    const eligible: unknown[] = [];
    const detained: unknown[] = [];
    const failed: unknown[] = [];

    for (const { id: studentId } of students) {
      const result = await this.eligibility.evaluateStudent(
        tenantId,
        studentId,
        query.fromSequence,
        query.toSequence,
        config.terminalSemesterNumber,
      );
      const student = await this.prisma.student.findUnique({
        where: { id: studentId },
        include: { user: { select: { email: true } } },
      });
      const row = {
        studentId,
        enrollmentNumber: student?.enrollmentNumber,
        email: student?.user?.email,
        ...result,
      };
      if (
        result.status === 'COMPLETED' ||
        (result.eligible && result.status === 'PROMOTED')
      ) {
        eligible.push(row);
      } else if (result.status === 'FAILED') {
        failed.push(row);
      } else {
        detained.push(row);
      }
    }

    return {
      fromSequence: query.fromSequence,
      toSequence: query.toSequence,
      terminalSemesterNumber: config.terminalSemesterNumber,
      counts: {
        eligible: eligible.length,
        detained: detained.length,
        failed: failed.length,
        total: students.length,
      },
      eligible,
      detained,
      failed,
    };
  }

  async createRun(
    tenantId: string,
    dto: CreatePromotionRunDto,
    actorId?: string,
  ) {
    const config = await this.configService.get(tenantId, dto.institutionId);
    const preview = await this.preview(tenantId, {
      institutionId: dto.institutionId,
      fromSequence: dto.fromSequence,
      toSequence: dto.toSequence,
      campusId: dto.campusId,
      shiftId: dto.shiftId,
      admissionBatchId: dto.admissionBatchId,
    });

    const run = await this.prisma.semesterPromotionRun.create({
      data: {
        tenantId,
        institutionId: dto.institutionId,
        campusId: dto.campusId,
        shiftId: dto.shiftId,
        fromSemesterId: dto.fromSemesterId,
        fromSequence: dto.fromSequence,
        toSemesterSequence: dto.toSequence,
        trigger: dto.trigger ?? 'MANUAL',
        status: 'PREVIEW',
        counts: preview.counts,
        admissionBatchId: dto.admissionBatchId,
        cycleRolloverGroupId: dto.cycleRolloverGroupId,
      },
    });

    for (const row of [
      ...(preview.eligible as {
        studentId: string;
        status: string;
        snapshot: object;
        messages: string[];
      }[]),
      ...(preview.detained as {
        studentId: string;
        status: string;
        snapshot: object;
        messages: string[];
      }[]),
      ...(preview.failed as {
        studentId: string;
        status: string;
        snapshot: object;
        messages: string[];
      }[]),
    ]) {
      await this.prisma.semesterPromotionEntry.create({
        data: {
          tenantId,
          runId: run.id,
          studentId: row.studentId,
          fromSequence: dto.fromSequence,
          toSequence: dto.toSequence,
          status: row.status ?? 'PENDING',
          validationSnapshot: {
            messages: row.messages,
            ...row.snapshot,
          },
        },
      });
    }

    await this.audit(tenantId, run.id, actorId, 'RUN_CREATED', {
      counts: preview.counts,
    });

    return this.getRun(tenantId, run.id);
  }

  async applyRun(tenantId: string, runId: string, actorId?: string) {
    const run = await this.getRun(tenantId, runId);
    if (run.status === 'APPLIED') {
      throw new BadRequestException('Promotion run already applied');
    }
    if (run.status === 'ROLLED_BACK') {
      throw new BadRequestException('Cannot apply a rolled-back run');
    }

    const config = await this.configService.get(tenantId, run.institutionId);

    const fromSem = run.fromSemesterId
      ? await this.prisma.semester.findUnique({
          where: { id: run.fromSemesterId },
        })
      : null;
    if (fromSem?.status === 'FROZEN') {
      throw new BadRequestException(
        'Cannot promote after source semester is frozen',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const entry of run.entries) {
        if (entry.status !== 'PROMOTED' && entry.status !== 'COMPLETED') {
          continue;
        }

        const isCompleted =
          entry.toSequence >= config.terminalSemesterNumber ||
          entry.status === 'COMPLETED';

        if (isCompleted) {
          await tx.studentAcademicStanding.update({
            where: { studentId: entry.studentId },
            data: {
              lifecycleState: 'COMPLETED',
              programmeStatus: 'COMPLETED',
              alumniEligible: true,
              promotionLocked: true,
              registrationLocked: true,
              completedAt: new Date(),
              currentSemesterSequence: entry.toSequence,
            },
          });
        } else {
          await tx.studentAcademicStanding.update({
            where: { studentId: entry.studentId },
            data: {
              currentSemesterSequence: entry.toSequence,
              lifecycleState: 'ACTIVE',
              lastPromotedAt: new Date(),
            },
          });
        }

        await tx.studentSemesterProgress.upsert({
          where: {
            studentId_semesterSequence: {
              studentId: entry.studentId,
              semesterSequence: entry.fromSequence,
            },
          },
          create: {
            tenantId,
            studentId: entry.studentId,
            semesterSequence: entry.fromSequence,
            status: 'completed',
            completedAt: new Date(),
            promotionRunId: runId,
          },
          update: {
            status: 'completed',
            completedAt: new Date(),
            promotionRunId: runId,
          },
        });

        await lockMajorMinorTrackOnPromotion(
          tx,
          tenantId,
          entry.studentId,
          entry.toSequence,
          runId,
        );

        await tx.semesterPromotionEntry.update({
          where: { id: entry.id },
          data: { status: isCompleted ? 'COMPLETED' : 'PROMOTED' },
        });
      }

      await tx.semesterPromotionRun.update({
        where: { id: runId },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
          appliedById: actorId ?? null,
        },
      });
    });

    await this.audit(tenantId, runId, actorId, 'RUN_APPLIED', {});

    return this.getRun(tenantId, runId);
  }

  async rollbackRun(tenantId: string, runId: string, actorId?: string) {
    const run = await this.getRun(tenantId, runId);
    if (run.status !== 'APPLIED') {
      throw new BadRequestException('Only applied runs can be rolled back');
    }

    const fromSem = run.fromSemesterId
      ? await this.prisma.semester.findUnique({
          where: { id: run.fromSemesterId },
        })
      : null;
    if (fromSem?.status === 'FROZEN') {
      throw new BadRequestException('Cannot rollback after semester freeze');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const entry of run.entries) {
        if (entry.status !== 'PROMOTED' && entry.status !== 'COMPLETED')
          continue;

        await tx.studentAcademicStanding.update({
          where: { studentId: entry.studentId },
          data: {
            currentSemesterSequence: entry.fromSequence,
            lifecycleState: 'ACTIVE',
            programmeStatus: 'IN_PROGRESS',
            alumniEligible: false,
            promotionLocked: false,
            registrationLocked: false,
            completedAt: null,
          },
        });

        await tx.semesterPromotionEntry.update({
          where: { id: entry.id },
          data: { rolledBackAt: new Date(), status: 'PENDING' },
        });
      }

      await tx.semesterPromotionRun.update({
        where: { id: runId },
        data: { status: 'ROLLED_BACK', rolledBackAt: new Date() },
      });
    });

    await this.audit(tenantId, runId, actorId, 'RUN_ROLLED_BACK', {});

    return this.getRun(tenantId, runId);
  }

  async individualAction(
    tenantId: string,
    studentId: string,
    dto: IndividualPromotionDto,
    actorId?: string,
  ) {
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId },
    });
    if (!standing) throw new NotFoundException('Student standing not found');

    if (dto.action === 'detain') {
      return this.prisma.studentAcademicStanding.update({
        where: { studentId },
        data: { lifecycleState: 'DETAINED' },
      });
    }

    const toSequence = dto.toSequence ?? standing.currentSemesterSequence + 1;
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { programVersion: { include: { program: true } } },
    });
    if (!student?.campusId) {
      throw new BadRequestException(
        'Student campus required for promotion config',
      );
    }

    const campus = await this.prisma.campus.findUnique({
      where: { id: student.campusId },
    });
    if (!campus) throw new NotFoundException('Campus not found');

    const run = await this.createRun(
      tenantId,
      {
        institutionId: campus.institutionId,
        fromSequence: standing.currentSemesterSequence,
        toSequence,
        campusId: student.campusId,
        shiftId: student.primaryShiftId ?? undefined,
        trigger: 'INDIVIDUAL',
      },
      actorId,
    );

    const entry = run.entries.find((e) => e.studentId === studentId);
    if (entry) {
      await this.prisma.semesterPromotionEntry.update({
        where: { id: entry.id },
        data: { status: 'PROMOTED' },
      });
    }

    return this.applyRun(tenantId, run.id, actorId);
  }

  async getPromotionHistory(tenantId: string, studentId: string) {
    const entries = await this.prisma.semesterPromotionEntry.findMany({
      where: { tenantId, studentId },
      include: { run: true },
      orderBy: { createdAt: 'desc' },
    });
    const progress = await this.prisma.studentSemesterProgress.findMany({
      where: { tenantId, studentId },
      orderBy: { semesterSequence: 'asc' },
    });
    const standing = await this.prisma.studentAcademicStanding.findUnique({
      where: { studentId },
    });
    return { standing, progress, entries };
  }

  async getRun(tenantId: string, runId: string) {
    const run = await this.prisma.semesterPromotionRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        entries: {
          include: {
            student: {
              include: { user: { select: { email: true } } },
            },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Promotion run not found');
    return run;
  }

  private async audit(
    tenantId: string,
    runId: string,
    actorId: string | undefined,
    action: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.semesterPromotionAuditLog.create({
      data: {
        tenantId,
        runId,
        actorId: actorId ?? null,
        action,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  /** ODD→EVEN pairs when activating an EVEN semester */
  promotionPairForEven(
    semesterNumber: number,
  ): { from: number; to: number } | null {
    if (semesterNumber % 2 !== 0) return null;
    return { from: semesterNumber - 1, to: semesterNumber };
  }
}
