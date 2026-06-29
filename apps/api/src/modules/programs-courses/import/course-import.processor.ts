import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { CourseImportService } from './course-import.service';

@Injectable()
export class CourseImportProcessor {
  constructor(private readonly courseImport: CourseImportService) {}

  async process(
    job: Job<
      | { tenantId: string; batchId: string }
      | { tenantId: string; batchId: string; mode: string }
    >,
  ): Promise<unknown> {
    if (job.name === 'course-import-validate') {
      const { tenantId, batchId } = job.data as {
        tenantId: string;
        batchId: string;
      };
      await this.courseImport.runValidateJob(tenantId, batchId);
      return { ok: true };
    }
    if (job.name === 'course-import-commit') {
      const { tenantId, batchId, mode } = job.data as {
        tenantId: string;
        batchId: string;
        mode: string;
      };
      await this.courseImport.runCommitJob(
        tenantId,
        batchId,
        mode as 'VALID_ONLY' | 'STRICT',
      );
      return { ok: true };
    }
    return null;
  }
}
