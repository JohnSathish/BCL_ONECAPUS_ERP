import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { basename } from 'path';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../../shared/queue/queue.service';
import { BackupAuditService } from './backup-audit.service';
import { BackupCloudSyncService } from './backup-cloud-sync.service';
import { BackupRetentionService } from './backup-retention.service';
import { BackupVerifyService } from './backup-verify.service';
import { BackupFilesService } from './backup-files.service';
import { SystemMaintenanceService } from './system-maintenance.service';
import { BackupHealthService } from './backup-health.service';
import {
  buildRunLogText,
  diagnoseRun,
  failedComponentLabel,
} from '../backup-diagnostics.util';

function enrichRun<
  T extends {
    status: string;
    progressStep?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | string | null;
    completedAt?: Date | string | null;
    artifacts?: Array<{ kind: string }>;
  },
>(run: T) {
  const diagnostic = run.status === 'FAILED' ? diagnoseRun(run) : null;
  const durationMs =
    run.startedAt && run.completedAt
      ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
      : null;
  const artifactKinds = new Set((run.artifacts ?? []).map((a) => a.kind));
  return {
    ...run,
    diagnostic: diagnostic
      ? {
          failedComponent: diagnostic.failedComponent,
          failedComponentLabel: failedComponentLabel(
            diagnostic.failedComponent,
          ),
          failureReason: diagnostic.failureReason,
          likelyCause: diagnostic.likelyCause,
        }
      : null,
    durationMs: durationMs && durationMs > 0 ? durationMs : null,
    stepStatus: {
      database:
        run.status === 'SUCCESS' || artifactKinds.has('DATABASE')
          ? 'pass'
          : run.status === 'FAILED' &&
              (run.progressStep === 'DUMPING_DB' ||
                !artifactKinds.has('DATABASE'))
            ? 'fail'
            : 'na',
      storage:
        run.status === 'SUCCESS' ||
        artifactKinds.has('FILES') ||
        artifactKinds.has('TENANT_DATA')
          ? 'pass'
          : run.status === 'FAILED' &&
              (run.progressStep === 'ARCHIVING_FILES' ||
                run.progressStep === 'PREPARING')
            ? 'fail'
            : 'na',
    },
  };
}

function serializeRun<
  T extends { sizeBytes?: bigint; artifacts?: Array<{ sizeBytes?: bigint }> },
>(run: T) {
  return {
    ...run,
    sizeBytes: run.sizeBytes?.toString(),
    artifacts: run.artifacts?.map((a) => ({
      ...a,
      sizeBytes: a.sizeBytes?.toString(),
    })),
  };
}

@Injectable()
export class BackupOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly audit: BackupAuditService,
    private readonly cloud: BackupCloudSyncService,
    private readonly retention: BackupRetentionService,
    private readonly verify: BackupVerifyService,
    private readonly files: BackupFilesService,
    private readonly maintenance: SystemMaintenanceService,
    private readonly health: BackupHealthService,
  ) {}

  async getDashboard() {
    const [
      totalBackups,
      latestSuccess,
      latestFailed,
      failedCount,
      restorePoints,
      cloudTargets,
      maintenance,
      readyHealth,
      schedule,
      retention,
      recentRuns,
      preflight,
    ] = await Promise.all([
      this.prisma.backupRun.count({
        where: { status: 'SUCCESS', scope: 'INSTANCE' },
      }),
      this.prisma.backupRun.findFirst({
        where: { status: 'SUCCESS', scope: 'INSTANCE' },
        orderBy: { completedAt: 'desc' },
        include: { artifacts: true },
      }),
      this.prisma.backupRun.findFirst({
        where: { status: 'FAILED' },
        orderBy: { completedAt: 'desc' },
        include: { artifacts: true },
      }),
      this.prisma.backupRun.count({ where: { status: 'FAILED' } }),
      this.prisma.backupRun.count({
        where: { status: 'SUCCESS', scope: 'INSTANCE' },
      }),
      this.cloud.listTargetsMasked(),
      this.maintenance.getStatus(),
      this.checkDbHealth(),
      this.getSchedule(),
      this.retention.getPolicy(),
      this.prisma.backupRun.findMany({
        where: { status: 'SUCCESS', scope: 'INSTANCE' },
        orderBy: { completedAt: 'desc' },
        take: 15,
        include: {
          artifacts: {
            select: {
              id: true,
              kind: true,
              sizeBytes: true,
              cloudStatus: true,
              checksumSha256: true,
              verifiedAt: true,
            },
          },
        },
      }),
      this.health.runChecks(),
    ]);

    let storageUsedBytes = 0n;
    const artifacts = await this.prisma.backupArtifact.findMany({
      select: { sizeBytes: true },
    });
    for (const a of artifacts) storageUsedBytes += a.sizeBytes;

    const backupRoot = this.files.backupRoot();
    let diskFreePct: number | null = null;
    let storageAvailableBytes: bigint | null = null;
    if (process.platform !== 'win32') {
      try {
        const { statfs } = await import('fs/promises');
        const s = await (
          statfs as (
            p: string,
          ) => Promise<{ bsize: number; bavail: number; blocks: number }>
        )(backupRoot);
        if (s.blocks > 0) {
          diskFreePct = Math.round((s.bavail / s.blocks) * 100);
          storageAvailableBytes = BigInt(s.bavail) * BigInt(s.bsize);
        }
      } catch {
        diskFreePct = null;
      }
    } else {
      const quotaGb = Number(process.env.BACKUP_STORAGE_QUOTA_GB ?? 50);
      if (Number.isFinite(quotaGb) && quotaGb > 0) {
        const quotaBytes = BigInt(Math.floor(quotaGb)) * 1024n * 1024n * 1024n;
        storageAvailableBytes =
          quotaBytes > storageUsedBytes ? quotaBytes - storageUsedBytes : 0n;
      }
    }

    const failedAfterLastSuccess =
      latestFailed &&
      (!latestSuccess?.completedAt ||
        !latestFailed.completedAt ||
        latestFailed.completedAt > latestSuccess.completedAt);
    const activeFailure = failedAfterLastSuccess ? latestFailed : null;
    const failedDiagnostic = activeFailure ? diagnoseRun(activeFailure) : null;

    const dbHealthy = readyHealth.status === 'ready';
    const storageHealthy =
      diskFreePct == null ? storageAvailableBytes != null : diskFreePct >= 10;
    const backupHealthy = !activeFailure && totalBackups > 0;
    const cloudHealthy = cloudTargets.every(
      (t) => !t.enabled || (!t.lastSyncError && t.lastSyncAt),
    );

    return {
      totalBackups,
      latestBackup: latestSuccess ? serializeRun(latestSuccess) : null,
      lastFailedBackup: activeFailure
        ? {
            ...serializeRun(activeFailure),
            ...enrichRun(activeFailure),
          }
        : null,
      diagnostics: activeFailure
        ? {
            lastSuccessfulAt: latestSuccess?.completedAt ?? null,
            lastFailedAt: activeFailure.completedAt,
            failureReason: activeFailure.errorMessage,
            failedComponent: failedDiagnostic
              ? failedComponentLabel(failedDiagnostic.failedComponent)
              : null,
            likelyCause: failedDiagnostic?.likelyCause ?? null,
            runId: activeFailure.id,
          }
        : null,
      preflight,
      storageUsedBytes: storageUsedBytes.toString(),
      storageAvailableBytes: storageAvailableBytes?.toString() ?? null,
      diskFreePct,
      restorePoints,
      failedBackups: failedCount,
      cloudSync: cloudTargets.map((t) => ({
        provider: t.provider,
        enabled: t.enabled,
        lastSyncAt: t.lastSyncAt,
        lastSyncError: t.lastSyncError,
        hasCredentials: t.hasCredentials,
      })),
      schedule,
      retention,
      recentRuns: recentRuns.map((r) => ({
        ...serializeRun(r),
        artifacts: r.artifacts.map((a) => ({
          ...a,
          sizeBytes: a.sizeBytes.toString(),
        })),
        verified: r.artifacts.every((a) =>
          Boolean(a.verifiedAt && a.checksumSha256),
        ),
      })),
      localRepository: {
        path: backupRoot,
        backupCount: totalBackups,
        sizeBytes: storageUsedBytes.toString(),
        healthy: storageHealthy,
      },
      health: {
        database: dbHealthy ? 'healthy' : 'degraded',
        storage: storageHealthy ? 'healthy' : 'warning',
        backup: backupHealthy
          ? 'healthy'
          : totalBackups === 0
            ? 'unknown'
            : 'warning',
        cloudSync:
          cloudTargets.filter((t) => t.enabled).length === 0
            ? 'disabled'
            : cloudHealthy
              ? 'healthy'
              : 'warning',
      },
      maintenance,
      dbHealth: readyHealth,
    };
  }

  async getSchedule() {
    return this.prisma.backupSchedule.findFirst({
      where: { tenantId: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateSchedule(input: {
    frequency?: string;
    cronExpression?: string;
    backupType?: string;
    enabled?: boolean;
  }) {
    const existing = await this.getSchedule();
    const nextRunAt = computeNextRun(
      input.frequency ?? existing?.frequency ?? 'DAILY',
      input.cronExpression ?? existing?.cronExpression,
    );
    if (existing) {
      return this.prisma.backupSchedule.update({
        where: { id: existing.id },
        data: { ...input, nextRunAt },
      });
    }
    return this.prisma.backupSchedule.create({
      data: {
        frequency: input.frequency ?? 'DAILY',
        cronExpression: input.cronExpression,
        backupType: input.backupType ?? 'DATABASE_DOCUMENTS',
        enabled: input.enabled ?? true,
        nextRunAt,
      },
    });
  }

  async runHealthCheck() {
    return this.health.runChecks();
  }

  async triggerRun(input: {
    type: string;
    tenantId?: string;
    userId?: string;
    triggeredBy?: string;
    safetyForRunId?: string;
  }) {
    const scope = input.type === 'TENANT_EXPORT' ? 'TENANT' : 'INSTANCE';
    if (scope === 'TENANT' && !input.tenantId) {
      throw new BadRequestException('tenantId required for tenant export');
    }

    await this.health.assertReadyForBackup(
      process.env.PROCESS_BACKGROUND_JOBS === 'worker' ? 'enqueue' : 'execute',
    );

    const run = await this.prisma.backupRun.create({
      data: {
        type: input.type,
        scope,
        tenantId: input.tenantId,
        status: 'QUEUED',
        triggeredBy: input.triggeredBy ?? 'MANUAL',
        triggeredByUserId: input.userId,
        safetyForRunId: input.safetyForRunId,
      },
    });

    const job = await this.queue.enqueueBackupRun({
      runId: run.id,
      type: input.type,
      scope,
      tenantId: input.tenantId,
    });

    await this.prisma.backupRun.update({
      where: { id: run.id },
      data: { jobId: String(job.id) },
    });

    await this.audit.log({
      action: 'CREATE',
      actorId: input.userId,
      runId: run.id,
      metadata: { type: input.type, scope },
    });

    return serializeRun(run);
  }

  /** Re-enqueue backup runs stuck in QUEUED (e.g. after API consumed jobs in worker mode). */
  async reconcileQueuedRuns() {
    const staleBefore = new Date(Date.now() - 30_000);
    const stuck = await this.prisma.backupRun.findMany({
      where: {
        status: 'QUEUED',
        createdAt: { lt: staleBefore },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const runs = [];
    for (const run of stuck) {
      const job = await this.queue.enqueueBackupRun({
        runId: run.id,
        type: run.type,
        scope: run.scope,
        tenantId: run.tenantId ?? undefined,
      });
      await this.prisma.backupRun.update({
        where: { id: run.id },
        data: { jobId: String(job.id), errorMessage: null },
      });
      runs.push({ runId: run.id, jobId: String(job.id) });
    }

    return { requeued: runs.length, runs };
  }

  async listRuns(query: { page?: number; limit?: number; status?: string }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.backupRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          artifacts: {
            select: {
              id: true,
              kind: true,
              sizeBytes: true,
              cloudStatus: true,
            },
          },
        },
      }),
      this.prisma.backupRun.count({ where }),
    ]);
    return {
      items: items.map((r) =>
        enrichRun({
          ...serializeRun(r),
          artifacts: r.artifacts.map((a) => ({
            ...a,
            sizeBytes: a.sizeBytes.toString(),
          })),
        }),
      ),
      total,
      page,
      limit,
    };
  }

  async retryRun(id: string, userId?: string) {
    const failed = await this.prisma.backupRun.findUnique({ where: { id } });
    if (!failed) throw new NotFoundException('Backup run not found');
    if (failed.status !== 'FAILED') {
      throw new BadRequestException('Only failed backup runs can be retried');
    }
    return this.triggerRun({
      type: failed.type,
      tenantId: failed.tenantId ?? undefined,
      userId,
      triggeredBy: 'RETRY',
    });
  }

  async getRunLog(id: string) {
    const run = await this.prisma.backupRun.findUnique({
      where: { id },
      include: { artifacts: true },
    });
    if (!run) throw new NotFoundException('Backup run not found');
    return buildRunLogText({
      ...run,
      artifacts: run.artifacts.map((a) => ({
        kind: a.kind,
        sizeBytes: a.sizeBytes,
        cloudStatus: a.cloudStatus,
      })),
    });
  }

  async getRun(id: string) {
    const run = await this.prisma.backupRun.findUnique({
      where: { id },
      include: { artifacts: true },
    });
    if (!run) throw new NotFoundException('Backup run not found');
    const serialized = {
      ...serializeRun(run),
      artifacts: run.artifacts.map((a) => ({
        ...a,
        sizeBytes: a.sizeBytes.toString(),
      })),
    };
    return enrichRun(serialized);
  }

  async downloadArtifact(runId: string, artifactId: string) {
    const artifact = await this.prisma.backupArtifact.findFirst({
      where: { id: artifactId, runId },
    });
    if (!artifact) throw new NotFoundException('Artifact not found');
    await stat(artifact.localPath);
    const stream = createReadStream(artifact.localPath);
    return new StreamableFile(stream, {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${basename(artifact.localPath)}"`,
    });
  }

  async verifyRun(runId: string, actorId?: string) {
    const result = await this.verify.verifyRun(runId);
    await this.audit.log({
      action: 'VERIFY',
      actorId,
      runId,
      metadata: result,
    });
    return result;
  }

  async deleteRun(runId: string, actorId?: string) {
    const run = await this.prisma.backupRun.findUnique({
      where: { id: runId },
      include: { artifacts: true },
    });
    if (!run) throw new NotFoundException('Run not found');
    const { rm } = await import('fs/promises');
    for (const a of run.artifacts) {
      await this.cloud.deleteCloudObject(a.cloudKey).catch(() => undefined);
      await rm(a.localPath, { force: true }).catch(() => undefined);
    }
    await this.prisma.backupRun.delete({ where: { id: runId } });
    await this.audit.log({ action: 'DELETE', actorId, runId });
    return { deleted: true };
  }

  getRetentionPolicy() {
    return this.retention.getPolicy();
  }

  updateRetentionPolicy(input: {
    keepCount?: number;
    keepDays?: number;
    autoCleanupEnabled?: boolean;
  }) {
    return this.retention.updatePolicy(input);
  }

  listCloudTargets() {
    return this.cloud.listTargetsMasked();
  }

  upsertCloudTarget(
    input: Parameters<BackupCloudSyncService['upsertTarget']>[0],
  ) {
    return this.cloud.upsertTarget(input);
  }

  private async checkDbHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      return { status: 'degraded' };
    }
  }
}

function computeNextRun(frequency: string, cronExpression?: string | null) {
  const now = new Date();
  const next = new Date(now);
  switch (frequency) {
    case 'EVERY_6H':
      next.setHours(next.getHours() + 6);
      break;
    case 'EVERY_12H':
      next.setHours(next.getHours() + 12);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      next.setHours(2, 0, 0, 0);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      next.setHours(2, 0, 0, 0);
      break;
    case 'CRON':
      if (cronExpression) {
        next.setDate(next.getDate() + 1);
      } else {
        next.setDate(next.getDate() + 1);
        next.setHours(2, 0, 0, 0);
      }
      break;
    default:
      next.setDate(next.getDate() + 1);
      next.setHours(2, 0, 0, 0);
  }
  return next;
}
