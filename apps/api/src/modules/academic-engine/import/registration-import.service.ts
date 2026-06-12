import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportEngine } from '../../../common/import/import-engine';
import { ImportBatchRepository } from '../../../common/import/import-batch.repository';
import type {
  ImportCommitMode,
  ImportRowValidationResult,
} from '../../../common/import/import.types';
import { PrismaService } from '../../../database/prisma.service';
import type { RegistrationImportOptions } from './registration-import.handler';
import {
  RegistrationImportHandler,
  type NormalizedRegistrationImportRow,
} from './registration-import.handler';
import { buildWideTemplateWorkbook } from './wide-registration-import.handler';

@Injectable()
export class RegistrationImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ImportEngine,
    private readonly batches: ImportBatchRepository,
    private readonly handler: RegistrationImportHandler,
  ) {}

  buildTemplate() {
    return this.handler.buildTemplateWorkbook();
  }

  buildWideTemplate() {
    return buildWideTemplateWorkbook();
  }

  async validateUpload(
    tenantId: string,
    userId: string,
    fileName: string,
    buffer: Buffer,
    options: RegistrationImportOptions,
  ) {
    return this.engine.validateUpload(
      this.handler,
      tenantId,
      userId,
      fileName,
      buffer,
      options as Record<string, unknown>,
    );
  }

  async commit(
    tenantId: string,
    userId: string,
    batchId: string,
    mode: ImportCommitMode,
    options: RegistrationImportOptions,
  ) {
    const batch = await this.batches.getBatch(batchId, tenantId);
    if (!batch) throw new NotFoundException('Import batch not found');
    if (batch.module !== 'REGISTRATION_IMPORT') {
      throw new ConflictException('Batch is not a registration import');
    }
    if (batch.status !== 'VALIDATED') {
      throw new ConflictException(
        `Batch is not ready for commit (status: ${batch.status})`,
      );
    }

    if (mode === 'STRICT' && batch.invalidRows > 0) {
      throw new ConflictException(
        `Strict import rejected: ${batch.invalidRows} invalid row(s).`,
      );
    }

    const validDbRows = await this.batches.getRowsByBatch(batchId, {
      status: 'VALID',
    });
    if (validDbRows.length === 0) {
      throw new ConflictException('No valid rows to import');
    }

    await this.batches.updateBatch(batchId, tenantId, {
      status: 'COMMITTING',
      strictMode: mode === 'STRICT',
    });

    const toImport = validDbRows.map((r) => ({
      rowNumber: r.rowNumber,
      normalized: r.normalized as NormalizedRegistrationImportRow,
    }));

    try {
      const created = await this.handler.commitRows(
        {
          tenantId,
          userId,
          batchId,
          options: options as Record<string, unknown>,
        },
        toImport,
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
        studentsProcessed: new Set(toImport.map((r) => r.normalized.studentId))
          .size,
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

  async buildErrorReport(batchId: string, tenantId: string) {
    const batch = await this.batches.getBatch(batchId, tenantId);
    if (!batch) throw new NotFoundException('Import batch not found');

    const dbRows = await this.batches.getRowsByBatch(batchId, {
      status: 'INVALID',
    });

    const rows: ImportRowValidationResult[] = dbRows.map((r) => ({
      rowNumber: r.rowNumber,
      status: 'INVALID',
      raw: r.raw as Record<string, unknown>,
      errors: Array.isArray(r.errors) ? (r.errors as string[]) : [],
      displayCode: (
        r.raw as Record<string, unknown>
      ).registrationNumber?.toString(),
      displayTitle: (r.raw as Record<string, unknown>).courseCode?.toString(),
    }));

    return this.handler.buildErrorReportWorkbook(rows);
  }
}
