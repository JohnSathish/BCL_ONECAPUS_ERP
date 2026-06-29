import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { StaffBulkUpdateService } from './staff-bulk-update.service';

@Injectable()
export class StaffBulkUpdateProcessor {
  constructor(private readonly bulkUpdate: StaffBulkUpdateService) {}

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
