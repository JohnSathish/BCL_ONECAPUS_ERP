import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { StudentImportService } from './student-import.service';
import type { StudentImportMode } from '../dto/students.dto';
import type { ImportCommitMode } from '../../../common/import/import.types';

@Injectable()
export class StudentImportProcessor {
  constructor(private readonly studentImport: StudentImportService) {}

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
