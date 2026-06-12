import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StudentBulkUpdateService } from './student-bulk-update.service';

@Processor('exports')
export class StudentBulkUpdateProcessor extends WorkerHost {
  constructor(private readonly bulkUpdate: StudentBulkUpdateService) {
    super();
  }

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
