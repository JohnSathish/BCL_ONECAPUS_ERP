import { BadRequestException, Injectable } from '@nestjs/common';
import { parseExcelDataSheet } from './excel.util';
import { ImportBatchRepository } from './import-batch.repository';
import type {
  ImportModuleHandler,
  ImportPreviewResponse,
  ImportRowValidationResult,
  ImportValidateOptions,
  ParsedImportRow,
} from './import.types';

const MAX_ROWS = 10_000;
const PREVIEW_ROW_LIMIT = 200;
const ASYNC_ROW_THRESHOLD = 500;

@Injectable()
export class ImportEngine {
  constructor(private readonly batches: ImportBatchRepository) {}

  getAsyncThreshold() {
    return ASYNC_ROW_THRESHOLD;
  }

  async validateUpload(
    handler: ImportModuleHandler,
    tenantId: string,
    userId: string,
    fileName: string,
    buffer: Buffer,
    options?: ImportValidateOptions,
  ): Promise<ImportPreviewResponse & { async: boolean }> {
    const parsed = await parseExcelDataSheet(buffer);
    if (parsed.length === 0) {
      throw new BadRequestException('No data rows found in Excel file');
    }
    if (parsed.length > MAX_ROWS) {
      throw new BadRequestException(`File exceeds maximum of ${MAX_ROWS} rows`);
    }

    const batch = await this.batches.createBatch({
      tenantId,
      module: handler.module,
      uploadedByUserId: userId,
      fileName,
      status: parsed.length > ASYNC_ROW_THRESHOLD ? 'VALIDATING' : 'UPLOADED',
    });

    const useAsync = parsed.length > ASYNC_ROW_THRESHOLD;
    if (useAsync) {
      const pendingRows: ImportRowValidationResult[] = parsed.map((p) => ({
        rowNumber: p.rowNumber,
        status: 'PENDING',
        raw: p.raw,
        errors: [],
      }));
      await this.batches.insertRows(batch.id, pendingRows);
      await this.batches.updateBatch(batch.id, tenantId, {
        status: 'VALIDATING',
        totalRows: parsed.length,
      });
      return {
        batchId: batch.id,
        status: 'VALIDATING',
        summary: { total: parsed.length, valid: 0, invalid: 0 },
        rows: [],
        hasMore: parsed.length > PREVIEW_ROW_LIMIT,
        async: true,
      };
    }

    const results = await handler.parseAndValidate(tenantId, parsed, options);
    await this.persistValidation(batch.id, tenantId, results);

    return {
      ...this.buildPreview(batch.id, 'VALIDATED', results),
      async: false,
    };
  }

  async runValidationJob(
    handler: ImportModuleHandler,
    tenantId: string,
    batchId: string,
    options?: ImportValidateOptions,
  ) {
    try {
      const pending = await this.batches.getRowsByBatch(batchId);
      const parsed: ParsedImportRow[] = pending.map((r) => ({
        rowNumber: r.rowNumber,
        raw: r.raw as Record<string, unknown>,
      }));
      await this.batches.deleteRowsByBatch(batchId);
      const results = await handler.parseAndValidate(tenantId, parsed, options);
      await this.persistValidation(batchId, tenantId, results);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Validation failed';
      await this.batches.updateBatch(batchId, tenantId, {
        status: 'FAILED',
        errorMessage: message,
        completedAt: new Date(),
      });
      throw e;
    }
  }

  private async persistValidation(
    batchId: string,
    tenantId: string,
    results: ImportRowValidationResult[],
  ) {
    const valid = results.filter((r) => r.status === 'VALID').length;
    const invalid = results.length - valid;
    await this.batches.insertRows(batchId, results);
    await this.batches.updateBatch(batchId, tenantId, {
      status: 'VALIDATED',
      totalRows: results.length,
      validRows: valid,
      invalidRows: invalid,
    });
  }

  buildPreview(
    batchId: string,
    status: ImportPreviewResponse['status'],
    results: ImportRowValidationResult[],
  ): ImportPreviewResponse & { async: boolean } {
    const valid = results.filter((r) => r.status === 'VALID').length;
    const warnings = results.filter(
      (r) => (r.warnings?.length ?? 0) > 0,
    ).length;
    return {
      batchId,
      status,
      summary: {
        total: results.length,
        valid,
        invalid: results.length - valid,
        warnings,
      },
      rows: results.slice(0, PREVIEW_ROW_LIMIT),
      hasMore: results.length > PREVIEW_ROW_LIMIT,
      async: false,
    };
  }

  async getPreviewFromBatch(
    batchId: string,
    tenantId: string,
    offset = 0,
    limit = PREVIEW_ROW_LIMIT,
  ): Promise<ImportPreviewResponse | null> {
    const batch = await this.batches.getBatch(batchId, tenantId);
    if (!batch) return null;

    const dbRows = await this.batches.getRowsByBatch(batchId, {
      limit,
      offset,
    });
    const total = batch.totalRows;

    const rows: ImportRowValidationResult[] = dbRows.map((r) => {
      const normalizedRaw = r.normalized as Record<string, unknown> | null;
      const warnings = Array.isArray(normalizedRaw?.__importWarnings)
        ? (normalizedRaw.__importWarnings as string[])
        : undefined;
      const normalized = normalizedRaw
        ? Object.fromEntries(
            Object.entries(normalizedRaw).filter(
              ([k]) => k !== '__importWarnings',
            ),
          )
        : undefined;
      const errors = Array.isArray(r.errors) ? (r.errors as string[]) : [];
      const raw = r.raw as Record<string, unknown>;
      return {
        rowNumber: r.rowNumber,
        status: r.status as ImportRowValidationResult['status'],
        raw,
        normalized:
          normalized && Object.keys(normalized).length ? normalized : undefined,
        errors,
        warnings,
        displayCode:
          (normalized?.employeeCode as string) ??
          (normalized?.code as string) ??
          raw.employeeCode?.toString() ??
          raw.staff_code?.toString() ??
          raw.courseCode?.toString(),
        displayTitle:
          (normalized?.fullName as string) ??
          (normalized?.title as string) ??
          raw.fullName?.toString() ??
          raw.full_name?.toString() ??
          raw.courseTitle?.toString(),
        academicMapping: normalized?.academicMapping,
      };
    });

    return {
      batchId,
      status: batch.status as ImportPreviewResponse['status'],
      summary: {
        total,
        valid: batch.validRows,
        invalid: batch.invalidRows,
      },
      rows,
      hasMore: offset + limit < total,
    };
  }
}
