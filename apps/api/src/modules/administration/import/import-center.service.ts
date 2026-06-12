import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportEngine } from '../../../common/import/import-engine';
import { ImportBatchRepository } from '../../../common/import/import-batch.repository';
import type {
  ImportCommitMode,
  ImportModule,
} from '../../../common/import/import.types';
import { PrismaService } from '../../../database/prisma.service';
import {
  PortalUsersImportHandler,
  type NormalizedPortalUserRow,
} from './portal-users-import.handler';
import type { NormalizedStaffImportRow } from '../../staff/import/staff-import.handler';
import { StaffImportHandler } from '../../staff/import/staff-import.handler';

@Injectable()
export class ImportCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ImportEngine,
    private readonly batches: ImportBatchRepository,
    private readonly portalUsersHandler: PortalUsersImportHandler,
    private readonly staffHandler: StaffImportHandler,
  ) {}

  handlerFor(module: ImportModule) {
    if (module === 'PORTAL_USERS') return this.portalUsersHandler;
    if (module === 'STAFF') return this.staffHandler;
    throw new NotFoundException(`Import handler not registered: ${module}`);
  }

  async listBatches(
    tenantId: string,
    module: string | undefined,
    page: number,
    limit: number,
  ) {
    const where = {
      tenantId,
      ...(module ? { module } : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.importBatch.count({ where }),
      this.prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async commit(
    tenantId: string,
    userId: string,
    module: ImportModule,
    batchId: string,
    mode: ImportCommitMode,
  ) {
    const handler = this.handlerFor(module);
    const batch = await this.batches.getBatch(batchId, tenantId);
    if (!batch) throw new NotFoundException('Import batch not found');
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
      normalized: r.normalized as NormalizedPortalUserRow &
        NormalizedStaffImportRow,
    }));

    try {
      const created = await handler.commitRows(
        { tenantId, userId, batchId },
        toImport,
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
}
