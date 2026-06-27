import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StudentImportService } from './student-import.service';
import type { StudentImportMode } from '../dto/students.dto';
import type { ImportCommitMode } from '../../../common/import/import.types';

@Processor('exports')
export class StudentImportProcessor extends WorkerHost {
  constructor(private readonly studentImport: StudentImportService) {
    super();
  }

  async process(
    job: Job<{
      tenantId: string;
      userId: string;
      batchId: string;
      mode: string;
      importMode?: string;
    }>,
  ): Promise<unknown> {
    if (job.name !== 'student-import-commit') return null;
    const { tenantId, userId, batchId, mode, importMode } = job.data;
    await this.studentImport.runCommitJob(
      tenantId,
      userId,
      batchId,
      mode as ImportCommitMode,
      (importMode as StudentImportMode | undefined) ?? 'CREATE',
    );
    return { ok: true };
  }
}
