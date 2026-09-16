import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SchoolSisOpsService } from './school-sis-ops.service';

@Processor('school-ops', {
  lockDuration: 300_000,
  stalledInterval: 60_000,
  limiter: { max: 4, duration: 60_000 },
})
export class SchoolSisOpsProcessor extends WorkerHost {
  private readonly logger = new Logger(SchoolSisOpsProcessor.name);

  constructor(private readonly ops: SchoolSisOpsService) {
    super();
  }

  async process(job: Job<{ tenantId?: string; backupId?: string }>) {
    try {
      if (job.name === 'tick') return this.ops.tick();
      if (job.name === 'backup' && job.data.tenantId && job.data.backupId) {
        return this.ops.processBackup(job.data.tenantId, job.data.backupId);
      }
      return null;
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }
}
