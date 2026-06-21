import { Injectable, Logger } from '@nestjs/common';
import { mkdir, stat } from 'fs/promises';
import { join } from 'path';
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
