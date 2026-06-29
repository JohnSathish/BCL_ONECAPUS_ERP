import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { StudentBulkUpdateService } from './student-bulk-update.service';

@Injectable()
export class StudentBulkUpdateProcessor {
  constructor(private readonly bulkUpdate: StudentBulkUpdateService) {}

  async process(
    job: Job<{
      tenantId: string;
      batchId: string;
      userId: string;
      ipAddress?: string;
      forceApply?: boolean;
    }>,
  ): Promise<unknown> {
    if (job.name !== 'student-bulk-update-apply') return null;
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
