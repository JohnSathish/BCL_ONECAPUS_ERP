import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { AdmissionBatchService } from './admission-batch.service';
import { BatchSemesterMappingService } from './batch-semester-mapping.service';
import { CycleActivationService } from './cycle-activation.service';
import { InstitutionAcademicConfigService } from './institution-academic-config.service';
import { PromotionRunService } from './promotion-run.service';
import {
  cycleTypeFromSemesterNumber,
  oppositeCycle,
  type AcademicCycle,
} from '../utils/cycle.util';
import type { ActivateCycleDto } from '../dto/academic-lifecycle.dto';

@Injectable()
export class CycleRolloverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: InstitutionAcademicConfigService,
    private readonly promotionRun: PromotionRunService,
    private readonly batchService: AdmissionBatchService,
    private readonly mappingService: BatchSemesterMappingService,
    private readonly cycleActivation: CycleActivationService,
  ) {}

  async preview(tenantId: string, institutionId: string) {
    const config = await this.configService.get(tenantId, institutionId);
    const batches = await this.prisma.admissionBatch.findMany({
      where: { tenantId, institutionId, deletedAt: null, isActive: true },
      include: { _count: { select: { studentProfiles: true } } },
      orderBy: { admissionYear: 'desc' },
    });

    const batchPreviews = [];

    for (const batch of batches) {
      const fromSequence = batch.currentSemester;
      if (fromSequence >= config.terminalSemesterNumber) {
        batchPreviews.push({
          batchId: batch.id,
          batchCode: batch.batchCode,
          admissionYear: batch.admissionYear,
          fromSequence,
          toSequence: fromSequence,
          studentCount: batch._count.studentProfiles,
          promoted: 0,
          detained: 0,
          completed: batch._count.studentProfiles,
          skipped: true,
          reason: 'Terminal semester — programme completion only',
        });
        continue;
      }

      const toSequence = fromSequence + 1;
      const preview = await this.promotionRun.preview(tenantId, {
        institutionId,
        fromSequence,
        toSequence,
        admissionBatchId: batch.id,
      });

      batchPreviews.push({
        batchId: batch.id,
        batchCode: batch.batchCode,
        admissionYear: batch.admissionYear,
        fromSequence,
        toSequence,
        studentCount: batch._count.studentProfiles,
        promoted: preview.counts.eligible,
        detained: preview.counts.detained,
        completed: (preview.eligible as { status?: string }[]).filter(
          (r) => r.status === 'COMPLETED',
        ).length,
        skipped: false,
        counts: preview.counts,
      });
    }

    const outgoingCycle = config.currentCycle as AcademicCycle;
    const incomingCycle = oppositeCycle(outgoingCycle);

    return {
      institutionId,
      outgoingCycle,
      incomingCycle,
      terminalSemesterNumber: config.terminalSemesterNumber,
      batches: batchPreviews,
      totals: {
        batches: batchPreviews.length,
        promoted: batchPreviews.reduce((s, b) => s + b.promoted, 0),
        detained: batchPreviews.reduce((s, b) => s + b.detained, 0),
        completed: batchPreviews.reduce((s, b) => s + b.completed, 0),
      },
    };
  }

  async apply(
    tenantId: string,
    institutionId: string,
    dto: ActivateCycleDto,
    actorId?: string,
  ) {
    const config = await this.configService.get(tenantId, institutionId);
    const preview = await this.preview(tenantId, institutionId);
    const groupId = randomUUID();
    const outgoingCycle = config.currentCycle as AcademicCycle;
    const incomingCycle = oppositeCycle(outgoingCycle);

    const appliedRunIds: string[] = [];

    for (const batchPreview of preview.batches) {
      if (batchPreview.skipped) continue;

      const fromSemester = await this.mappingService.resolveCalendarSemester(
        tenantId,
        institutionId,
        batchPreview.fromSequence,
      );

      const run = await this.promotionRun.createRun(
        tenantId,
        {
          institutionId,
          fromSequence: batchPreview.fromSequence,
          toSequence: batchPreview.toSequence,
          campusId: dto.campusId,
          shiftId: dto.shiftId,
          fromSemesterId: fromSemester?.id,
          trigger: 'CYCLE_ROLLOVER',
          admissionBatchId: batchPreview.batchId,
          cycleRolloverGroupId: groupId,
        },
        actorId,
      );

      for (const entry of run.entries) {
        if (entry.status === 'PROMOTED' || entry.status === 'COMPLETED') {
          await this.prisma.semesterPromotionEntry.update({
            where: { id: entry.id },
            data: {
              status: entry.status === 'COMPLETED' ? 'COMPLETED' : 'PROMOTED',
            },
          });
        } else if (entry.status === 'DETAINED' || entry.status === 'PENDING') {
          await this.prisma.semesterPromotionEntry.update({
            where: { id: entry.id },
            data: { status: 'PROMOTED' },
          });
        }
      }

      await this.promotionRun.applyRun(tenantId, run.id, actorId);
      appliedRunIds.push(run.id);

      await this.batchService.advanceBatchAfterPromotion(
        tenantId,
        batchPreview.batchId,
        batchPreview.toSequence,
      );
    }

    await this.cycleActivation.freezeCycleSemesters(
      tenantId,
      institutionId,
      outgoingCycle,
      actorId,
    );

    await this.mappingService.freezeMappingsForCycle(
      tenantId,
      institutionId,
      outgoingCycle,
    );

    if (incomingCycle === 'ODD') {
      await this.cycleActivation.activateOddCycle(
        tenantId,
        institutionId,
        dto,
        actorId,
      );
    } else {
      await this.cycleActivation.activateEvenCycle(
        tenantId,
        institutionId,
        dto,
        actorId,
      );
    }

    await this.prisma.institutionAcademicConfig.update({
      where: { institutionId },
      data: {
        lastCycleRolloverGroupId: groupId,
      },
    });

    return {
      cycleRolloverGroupId: groupId,
      outgoingCycle,
      incomingCycle,
      appliedRunIds,
      preview,
    };
  }

  async rollback(
    tenantId: string,
    institutionId: string,
    groupId?: string,
    actorId?: string,
  ) {
    const config = await this.configService.get(tenantId, institutionId);
    const rolloverGroupId = groupId ?? config.lastCycleRolloverGroupId;
    if (!rolloverGroupId) {
      throw new BadRequestException('No cycle rollover group to rollback');
    }

    const runs = await this.prisma.semesterPromotionRun.findMany({
      where: {
        tenantId,
        institutionId,
        cycleRolloverGroupId: rolloverGroupId,
        status: 'APPLIED',
      },
      include: { admissionBatch: true },
      orderBy: { createdAt: 'desc' },
    });

    if (runs.length === 0) {
      throw new NotFoundException('No applied rollover runs found for group');
    }

    for (const run of runs) {
      await this.promotionRun.rollbackRun(tenantId, run.id, actorId);
      if (run.admissionBatchId && run.admissionBatch) {
        await this.batchService.advanceBatchAfterPromotion(
          tenantId,
          run.admissionBatchId,
          run.fromSequence,
        );
        await this.prisma.admissionBatch.update({
          where: { id: run.admissionBatchId },
          data: { promotionStatus: 'IDLE' },
        });
      }
    }

    const currentCycle = config.currentCycle as AcademicCycle;
    const restoreCycle = oppositeCycle(currentCycle);

    if (restoreCycle === 'ODD') {
      await this.cycleActivation.activateOddCycle(
        tenantId,
        institutionId,
        {},
        actorId,
      );
    } else {
      await this.cycleActivation.activateEvenCycle(
        tenantId,
        institutionId,
        {},
        actorId,
      );
    }

    return {
      rolledBackRuns: runs.length,
      cycleRolloverGroupId: rolloverGroupId,
    };
  }
}
