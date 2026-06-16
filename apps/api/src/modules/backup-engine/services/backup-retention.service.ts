import { Injectable, Logger } from '@nestjs/common';
import { rm, stat } from 'fs/promises';
import { PrismaService } from '../../../database/prisma.service';
import { BackupCloudSyncService } from './backup-cloud-sync.service';

@Injectable()
export class BackupRetentionService {
  private readonly logger = new Logger(BackupRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloud: BackupCloudSyncService,
  ) {}

  async getPolicy() {
    return this.prisma.backupRetentionPolicy.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', keepDays: 30, autoCleanupEnabled: true },
      update: {},
    });
  }

  async updatePolicy(input: {
    keepCount?: number;
    keepDays?: number;
    autoCleanupEnabled?: boolean;
  }) {
    return this.prisma.backupRetentionPolicy.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        keepDays: input.keepDays ?? 30,
        keepCount: input.keepCount,
        autoCleanupEnabled: input.autoCleanupEnabled ?? true,
      },
      update: input,
    });
  }

  async cleanupExpired() {
    const policy = await this.getPolicy();
    if (!policy.autoCleanupEnabled) return { deleted: 0 };

    const successRuns = await this.prisma.backupRun.findMany({
      where: {
        status: 'SUCCESS',
        scope: 'INSTANCE',
        triggeredBy: { not: 'PRE_RESTORE_SAFETY' },
      },
      orderBy: { completedAt: 'desc' },
      include: { artifacts: true },
    });

    const toDelete: typeof successRuns = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - policy.keepDays);

    if (policy.keepCount) {
      toDelete.push(...successRuns.slice(policy.keepCount));
    }
    for (const run of successRuns) {
      if (run.completedAt && run.completedAt < cutoff) {
        if (!toDelete.find((r) => r.id === run.id)) toDelete.push(run);
      }
    }

    let deleted = 0;
    for (const run of toDelete) {
      try {
        for (const artifact of run.artifacts) {
          await this.cloud
            .deleteCloudObject(artifact.cloudKey)
            .catch(() => undefined);
          await rm(artifact.localPath, { force: true }).catch(() => undefined);
        }
        const runDir = run.artifacts[0]?.localPath
          ? run.artifacts[0].localPath.split(/[/\\]/).slice(0, -1).join('/')
          : null;
        if (runDir)
          await rm(runDir, { recursive: true, force: true }).catch(
            () => undefined,
          );
        await this.prisma.backupRun.delete({ where: { id: run.id } });
        deleted++;
      } catch (err) {
        this.logger.warn(`Retention delete failed ${run.id}: ${String(err)}`);
      }
    }
    return { deleted };
  }
}
