import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SchoolSisPushService } from './school-sis-push.service';

@Processor('school-push', {
  lockDuration: 180_000,
  limiter: { max: 40, duration: 60_000 },
})
export class SchoolSisPushProcessor extends WorkerHost {
  private readonly logger = new Logger(SchoolSisPushProcessor.name);
  constructor(private readonly push: SchoolSisPushService) {
    super();
  }

  async process(job: Job<{ tenantId: string; campaignId: string }>) {
    try {
      return await this.push.processCampaign(
        job.data.tenantId,
        job.data.campaignId,
      );
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }
}
