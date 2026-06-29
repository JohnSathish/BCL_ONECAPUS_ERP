import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ImportEngine } from '../../../common/import/import-engine';

import { ImportBatchRepository } from '../../../common/import/import-batch.repository';

import type { ImportCommitMode } from '../../../common/import/import.types';

import {
  paginate,
  PaginationQueryDto,
} from '../../../common/dto/pagination.dto';

import { PrismaService } from '../../../database/prisma.service';

import { QueueService } from '../../../shared/queue/queue.service';

import type { StudentImportMode } from '../dto/students.dto';

import {
  StudentImportHandler,
  type NormalizedStudentImportRow,
} from './student-import.handler';
import { Sem1ImportCurriculumService } from './sem1-import-curriculum.service';
import { Sem3ImportCurriculumService } from './sem3-import-curriculum.service';
import { Sem5ImportCurriculumService } from './sem5-import-curriculum.service';

/** Large student imports run in the background to avoid HTTP timeouts. */
const STUDENT_IMPORT_ASYNC_COMMIT_THRESHOLD = 50;

@Injectable()
export class StudentImportService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly engine: ImportEngine,

    private readonly batches: ImportBatchRepository,

    private readonly handler: StudentImportHandler,

    private readonly sem1Curriculum: Sem1ImportCurriculumService,
    private readonly sem3Curriculum: Sem3ImportCurriculumService,
    private readonly sem5Curriculum: Sem5ImportCurriculumService,

    private readonly queue: QueueService,
  ) {}

  buildTemplate(options?: { mode?: 'blank' | 'prefilled'; tenantId?: string }) {
    return this.handler.buildTemplateWorkbook(options);
  }

  buildSem1AdmissionTemplate(options: {
    tenantId: string;
    programme?: string;
    programVersionId?: string;
    semesterSequence?: number;
    academicYearId?: string;
  }) {
    return this.handler.buildSem1AdmissionTemplateWorkbook(options);
  }

  buildSem1LegacyFullAdmissionTemplate() {
    return this.handler.buildSem1LegacyFullAdmissionTemplateWorkbook();
  }

  buildFullAdmissionTemplate(options: {
    tenantId: string;
    programme?: string;
    programVersionId?: string;
    academicYearId?: string;
  }) {
    return this.handler.buildFullAdmissionTemplateWorkbook(options);
  }

  getImportFieldRegistry() {
    return this.handler.getImportFieldRegistry();
  }

  buildSem3AdmissionTemplate(options: {
    tenantId: string;
    programme?: string;
    programVersionId?: string;
    semesterSequence?: number;
  }) {
    return this.handler.buildSem3AdmissionTemplateWorkbook(options);
  }

  buildSem5AdmissionTemplate(options: {
    tenantId: string;
    programme?: string;
    programVersionId?: string;
    semesterSequence?: number;
    academicYearId?: string;
  }) {
    return this.handler.buildSem5AdmissionTemplateWorkbook(options);
  }

  listSem3ImportProgrammes(tenantId: string) {
    return this.sem3Curriculum.listPublishedProgrammes(tenantId);
  }

  listSem1ImportProgrammes(tenantId: string) {
    return this.sem1Curriculum.listPublishedProgrammes(tenantId);
  }

  listSem5ImportProgrammes(tenantId: string) {
    return this.sem5Curriculum.listPublishedProgrammes(tenantId);
  }

  getSem3ImportCurriculum(
    tenantId: string,
    input: {
      programme?: string;
      programVersionId?: string;
      semesterSequence?: number;
    },
  ) {
    return this.sem3Curriculum.buildCatalog(tenantId, input);
  }

  getSem1ImportCurriculum(
    tenantId: string,
    input: {
      programme?: string;
      programVersionId?: string;
      semesterSequence?: number;
      academicYearId?: string;
    },
  ) {
    return this.sem1Curriculum.buildCatalog(tenantId, input);
  }

  getSem1EligibleMinors(
    tenantId: string,
    input: {
      programVersionId: string;
      majorDepartment: string;
      academicYearId?: string;
      semesterSequence?: number;
    },
  ) {
    return this.sem1Curriculum.listEligibleMinorsForMajor(tenantId, input);
  }

  getSem5ImportCurriculum(
    tenantId: string,
    input: {
      programme?: string;
      programVersionId?: string;
      semesterSequence?: number;
      academicYearId?: string;
    },
  ) {
    return this.sem5Curriculum.buildCatalog(tenantId, input);
  }

  getSem5EligibleMinors(
    tenantId: string,
    input: {
      programVersionId: string;
      majorDepartment: string;
      academicYearId?: string;
      semesterSequence?: number;
    },
  ) {
    return this.sem5Curriculum.listEligibleMinorsForMajor(tenantId, input);
  }

  async validateUpload(
    tenantId: string,

    userId: string,

    fileName: string,

    buffer: Buffer,

    options?: { importMode?: StudentImportMode },
  ) {
    return this.engine.validateUpload(
      this.handler,

      tenantId,

      userId,

      fileName,

      buffer,

      {
        ...options,
        excelSheetName: 'Students',
        excelDataStartRow: 3,
      },
    );
  }

  async commit(
    tenantId: string,

    userId: string,

    batchId: string,

    mode: ImportCommitMode,

    importMode: StudentImportMode = 'CREATE',
  ) {
    const batch = await this.batches.getBatch(batchId, tenantId);

    if (!batch) throw new NotFoundException('Import batch not found');

    if (batch.status === 'COMMITTING') {
      if (batch.successfulRows > 0) {
        return {
          batchId,
          status: 'COMMITTING',
          async: true,
          message:
            'Import already in progress. Waiting for background processing to finish.',
        };
      }

      // A prior background job may have been consumed by the wrong worker and
      // marked complete without importing — allow the user to retry commit.
      await this.batches.updateBatch(batchId, tenantId, {
        status: 'VALIDATED',
      });
    }

    const latestBatch = await this.batches.getBatch(batchId, tenantId);
    if (!latestBatch) throw new NotFoundException('Import batch not found');

    if (latestBatch.status !== 'VALIDATED') {
      throw new ConflictException(
        `Batch is not ready for commit (status: ${latestBatch.status})`,
      );
    }

    if (mode === 'STRICT' && latestBatch.invalidRows > 0) {
      throw new ConflictException(
        `Strict import rejected: ${latestBatch.invalidRows} invalid row(s).`,
      );
    }

    const validDbRows = await this.batches.getRowsByBatch(batchId, {
      status: 'VALID',
    });

    if (validDbRows.length === 0) {
      throw new ConflictException('No valid rows to import');
    }

    if (validDbRows.length > STUDENT_IMPORT_ASYNC_COMMIT_THRESHOLD) {
      await this.batches.updateBatch(batchId, tenantId, {
        status: 'COMMITTING',
        strictMode: mode === 'STRICT',
      });
      await this.queue.enqueueStudentImportCommit({
        tenantId,
        userId,
        batchId,
        mode,
        importMode,
      });
      return {
        batchId,
        status: 'COMMITTING',
        async: true,
        message:
          'Import queued for background processing. This may take several minutes for large files.',
      };
    }

    return this.commitSync(
      tenantId,
      userId,
      batchId,
      mode,
      importMode,
      validDbRows,
    );
  }

  async runCommitJob(
    tenantId: string,
    userId: string,
    batchId: string,
    mode: ImportCommitMode,
    importMode: StudentImportMode = 'CREATE',
  ) {
    const validDbRows = await this.batches.getRowsByBatch(batchId, {
      status: 'VALID',
    });
    return this.commitSync(
      tenantId,
      userId,
      batchId,
      mode,
      importMode,
      validDbRows,
    );
  }

  private async commitSync(
    tenantId: string,
    userId: string,
    batchId: string,
    mode: ImportCommitMode,
    importMode: StudentImportMode,
    validDbRows: Awaited<ReturnType<ImportBatchRepository['getRowsByBatch']>>,
  ) {
    await this.batches.updateBatch(batchId, tenantId, {
      status: 'COMMITTING',
      strictMode: mode === 'STRICT',
    });

    const toImport = validDbRows.map((r) => ({
      rowNumber: r.rowNumber,
      normalized: r.normalized as NormalizedStudentImportRow,
    }));

    try {
      let lastProgressUpdate = 0;
      const created = await this.handler.commitRows(
        { tenantId, userId, batchId, options: { importMode } },
        toImport,
        {
          onProgress: async (processed, total) => {
            if (
              processed === 1 ||
              processed === total ||
              processed - lastProgressUpdate >= 2
            ) {
              lastProgressUpdate = processed;
              await this.batches.updateBatch(batchId, tenantId, {
                successfulRows: processed,
                validRows: total,
              });
            }
          },
        },
      );

      await this.batches.markRowsImported(
        batchId,
        created.map((c) => ({ rowNumber: c.rowNumber, courseId: c.entityId })),
      );

      await this.batches.updateBatch(batchId, tenantId, {
        status: 'COMMITTED',
        successfulRows: created.length,
        failedRows: 0,
        completedAt: new Date(),
      });

      return {
        batchId,
        status: 'COMMITTED',
        async: false,
        successfulRows: created.length,
        failedRows: 0,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Import failed';

      await this.batches.updateBatch(batchId, tenantId, {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      });

      throw e;
    }
  }

  async getBatch(tenantId: string, batchId: string) {
    const batch = await this.batches.getBatch(batchId, tenantId);
    if (!batch) throw new NotFoundException('Import batch not found');

    const user = await this.prisma.user.findUnique({
      where: { id: batch.uploadedByUserId },
      select: { email: true },
    });

    return {
      ...batch,
      uploadedByEmail: user?.email ?? null,
    };
  }

  async listBatches(tenantId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;

    const limit = query.limit ?? 20;

    const [total, data] = await this.batches.listBatches(
      tenantId,

      'STUDENT_MASTER',

      page,

      limit,
    );

    const userIds = [...new Set(data.map((b) => b.uploadedByUserId))];

    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },

            select: { id: true, email: true },
          })
        : [];

    const emailById = new Map(users.map((u) => [u.id, u.email]));

    const enriched = data.map((b) => ({
      ...b,

      uploadedByEmail: emailById.get(b.uploadedByUserId) ?? null,
    }));

    return paginate(enriched, total, page, limit);
  }

  getBatchPreview(
    batchId: string,

    tenantId: string,

    page = 1,

    limit = 200,
  ) {
    const offset = (page - 1) * limit;

    return this.engine.getPreviewFromBatch(batchId, tenantId, offset, limit);
  }

  async buildErrorReport(batchId: string, tenantId: string) {
    const batch = await this.batches.getBatch(batchId, tenantId);

    if (!batch) throw new NotFoundException('Import batch not found');

    const dbRows = await this.batches.getRowsByBatch(batchId, {
      status: 'INVALID',
    });

    const rows = dbRows.map((r) => ({
      rowNumber: r.rowNumber,

      status: 'INVALID' as const,

      raw: r.raw as Record<string, unknown>,

      errors: Array.isArray(r.errors) ? (r.errors as string[]) : [],

      displayCode: (
        r.raw as Record<string, unknown>
      ).registrationNumber?.toString(),

      displayTitle: (r.raw as Record<string, unknown>).fullName?.toString(),
    }));

    return this.handler.buildErrorReportWorkbook(rows);
  }
}
