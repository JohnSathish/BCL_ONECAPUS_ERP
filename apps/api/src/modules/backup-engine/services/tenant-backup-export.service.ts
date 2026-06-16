import { Injectable, Logger } from '@nestjs/common';
import { writeFile, appendFile, stat } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../../database/prisma.service';
import { BackupFilesService } from './backup-files.service';

@Injectable()
export class TenantBackupExportService {
  private readonly logger = new Logger(TenantBackupExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: BackupFilesService,
  ) {}

  async exportTenant(runId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, name: true },
    });
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const tenantDir = join(this.files.runDir(runId), `tenant-${tenant.slug}`);
    const { mkdir } = await import('fs/promises');
    await mkdir(tenantDir, { recursive: true });
    const jsonlPath = join(tenantDir, 'data.jsonl');
    const exportedTables: string[] = [];

    const exporters: Array<{
      label: string;
      fetch: () => Promise<Record<string, unknown>[]>;
    }> = [
      {
        label: 'students',
        fetch: () =>
          this.prisma.student.findMany({ where: { tenantId }, take: 50_000 }),
      },
      {
        label: 'staff_profiles',
        fetch: () =>
          this.prisma.staffProfile.findMany({
            where: { tenantId },
            take: 50_000,
          }),
      },
      {
        label: 'users',
        fetch: () =>
          this.prisma.user.findMany({ where: { tenantId }, take: 50_000 }),
      },
      {
        label: 'institutions',
        fetch: () =>
          this.prisma.institution.findMany({ where: { tenantId }, take: 1000 }),
      },
      {
        label: 'fee_receipts',
        fetch: () =>
          this.prisma.feeReceipt.findMany({
            where: { tenantId },
            take: 50_000,
          }),
      },
    ];

    for (const { label, fetch } of exporters) {
      try {
        const rows = await fetch();
        for (const row of rows) {
          await appendFile(
            jsonlPath,
            `${JSON.stringify({ table: label, data: row })}\n`,
          );
        }
        exportedTables.push(label);
      } catch (err) {
        this.logger.warn(`Skip export ${label}: ${String(err)}`);
      }
    }

    const filesArchive = join(tenantDir, 'files.tar.zst');
    const fileMeta = await this.files.archiveTenantFiles(
      tenantId,
      tenant.slug,
      filesArchive,
    );

    await writeFile(
      join(tenantDir, 'manifest.json'),
      JSON.stringify(
        {
          tenantId,
          slug: tenant.slug,
          exportedTables,
          fileCount: fileMeta.fileCount,
          exportedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    const jsonlStat = await stat(jsonlPath).catch(() => null);
    return {
      jsonlPath,
      filesArchive,
      exportedTables,
      sizeBytes: BigInt(jsonlStat?.size ?? 0) + fileMeta.sizeBytes,
    };
  }
}
