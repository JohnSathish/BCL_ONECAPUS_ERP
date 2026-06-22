import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { access, mkdir, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../../../database/prisma.service';
import { BackupCloudSyncService } from './backup-cloud-sync.service';
import { BackupDatabaseService } from './backup-database.service';
import { BackupFilesService } from './backup-files.service';

const execFileAsync = promisify(execFile);

export type BackupHealthCheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export type BackupHealthCheckItem = {
  id: string;
  label: string;
  status: BackupHealthCheckStatus;
  message: string;
};

export type BackupHealthCheckResult = {
  allPassed: boolean;
  checkedAt: string;
  checks: BackupHealthCheckItem[];
};

export type BackupHealthCheckContext = 'dashboard' | 'enqueue' | 'execute';

@Injectable()
export class BackupHealthService {
  private readonly logger = new Logger(BackupHealthService.name);

  private workerRunsBackups() {
    return process.env.PROCESS_BACKGROUND_JOBS === 'worker';
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly db: BackupDatabaseService,
    private readonly files: BackupFilesService,
    private readonly cloud: BackupCloudSyncService,
  ) {}

  async runChecks(
    context: BackupHealthCheckContext = 'dashboard',
  ): Promise<BackupHealthCheckResult> {
    const workerMode = this.workerRunsBackups();
    const enqueueOnly = context === 'enqueue' && workerMode;

    const checks = enqueueOnly
      ? await Promise.all([this.checkPostgresql()])
      : await Promise.all([
          this.checkPostgresql(),
          this.checkPgDump(workerMode && context !== 'execute'),
          this.checkStoragePaths(),
          this.checkDiskSpace(),
          this.checkRepositoryWritable(),
          this.checkCloudCredentials(),
        ]);

    const allPassed =
      checks.every(
        (c) =>
          c.status === 'pass' || c.status === 'skip' || c.status === 'warn',
      ) && !checks.some((c) => c.status === 'fail');

    return {
      allPassed,
      checkedAt: new Date().toISOString(),
      checks,
    };
  }

  /** Called before enqueueing a job (API) or executing a run (worker/API executor). */
  async assertReadyForBackup(context: BackupHealthCheckContext = 'execute') {
    const result = await this.runChecks(context);
    const failures = result.checks.filter((c) => c.status === 'fail');
    if (failures.length) {
      const summary = failures
        .map((f) => `${f.label}: ${f.message}`)
        .join('; ');
      throw new BadRequestException(
        `Pre-backup health check failed — ${summary}`,
      );
    }
    return result;
  }

  private async checkPostgresql(): Promise<BackupHealthCheckItem> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        id: 'postgresql',
        label: 'PostgreSQL connectivity',
        status: 'pass',
        message: 'Database connection OK',
      };
    } catch (err) {
      return {
        id: 'postgresql',
        label: 'PostgreSQL connectivity',
        status: 'fail',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async checkPgDump(
    deferToWorker = false,
  ): Promise<BackupHealthCheckItem> {
    if (deferToWorker) {
      return {
        id: 'pg_dump',
        label: 'pg_dump availability',
        status: 'skip',
        message: 'Backup runs on worker container — verified at execution time',
      };
    }
    if (this.db.skipDump()) {
      return {
        id: 'pg_dump',
        label: 'pg_dump availability',
        status: 'skip',
        message: 'Skipped (dev / BACKUP_SKIP_DUMP / Windows)',
      };
    }
    try {
      const bin = this.db.pgDumpPath();
      await execFileAsync(bin, ['--version']);
      return {
        id: 'pg_dump',
        label: 'pg_dump availability',
        status: 'pass',
        message: `${bin} is available`,
      };
    } catch (err) {
      return {
        id: 'pg_dump',
        label: 'pg_dump availability',
        status: 'fail',
        message:
          err instanceof Error
            ? err.message
            : 'pg_dump not found — install postgresql-client or set BACKUP_PG_DUMP_PATH',
      };
    }
  }

  private async checkStoragePaths(): Promise<BackupHealthCheckItem> {
    const paths = [
      { key: 'BACKUP_ROOT', path: this.files.backupRoot() },
      { key: 'UPLOAD_ROOT', path: this.files.uploadRoot() },
      { key: 'STORAGE_ROOT', path: this.files.storageRoot() },
    ];
    const missing: string[] = [];
    for (const p of paths) {
      try {
        await access(p.path);
      } catch {
        missing.push(`${p.key} (${p.path})`);
      }
    }
    if (missing.length) {
      return {
        id: 'storage_path',
        label: 'Storage paths',
        status: 'fail',
        message: `Missing or inaccessible: ${missing.join(', ')}`,
      };
    }
    return {
      id: 'storage_path',
      label: 'Storage paths',
      status: 'pass',
      message: 'Backup, upload, and storage roots accessible',
    };
  }

  private async checkDiskSpace(): Promise<BackupHealthCheckItem> {
    const backupRoot = this.files.backupRoot();
    if (process.platform === 'win32') {
      const quotaGb = Number(process.env.BACKUP_STORAGE_QUOTA_GB ?? 50);
      return {
        id: 'disk_space',
        label: 'Free disk space',
        status: 'warn',
        message: `Windows dev — using quota estimate (${quotaGb} GB)`,
      };
    }
    try {
      const { statfs } = await import('fs/promises');
      const s = await (
        statfs as (
          p: string,
        ) => Promise<{ bsize: number; bavail: number; blocks: number }>
      )(backupRoot);
      if (s.blocks <= 0) {
        return {
          id: 'disk_space',
          label: 'Free disk space',
          status: 'warn',
          message: 'Could not read disk stats',
        };
      }
      const freePct = Math.round((s.bavail / s.blocks) * 100);
      const freeGb = (
        (BigInt(s.bavail) * BigInt(s.bsize)) /
        (1024n * 1024n * 1024n)
      ).toString();
      if (freePct < 5) {
        return {
          id: 'disk_space',
          label: 'Free disk space',
          status: 'fail',
          message: `Critical: only ${freePct}% free (~${freeGb} GB) on backup volume`,
        };
      }
      if (freePct < 10) {
        return {
          id: 'disk_space',
          label: 'Free disk space',
          status: 'warn',
          message: `Low space: ${freePct}% free (~${freeGb} GB)`,
        };
      }
      return {
        id: 'disk_space',
        label: 'Free disk space',
        status: 'pass',
        message: `${freePct}% free (~${freeGb} GB)`,
      };
    } catch (err) {
      return {
        id: 'disk_space',
        label: 'Free disk space',
        status: 'warn',
        message:
          err instanceof Error ? err.message : 'Could not check disk space',
      };
    }
  }

  private async checkRepositoryWritable(): Promise<BackupHealthCheckItem> {
    const root = this.files.backupRoot();
    const probe = join(root, `.healthcheck-${Date.now()}.tmp`);
    try {
      await mkdir(root, { recursive: true });
      await writeFile(probe, 'ok', { flag: 'w' });
      await stat(probe);
      await unlink(probe);
      return {
        id: 'repository_writable',
        label: 'Repository writable',
        status: 'pass',
        message: `Write test OK at ${root}`,
      };
    } catch (err) {
      return {
        id: 'repository_writable',
        label: 'Repository writable',
        status: 'fail',
        message:
          err instanceof Error
            ? err.message
            : `Cannot write to backup repository at ${root}`,
      };
    }
  }

  private async checkCloudCredentials(): Promise<BackupHealthCheckItem> {
    const targets = await this.cloud.listTargetsMasked();
    const enabled = targets.filter((t) => t.enabled);
    if (!enabled.length) {
      return {
        id: 'cloud_credentials',
        label: 'Cloud credentials',
        status: 'skip',
        message: 'Cloud sync disabled — not required',
      };
    }
    const missing = enabled.filter((t) => !t.hasCredentials);
    if (missing.length) {
      return {
        id: 'cloud_credentials',
        label: 'Cloud credentials',
        status: 'fail',
        message: `Missing credentials for: ${missing.map((t) => t.provider).join(', ')}`,
      };
    }
    const errored = enabled.filter((t) => t.lastSyncError);
    if (errored.length) {
      return {
        id: 'cloud_credentials',
        label: 'Cloud credentials',
        status: 'warn',
        message: `Credentials present but last sync failed for ${errored.map((t) => t.provider).join(', ')}`,
      };
    }
    return {
      id: 'cloud_credentials',
      label: 'Cloud credentials',
      status: 'pass',
      message: `${enabled.length} cloud target(s) configured`,
    };
  }
}
