import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StudentPhotoBulkService } from './student-photo-bulk.service';

@Processor('exports')
export class StudentPhotoBulkProcessor extends WorkerHost {
  constructor(private readonly photoBulk: StudentPhotoBulkService) {
    super();
  }

  async process(
    job: Job<{
      tenantId: string;
      batchId: string;
      userId: string;
      conflictStrategy?: string;
    }>,
  ): Promise<unknown> {
    if (process.env.PROCESS_BACKGROUND_JOBS === 'worker') return undefined;
    if (job.name !== 'student-photo-bulk-apply') return null;
    const { tenantId, batchId, userId, conflictStrategy } = job.data;
    await this.photoBulk.applyBatchInternal(
      tenantId,
      batchId,
      userId,
      conflictStrategy,
    );
    return { ok: true };
  }
}
