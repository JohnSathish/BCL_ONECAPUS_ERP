import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  ImportBatchStatus,
  ImportModule,
  ImportRowStatus,
  ImportRowValidationResult,
} from './import.types';

@Injectable()
export class ImportBatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  createBatch(data: {
    tenantId: string;
    module: ImportModule;
    uploadedByUserId: string;
    fileName: string;
    status?: ImportBatchStatus;
  }) {
    return this.prisma.importBatch.create({
      data: {
        tenantId: data.tenantId,
        module: data.module,
        uploadedByUserId: data.uploadedByUserId,
        fileName: data.fileName,
        status: data.status ?? 'UPLOADED',
      },
    });
  }

  updateBatch(
    id: string,
    tenantId: string,
    data: Prisma.ImportBatchUpdateInput,
  ) {
    return this.prisma.importBatch.update({
      where: { id, tenantId },
      data,
    });
  }

  getBatch(id: string, tenantId: string) {
    return this.prisma.importBatch.findFirst({
      where: { id, tenantId },
    });
  }

  listBatches(
    tenantId: string,
    module: ImportModule,
    page: number,
    limit: number,
  ) {
    const where = { tenantId, module };
    return this.prisma.$transaction([
      this.prisma.importBatch.count({ where }),
      this.prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
  }

  async insertRows(batchId: string, results: ImportRowValidationResult[]) {
    const chunkSize = 500;
    for (let i = 0; i < results.length; i += chunkSize) {
      const chunk = results.slice(i, i + chunkSize);
      await this.prisma.importBatchRow.createMany({
        data: chunk.map((r) => ({
          batchId,
          rowNumber: r.rowNumber,
          raw: r.raw as Prisma.InputJsonValue,
          normalized: r.normalized
            ? ({
                ...(r.normalized as object),
                ...(r.warnings?.length ? { __importWarnings: r.warnings } : {}),
              } as Prisma.InputJsonValue)
            : undefined,
          status: r.status,
          errors: r.errors.length
            ? (r.errors as Prisma.InputJsonValue)
            : undefined,
        })),
      });
    }
  }

  getRowsByBatch(
    batchId: string,
    options?: { status?: ImportRowStatus; limit?: number; offset?: number },
  ) {
    return this.prisma.importBatchRow.findMany({
      where: {
        batchId,
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { rowNumber: 'asc' },
      ...(options?.limit != null
        ? { take: options.limit, skip: options.offset ?? 0 }
        : {}),
    });
  }

  countRowsByBatch(batchId: string, status?: ImportRowStatus) {
    return this.prisma.importBatchRow.count({
      where: { batchId, ...(status ? { status } : {}) },
    });
  }

  deleteRowsByBatch(batchId: string) {
    return this.prisma.importBatchRow.deleteMany({ where: { batchId } });
  }

  async markRowsImported(
    batchId: string,
    updates: { rowNumber: number; courseId: string }[],
  ) {
    if (updates.length === 0) return;

    const chunkSize = 100;
    for (let offset = 0; offset < updates.length; offset += chunkSize) {
      const chunk = updates.slice(offset, offset + chunkSize);
      const rowNumbers = chunk.map((row) => row.rowNumber);
      const courseIds = chunk.map((row) => row.courseId);
      await this.prisma.$executeRaw`
        UPDATE academic.import_batch_rows AS r
        SET
          status = 'IMPORTED',
          course_id = v.course_id,
          updated_at = NOW()
        FROM (
          SELECT *
          FROM UNNEST(
            ${rowNumbers}::int[],
            ${courseIds}::uuid[]
          ) AS t(row_number, course_id)
        ) AS v
        WHERE r.batch_id = ${batchId}::uuid
          AND r.row_number = v.row_number
      `;
    }
  }
}
