import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SchoolSisWhatsappService } from './school-sis-whatsapp.service';

@Processor('school-whatsapp', {
  lockDuration: 120_000,
  stalledInterval: 60_000,
  limiter: { max: 80, duration: 60_000 },
})
export class SchoolSisWhatsappProcessor extends WorkerHost {
  private readonly logger = new Logger(SchoolSisWhatsappProcessor.name);

  constructor(private readonly wa: SchoolSisWhatsappService) {
    super();
  }

  async process(
    job: Job<{
      tenantId: string;
      messageId?: string;
      campaignId?: string;
      userId?: string;
    }>,
  ) {
    try {
      if (job.name === 'send' && job.data.messageId) {
        return this.wa.processSendJob(job.data.tenantId, job.data.messageId);
      }
      if (job.name === 'campaign' && job.data.campaignId) {
        return this.wa.processCampaignJob(
          job.data.tenantId,
          job.data.campaignId,
          job.data.userId,
        );
      }
      this.logger.warn(`Unknown school-whatsapp job ${job.name}`);
      return null;
    } catch (err) {
      this.logger.error(err);
      throw err;
    }
  }
}
