import { Injectable, Logger } from '@nestjs/common';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import {
  BackupPackCancelledError,
  materializeBackupPayload,
} from '../backup-zip.util';
import { PrismaService } from '../../../database/prisma.service';
import { BackupDatabaseService } from './backup-database.service';
import { BackupFilesService } from './backup-files.service';
import { BackupSettingsExportService } from './backup-settings-export.service';
import { TenantBackupExportService } from './tenant-backup-export.service';
import { BackupCloudSyncService } from './backup-cloud-sync.service';
import { BackupRetentionService } from './backup-retention.service';
import { SystemMaintenanceService } from './system-maintenance.service';
import { BackupNotificationService } from './backup-notification.service';
import { BackupHealthService } from './backup-health.service';

@Injectable()
export class BackupRunExecutorService {
  private readonly logger = new Logger(BackupRunExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly db: BackupDatabaseService,
    private readonly files: BackupFilesService,
    private readonly settings: BackupSettingsExportService,
    private readonly tenantExport: TenantBackupExportService,
    private readonly cloud: BackupCloudSyncService,
    private readonly retention: BackupRetentionService,
    private readonly maintenance: SystemMaintenanceService,
    private readonly notifications: BackupNotificationService,
    private readonly health: BackupHealthService,
  ) {}

  async updateProgress(runId: string, step: string) {
    await this.prisma.backupRun.update({
      where: { id: runId },
      data: { progressStep: step, status: 'RUNNING' },
    });
  }

  async executeRun(runId: string) {
    const run = await this.prisma.backupRun.findUnique({
      where: { id: runId },
    });
    if (!run) throw new Error(`Run ${runId} not found`);

    await this.prisma.backupRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date(), errorMessage: null },
    });

    let totalSize = 0n;
    try {
      await this.updateProgress(runId, 'PREPARING');
      await this.health.assertReadyForBackup();
      const runDir = this.files.runDir(runId);
      await mkdir(runDir, { recursive: true });

      if (run.type === 'TENANT_EXPORT') {
        if (!run.tenantId)
          throw new Error('tenantId required for TENANT_EXPORT');
        await this.updateProgress(runId, 'EXPORTING_SETTINGS');
        const result = await this.tenantExport.exportTenant(
          runId,
          run.tenantId,
        );
        totalSize += result.sizeBytes;
        for (const [kind, path] of [
          ['TENANT_DATA', result.jsonlPath],
          ['FILES', result.filesArchive],
        ] as const) {
          const checksum = await this.files.sha256File(path);
          const s = await stat(path);
          await this.prisma.backupArtifact.create({
            data: {
              runId,
              kind,
              localPath: path,
              sizeBytes: BigInt(s.size),
              checksumSha256: checksum,
            },
          });
          totalSize += BigInt(s.size);
        }
      } else {
        if (run.type !== 'TENANT_EXPORT') {
          await this.updateProgress(runId, 'DUMPING_DB');
          const dbPath = join(runDir, 'database.dump');
          const dbResult = await this.db.dumpDatabase(dbPath);
          const dbChecksum = await this.files.sha256File(dbPath);
          await this.prisma.backupArtifact.create({
            data: {
              runId,
              kind: 'DATABASE',
              localPath: dbPath,
              sizeBytes: dbResult.sizeBytes,
              checksumSha256: dbChecksum,
            },
          });
          totalSize += dbResult.sizeBytes;
        }

        if (run.type === 'DATABASE_DOCUMENTS' || run.type === 'FULL_SNAPSHOT') {
          await this.updateProgress(runId, 'ARCHIVING_FILES');
          const filesPath = join(runDir, 'files.tar.zst');
          const filesResult = await this.files.archiveInstanceFiles(filesPath);
          const filesChecksum = await this.files.sha256File(filesPath);
          await this.prisma.backupArtifact.create({
            data: {
              runId,
              kind: 'FILES',
              localPath: filesPath,
              sizeBytes: filesResult.sizeBytes,
              checksumSha256: filesChecksum,
            },
          });
          totalSize += filesResult.sizeBytes;
        }

        if (run.type === 'FULL_SNAPSHOT') {
          await this.updateProgress(runId, 'EXPORTING_SETTINGS');
          const settingsPath = await this.settings.exportSettings(runId);
          const settingsChecksum = await this.files.sha256File(settingsPath);
          const s = await stat(settingsPath);
          await this.prisma.backupArtifact.create({
            data: {
              runId,
              kind: 'SETTINGS',
              localPath: settingsPath,
              sizeBytes: BigInt(s.size),
              checksumSha256: settingsChecksum,
            },
          });
          totalSize += BigInt(s.size);
          const manifestPath = await this.settings.buildManifest(runId, {
            type: run.type,
            scope: run.scope,
          });
          const manifestChecksum = await this.files.sha256File(manifestPath);
          const ms = await stat(manifestPath);
          await this.prisma.backupArtifact.create({
            data: {
              runId,
              kind: 'MANIFEST',
              localPath: manifestPath,
              sizeBytes: BigInt(ms.size),
              checksumSha256: manifestChecksum,
            },
          });
          totalSize += BigInt(ms.size);
        }
      }

      await this.updateProgress(runId, 'PACKING_ZIP');
      await this.packRunArchive(runId);
      const archive = await this.prisma.backupArtifact.findFirst({
        where: { runId, kind: 'ARCHIVE' },
      });
      if (archive) totalSize += archive.sizeBytes;

      await this.updateProgress(runId, 'UPLOADING_CLOUD');
      await this.cloud.syncRun(runId);

      await this.prisma.backupRun.update({
        where: { id: runId },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
          sizeBytes: totalSize,
          progressStep: 'COMPLETE',
        },
      });

      await this.retention
        .cleanupExpired()
        .catch((err) => this.logger.warn(`Retention cleanup: ${String(err)}`));

      if (run.triggeredBy !== 'PRE_RESTORE_SAFETY') {
        await this.notifications.notifyRunComplete(runId, true);
      }

      return { runId, ok: true, sizeBytes: totalSize.toString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.backupRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: message,
        },
      });
      if (run.triggeredBy !== 'PRE_RESTORE_SAFETY') {
        await this.notifications.notifyRunComplete(runId, false, message);
      }
      throw err;
    }
  }

  /**
   * Build a WinRAR-compatible ZIP of the run.
   * Does not change the run status and does not delete the original dump files.
   * A cancelled pack removes only the unfinished ZIP and decrypted temp copies.
   */
  async packRunArchive(
    runId: string,
    hooks?: {
      isCancelled?: () => boolean;
      onProgress?: (event: {
        phase: 'preparing' | 'compressing' | 'finalising';
        bytesProcessed: number;
        bytesTotal: number | null;
      }) => void;
    },
  ) {
    const existing = await this.prisma.backupArtifact.findFirst({
      where: { runId, kind: 'ARCHIVE' },
    });
    if (existing) return existing;

    const throwIfCancelled = () => {
      if (hooks?.isCancelled?.()) throw new BackupPackCancelledError();
    };

    throwIfCancelled();
    hooks?.onProgress?.({
      phase: 'preparing',
      bytesProcessed: 0,
      bytesTotal: null,
    });

    const run = await this.prisma.backupRun.findUnique({
      where: { id: runId },
    });
    if (!run) throw new Error(`Run ${runId} not found`);
    const artifacts = await this.prisma.backupArtifact.findMany({
      where: { runId },
    });
    if (!artifacts.length) throw new Error('Backup has no files to archive');

    const runDir = this.files.runDir(runId);
    await mkdir(runDir, { recursive: true });
    const manifestPath = join(runDir, 'backup-manifest.json');
    const manifest = await this.buildManifest(run, artifacts);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const zipPath = join(runDir, 'college-backup.zip');
    const plainDir = join(runDir, 'plain');
    await mkdir(plainDir, { recursive: true });
    const entries = [
      { name: 'backup-manifest.json', sourcePath: manifestPath },
    ];
    let archiveCommitted = false;
    try {
      throwIfCancelled();
      for (const artifact of artifacts) {
        throwIfCancelled();
        const plainPath = join(plainDir, basename(artifact.localPath));
        const source = await materializeBackupPayload(
          artifact.localPath,
          plainPath,
        );
        entries.push({
          name: basename(artifact.localPath),
          sourcePath: source,
        });
      }
      throwIfCancelled();
      const zip = await this.files.writeVerifiedZip(zipPath, entries, {
        isCancelled: hooks?.isCancelled,
        onProgress: (event) => {
          if (event.phase === 'reading') {
            hooks?.onProgress?.({
              phase: 'preparing',
              bytesProcessed: event.bytesProcessed,
              bytesTotal: event.bytesTotal,
            });
            return;
          }
          if (event.phase === 'writing') {
            hooks?.onProgress?.({
              phase: 'compressing',
              bytesProcessed: event.bytesProcessed,
              bytesTotal: event.bytesTotal,
            });
            return;
          }
          hooks?.onProgress?.({
            phase: 'finalising',
            bytesProcessed: 0,
            bytesTotal: null,
          });
        },
      });
      throwIfCancelled();
      hooks?.onProgress?.({
        phase: 'finalising',
        bytesProcessed: 0,
        bytesTotal: null,
      });
      const checksum = await this.files.sha256File(zipPath, {
        isCancelled: hooks?.isCancelled,
        onProgress: (bytesProcessed, bytesTotal) => {
          hooks?.onProgress?.({
            phase: 'finalising',
            bytesProcessed,
            bytesTotal,
          });
        },
      });
      throwIfCancelled();
      const created = await this.prisma.backupArtifact.create({
        data: {
          runId,
          kind: 'ARCHIVE',
          localPath: zipPath,
          sizeBytes: zip.sizeBytes,
          checksumSha256: checksum,
          verifiedAt: new Date(),
        },
      });
      archiveCommitted = true;
      return created;
    } catch (err) {
      if (!archiveCommitted) {
        await rm(zipPath, { force: true }).catch(() => undefined);
      }
      throw err;
    } finally {
      await rm(plainDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }

  private async buildManifest(
    run: {
      id: string;
      type: string;
      startedAt: Date | null;
      tenantId: string | null;
    },
    artifacts: Array<{
      kind: string;
      localPath: string;
      sizeBytes: bigint;
      checksumSha256: string | null;
    }>,
  ) {
    const identity = publicDatabaseIdentity(this.db.databaseUrl());
    const tenant = run.tenantId
      ? await this.prisma.tenant.findUnique({
          where: { id: run.tenantId },
          select: { name: true },
        })
      : await this.prisma.tenant.findFirst({
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { name: true },
        });
    const academicYear = await this.prisma.academicYear
      .findFirst({
        where: {
          deletedAt: null,
          OR: [{ status: 'ACTIVE' }, { isPrimarySession: true }],
        },
        orderBy: { startDate: 'desc' },
        select: { name: true },
      })
      .catch(() => null);
    const database = artifacts.find((a) => a.kind === 'DATABASE');
    const files = artifacts.find((a) => a.kind === 'FILES');
    return {
      backupId: run.id,
      collegeName: tenant?.name ?? 'Don Bosco College, Tura',
      createdAt: (run.startedAt ?? new Date()).toISOString(),
      backupType: run.type,
      academicYear: academicYear?.name ?? null,
      environment: process.env.NODE_ENV ?? 'production',
      database: {
        host: identity.host,
        name: identity.database,
        dumpedAt: (run.startedAt ?? new Date()).toISOString(),
        filename: database ? basename(database.localPath) : null,
        sizeBytes: database ? database.sizeBytes.toString() : '0',
        sha256: database?.checksumSha256 ?? null,
        format: 'pg_dump custom (-Fc)',
      },
      uploadedFiles: {
        filename: files ? basename(files.localPath) : null,
        sizeBytes: files ? files.sizeBytes.toString() : '0',
        sha256: files?.checksumSha256 ?? null,
      },
      components: artifacts.map((artifact) => ({
        kind: artifact.kind,
        filename: basename(artifact.localPath),
        sizeBytes: artifact.sizeBytes.toString(),
        sha256: artifact.checksumSha256,
      })),
      zipVersion: 1,
    };
  }

  async executeRestore(input: {
    runId: string;
    mode: string;
    safetyRunId: string;
    userId?: string;
  }) {
    const safety = await this.prisma.backupRun.findUnique({
      where: { id: input.safetyRunId },
    });
    if (!safety || safety.status !== 'SUCCESS') {
      throw new Error('Safety backup not completed');
    }

    await this.maintenance.activate({
      reason: `Restore from backup ${input.runId}`,
      userId: input.userId,
      backupRunId: input.runId,
    });

    try {
      const run = await this.prisma.backupRun.findUnique({
        where: { id: input.runId },
        include: { artifacts: true },
      });
      if (!run) throw new Error('Backup run not found');

      if (input.mode === 'DATABASE' || input.mode === 'FULL') {
        const dbArtifact = run.artifacts.find((a) => a.kind === 'DATABASE');
        if (!dbArtifact) throw new Error('Database artifact missing');
        await this.db.restoreDatabase(dbArtifact.localPath);
      }

      if (input.mode === 'FILES' || input.mode === 'FULL') {
        const filesArtifact = run.artifacts.find((a) => a.kind === 'FILES');
        if (filesArtifact) {
          await this.files.extractFilesArchive(filesArtifact.localPath);
        }
      }

      await this.maintenance.deactivate();
      return { ok: true };
    } catch (err) {
      await this.maintenance.deactivate();
      throw err;
    }
  }
}

function publicDatabaseIdentity(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'configured',
      database:
        decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'configured',
    };
  } catch {
    return { host: 'configured', database: 'configured' };
  }
}
