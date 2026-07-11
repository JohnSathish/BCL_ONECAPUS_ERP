import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BackupRunExecutorService } from '../services/backup-run-executor.service';
import { BackupCloudSyncService } from '../services/backup-cloud-sync.service';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Sole BullMQ consumer for the `backups` queue in the API process.
 * Do not add other `@Processor('backups')` classes — multiple workers on one
 * queue steal locks (Missing lock / could not renew lock).
 */
@Injectable()
@Processor('backups', {
  lockDuration: 600_000,
  stalledInterval: 120_000,
  maxStalledCount: 2,
})
export class BackupQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(BackupQueueProcessor.name);

  constructor(
    private readonly executor: BackupRunExecutorService,
    private readonly cloud: BackupCloudSyncService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (process.env.PROCESS_BACKGROUND_JOBS === 'worker') {
      throw new Error('Backup jobs are owned by the worker container');
    }

    if (job.name === 'backup-run') {
      const { runId } = job.data as { runId: string };
      this.logger.log(`Running backup ${runId}`);
      return this.executor.executeRun(runId);
    }

    if (job.name === 'backup-restore') {
      const data = job.data as {
        runId: string;
        mode: string;
        safetyRunId: string;
        userId?: string;
        waitForSafety?: boolean;
      };
      if (data.waitForSafety) {
        const safety = await this.prisma.backupRun.findUnique({
          where: { id: data.safetyRunId },
        });
        if (!safety || safety.status !== 'SUCCESS') {
          throw new Error('Waiting for safety backup to complete');
        }
      }
      this.logger.log(`Restoring backup ${data.runId}`);
      return this.executor.executeRestore(data);
    }

    if (job.name === 'backup-cloud-sync') {
      const { runId } = job.data as { runId: string };
      this.logger.log(`Cloud sync for ${runId}`);
      return this.cloud.syncRun(runId);
    }

    this.logger.error(`Unhandled backups job ${job.name} (#${job.id})`);
    throw new Error(`Unhandled backups job: ${job.name}`);
  }
}
