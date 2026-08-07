import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CommunicationCampaignsService } from '../services/communication-campaigns.service';
import { CommunicationDeliveryService } from '../services/communication-delivery.service';

/** Long lock — prepare + multi-batch FCM for college-wide broadcasts. */
@Processor('notifications', {
  lockDuration: 600_000,
  stalledInterval: 120_000,
  maxStalledCount: 2,
  // Keep renewing while long FCM/email batches run; default half-lock can still
  // race when the event loop is busy delivering thousands of pushes.
  lockRenewTime: 30_000,
})
export class CommunicationNotificationProcessor extends WorkerHost {
  constructor(
    private readonly delivery: CommunicationDeliveryService,
    private readonly campaigns: CommunicationCampaignsService,
  ) {
    super();
  }

  async process(job: Job<Record<string, unknown>>): Promise<unknown> {
    if (job.name !== 'send') return null;

    const jobType = job.data.jobType as string | undefined;
    if (jobType === 'campaign-prepare-and-deliver') {
      const tenantId = String(job.data.tenantId);
      const campaignId = String(job.data.campaignId);
      return this.campaigns.prepareAndDeliver(tenantId, campaignId);
    }

    if (jobType === 'campaign-deliver') {
      const tenantId = String(job.data.tenantId);
      const campaignId = String(job.data.campaignId);
      return this.delivery.deliverCampaign(tenantId, campaignId);
    }

    if (jobType === 'campaign-deliver-batch') {
      const tenantId = String(job.data.tenantId);
      const campaignId = String(job.data.campaignId);
      const offset = Number(job.data.offset ?? 0);
      const limit = Number(job.data.limit ?? 40);
      return this.delivery.deliverCampaignBatch(
        tenantId,
        campaignId,
        offset,
        limit,
      );
    }

    if (jobType === 'campaign-deliver-retry') {
      const tenantId = String(job.data.tenantId);
      const campaignId = String(job.data.campaignId);
      const recipientId = job.data.recipientId
        ? String(job.data.recipientId)
        : undefined;
      const channel = job.data.channel ? String(job.data.channel) : undefined;
      return this.delivery.deliverCampaignBatch(tenantId, campaignId, 0, 1, {
        recipientId,
        channel,
      });
    }

    return this.delivery.processLegacyNotificationJob(job.data);
  }
}
