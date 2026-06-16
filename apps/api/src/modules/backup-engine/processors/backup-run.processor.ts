import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BackupRunExecutorService } from '../services/backup-run-executor.service';
import { BackupCloudSyncService } from '../services/backup-cloud-sync.service';
import { PrismaService } from '../../../database/prisma.service';

@Processor('backups')
@Injectable()
export class BackupRunProcessor extends WorkerHost {
  private readonly logger = new Logger(BackupRunProcessor.name);

  constructor(private readonly executor: BackupRunExecutorService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (process.env.PROCESS_BACKGROUND_JOBS === 'worker') return undefined;
    if (job.name !== 'backup-run') return undefined;
    const { runId } = job.data as { runId: string };
    this.logger.log(`Running backup ${runId}`);
    return this.executor.executeRun(runId);
  }
}

@Processor('backups')
@Injectable()
export class BackupRestoreProcessor extends WorkerHost {
  private readonly logger = new Logger(BackupRestoreProcessor.name);

  constructor(
    private readonly executor: BackupRunExecutorService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (process.env.PROCESS_BACKGROUND_JOBS === 'worker') return undefined;
    if (job.name !== 'backup-restore') return undefined;
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
}

@Processor('backups')
@Injectable()
export class BackupCloudProcessor extends WorkerHost {
  private readonly logger = new Logger(BackupCloudProcessor.name);

  constructor(private readonly cloud: BackupCloudSyncService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (process.env.PROCESS_BACKGROUND_JOBS === 'worker') return undefined;
    if (job.name !== 'backup-cloud-sync') return undefined;
    const { runId } = job.data as { runId: string };
    this.logger.log(`Cloud sync for ${runId}`);
    return this.cloud.syncRun(runId);
  }
}
