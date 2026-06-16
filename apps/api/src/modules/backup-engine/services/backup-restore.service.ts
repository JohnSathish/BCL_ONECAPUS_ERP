import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../../shared/queue/queue.service';
import { BackupAuditService } from './backup-audit.service';

@Injectable()
export class BackupRestoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly audit: BackupAuditService,
  ) {}

  async initiateRestore(input: {
    runId: string;
    mode: string;
    confirmText?: string;
    userId: string;
    ipAddress?: string;
  }) {
    if (input.confirmText !== 'RESTORE') {
      throw new BadRequestException('Type RESTORE to confirm restore');
    }

    const sourceRun = await this.prisma.backupRun.findUnique({
      where: { id: input.runId },
    });
    if (!sourceRun || sourceRun.status !== 'SUCCESS') {
      throw new BadRequestException('Backup run not found or not successful');
    }

    const safetyRun = await this.prisma.backupRun.create({
      data: {
        type: 'DATABASE_DOCUMENTS',
        scope: 'INSTANCE',
        status: 'QUEUED',
        triggeredBy: 'PRE_RESTORE_SAFETY',
        triggeredByUserId: input.userId,
        safetyForRunId: input.runId,
      },
    });

    const safetyJob = await this.queue.enqueueBackupRun({
      runId: safetyRun.id,
      type: 'DATABASE_DOCUMENTS',
      scope: 'INSTANCE',
    });

    await this.prisma.backupRun.update({
      where: { id: safetyRun.id },
      data: { jobId: String(safetyJob.id) },
    });

    const restoreJob = await this.queue.enqueueBackupRestore({
      runId: input.runId,
      mode: input.mode,
      safetyRunId: safetyRun.id,
      userId: input.userId,
      delayMs: 0,
      waitForSafety: true,
    });

    await this.audit.log({
      action: 'RESTORE',
      actorId: input.userId,
      ipAddress: input.ipAddress,
      runId: input.runId,
      metadata: {
        mode: input.mode,
        safetyRunId: safetyRun.id,
        jobId: restoreJob.id,
      },
    });

    return {
      safetyRunId: safetyRun.id,
      restoreJobId: restoreJob.id,
      message: 'Safety backup queued; restore will proceed after it completes',
    };
  }
}
