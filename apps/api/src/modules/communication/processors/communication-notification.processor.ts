import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CommunicationDeliveryService } from '../services/communication-delivery.service';

@Processor('notifications')
export class CommunicationNotificationProcessor extends WorkerHost {
  constructor(private readonly delivery: CommunicationDeliveryService) {
    super();
  }

  async process(job: Job<Record<string, unknown>>): Promise<unknown> {
    if (job.name !== 'send') return null;

    const jobType = job.data.jobType as string | undefined;
    if (jobType === 'campaign-deliver') {
      const tenantId = String(job.data.tenantId);
      const campaignId = String(job.data.campaignId);
      return this.delivery.deliverCampaign(tenantId, campaignId);
    }

    return this.delivery.processLegacyNotificationJob(job.data);
  }
}
