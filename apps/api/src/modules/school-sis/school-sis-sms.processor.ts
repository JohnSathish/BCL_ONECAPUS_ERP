import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SchoolSisSmsService } from './school-sis-sms.service';

@Processor('school-sms', {
  lockDuration: 120_000,
  stalledInterval: 60_000,
  limiter: { max: 60, duration: 60_000 },
})
export class SchoolSisSmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SchoolSisSmsProcessor.name);

  constructor(private readonly sms: SchoolSisSmsService) {
    super();
  }

  async process(job: Job<{ tenantId: string; messageId?: string }>) {
    try {
      if (job.name === 'send' && job.data.messageId) {
        return this.sms.processSendJob(job.data.tenantId, job.data.messageId);
      }
      if (job.name === 'tick') {
        return this.sms.dispatchScheduled();
      }
      return null;
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }
}
