import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ImportEngine } from '../../../common/import/import-engine';
import { ImportBatchRepository } from '../../../common/import/import-batch.repository';
import type {
  ImportCommitMode,
  ImportRowValidationResult,
} from '../../../common/import/import.types';
import {
  paginate,
  PaginationQueryDto,
} from '../../../common/dto/pagination.dto';
import { QueueService } from '../../../shared/queue/queue.service';
import {
  CourseImportHandler,
  type NormalizedCourseImportRow,
} from './course-import.handler';

@Injectable()
export class CourseImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ImportEngine,
    private readonly batches: ImportBatchRepository,
    private readonly handler: CourseImportHandler,
    private readonly queue: QueueService,
  ) {}

  buildTemplate() {
    return this.handler.buildTemplateWorkbook();
  }

  async validateUpload(
    tenantId: string,
    userId: string,
    fileName: string,
    buffer: Buffer,
  ) {
    const preview = await this.engine.validateUpload(
      this.handler,
      tenantId,
      userId,
      fileName,
      buffer,
    );

    if (preview.async) {
      await this.queue.enqueueCourseImportValidate({
        tenantId,
        batchId: preview.batchId,
      });
    }

    return preview;
  }

  async runValidateJob(tenantId: string, batchId: string) {
    await this.engine.runValidationJob(this.handler, tenantId, batchId);
  }

  getPreview(batchId: string, tenantId: string, page = 1, limit = 200) {
    const offset = (page - 1) * limit;
    return this.engine.getPreviewFromBatch(batchId, tenantId, offset, limit);
  }

  async commit(
    tenantId: string,
    userId: string,
    batchId: string,
    mode: ImportCommitMode,
  ) {
    const batch = await this.batches.getBatch(batchId, tenantId);
    if (!batch) throw new NotFoundException('Import batch not found');
    if (batch.status !== 'VALIDATED') {
      throw new ConflictException(
        `Batch is not ready for commit (status: ${batch.status})`,
      );
    }

    if (mode === 'STRICT' && batch.invalidRows > 0) {
      throw new ConflictException(
        `Strict import rejected: ${batch.invalidRows} invalid row(s). Fix the file or use VALID_ONLY mode.`,
      );
    }

    const validDbRows = await this.batches.getRowsByBatch(batchId, {
      status: 'VALID',
    });

    if (validDbRows.length === 0) {
      throw new ConflictException('No valid rows to import');
    }

    const rowCount = validDbRows.length;
    if (rowCount > this.engine.getAsyncThreshold()) {
      await this.batches.updateBatch(batchId, tenantId, {
        status: 'COMMITTING',
        strictMode: mode === 'STRICT',
      });
      await this.queue.enqueueCourseImportCommit({
        tenantId,
        userId,
        batchId,
        mode,
      });
      return {
        batchId,
        status: 'COMMITTING',
        async: true,
        message: 'Import queued for background processing',
      };
    }

    return this.commitSync(tenantId, batchId, mode, validDbRows);
  }

  async runCommitJob(
    tenantId: string,
    batchId: string,
    mode: ImportCommitMode,
  ) {
    const validDbRows = await this.batches.getRowsByBatch(batchId, {
      status: 'VALID',
    });
    return this.commitSync(tenantId, batchId, mode, validDbRows);
  }

  private async commitSync(
    tenantId: string,
    batchId: string,
    mode: ImportCommitMode,
    validDbRows: Awaited<ReturnType<ImportBatchRepository['getRowsByBatch']>>,
  ) {
    await this.batches.updateBatch(batchId, tenantId, {
      status: 'COMMITTING',
      strictMode: mode === 'STRICT',
    });

    const toImport = validDbRows.map((r) => ({
      rowNumber: r.rowNumber,
      normalized: r.normalized as NormalizedCourseImportRow,
    }));

    try {
      const created = await this.prisma.$transaction(async () => {
        return this.handler.commitRows(
          { tenantId, userId: '', batchId },
          toImport,
        );
      });

      await this.batches.markRowsImported(
        batchId,
        created.map((c) => ({
          rowNumber: c.rowNumber,
          courseId: c.entityId,
        })),
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

  async listBatches(tenantId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [total, data] = await this.batches.listBatches(
      tenantId,
      'COURSE_MASTER',
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

  async getBatch(batchId: string, tenantId: string) {
    const batch = await this.batches.getBatch(batchId, tenantId);
    if (!batch) throw new NotFoundException('Import batch not found');

    const user = await this.prisma.user.findUnique({
      where: { id: batch.uploadedByUserId },
      select: { email: true },
    });

    return { ...batch, uploadedByEmail: user?.email ?? null };
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
      displayCode: (r.raw as Record<string, unknown>).courseCode?.toString(),
      displayTitle: (r.raw as Record<string, unknown>).courseTitle?.toString(),
    }));

    return this.handler.buildErrorReportWorkbook(rows);
  }

  exportCourses(tenantId: string) {
    return this.handler.buildExportWorkbook(tenantId);
  }
}
