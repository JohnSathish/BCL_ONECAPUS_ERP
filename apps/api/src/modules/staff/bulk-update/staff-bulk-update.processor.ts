import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StaffBulkUpdateService } from './staff-bulk-update.service';

@Processor('exports')
export class StaffBulkUpdateProcessor extends WorkerHost {
  constructor(private readonly bulkUpdate: StaffBulkUpdateService) {
    super();
  }

  async process(
    job: Job<{
      tenantId: string;
      batchId: string;
      userId: string;
      forceApply?: boolean;
    }>,
  ): Promise<unknown> {
    if (job.name !== 'staff-bulk-update-apply') return null;
    const { tenantId, batchId, userId, forceApply } = job.data;
    await this.bulkUpdate.applyBatchInternal(
      tenantId,
      batchId,
      userId,
      forceApply ?? false,
    );
    return { ok: true };
  }
}
