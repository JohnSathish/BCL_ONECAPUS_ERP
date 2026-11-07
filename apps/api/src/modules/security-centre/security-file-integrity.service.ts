import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import path from 'path';
import { PrismaService } from '../../database/prisma.service';
import {
  resolveWatchedPath,
  WATCHED_RELATIVE_PATHS,
} from './domain/watched-path';
import { SecurityEventRecorder } from './security-event.recorder';

@Injectable()
export class SecurityFileIntegrityService {
  private readonly logger = new Logger(SecurityFileIntegrityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recorder: SecurityEventRecorder,
  ) {}

  watchRoot() {
    return process.env.SECURITY_WATCH_ROOT || process.cwd();
  }

  async list(tenantId: string) {
    const rows = await this.prisma.securityFileBaseline.findMany({
      where: { tenantId },
      orderBy: { relativePath: 'asc' },
    });
    return {
      root: this.watchRoot(),
      watched: [...WATCHED_RELATIVE_PATHS],
      files: rows.map((row) => ({
        relativePath: row.relativePath,
        sha256: row.sha256,
        sizeBytes: row.sizeBytes,
        status: row.status,
        baselineAt: row.baselineAt,
        lastCheckedAt: row.lastCheckedAt,
      })),
    };
  }

  async scan(tenantId: string, actorUserId?: string | null) {
    const root = this.watchRoot();
    const results: Array<{
      relativePath: string;
      status: string;
      sha256: string | null;
    }> = [];

    for (const relativePath of WATCHED_RELATIVE_PATHS) {
      const target = resolveWatchedPath(root, relativePath);
      if (!target) continue;
      let current: { sha256: string; sizeBytes: number } | null = null;
      try {
        const buffer = await fs.readFile(target);
        current = {
          sha256: createHash('sha256').update(buffer).digest('hex'),
          sizeBytes: buffer.length,
        };
      } catch {
        current = null;
      }

      const existing = await this.prisma.securityFileBaseline.findUnique({
        where: { tenantId_relativePath: { tenantId, relativePath } },
      });
      const now = new Date();

      if (!existing) {
        await this.prisma.securityFileBaseline.create({
          data: {
            tenantId,
            relativePath,
            sha256: current?.sha256 ?? 'missing',
            sizeBytes: current?.sizeBytes ?? 0,
            status: current ? 'BASELINE' : 'MISSING',
            baselineAt: now,
            lastCheckedAt: now,
          },
        });
        results.push({
          relativePath,
          status: current ? 'BASELINE' : 'MISSING',
          sha256: current?.sha256 ?? null,
        });
        continue;
      }

      if (!current) {
        await this.prisma.securityFileBaseline.update({
          where: { id: existing.id },
          data: { status: 'MISSING', lastCheckedAt: now },
        });
        if (existing.status !== 'MISSING') {
          await this.raise(
            tenantId,
            actorUserId,
            relativePath,
            'File is missing',
          );
        }
        results.push({ relativePath, status: 'MISSING', sha256: null });
        continue;
      }

      const changed = existing.sha256 !== current.sha256;
      await this.prisma.securityFileBaseline.update({
        where: { id: existing.id },
        data: {
          status: changed ? 'CHANGED' : 'MATCH',
          sizeBytes: current.sizeBytes,
          lastCheckedAt: now,
        },
      });
      if (changed && existing.status !== 'CHANGED') {
        await this.raise(
          tenantId,
          actorUserId,
          relativePath,
          'Watched file checksum changed',
        );
      }
      results.push({
        relativePath,
        status: changed ? 'CHANGED' : 'MATCH',
        sha256: current.sha256,
      });
    }

    return { root, results };
  }

  async accept(tenantId: string, actorUserId: string, relativePath: string) {
    if (
      !WATCHED_RELATIVE_PATHS.includes(
        relativePath as (typeof WATCHED_RELATIVE_PATHS)[number],
      )
    ) {
      return { accepted: false, reason: 'Path is not on the watch list' };
    }
    const target = resolveWatchedPath(this.watchRoot(), relativePath);
    if (!target) return { accepted: false, reason: 'Path is not allowed' };
    const buffer = await fs.readFile(target);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const now = new Date();
    await this.prisma.securityFileBaseline.upsert({
      where: { tenantId_relativePath: { tenantId, relativePath } },
      create: {
        tenantId,
        relativePath,
        sha256,
        sizeBytes: buffer.length,
        status: 'MATCH',
        baselineAt: now,
        lastCheckedAt: now,
      },
      update: {
        sha256,
        sizeBytes: buffer.length,
        status: 'MATCH',
        baselineAt: now,
        lastCheckedAt: now,
      },
    });
    await this.recorder.capture({
      tenantId,
      actorUserId,
      eventType: 'FILE_BASELINE_ACCEPTED',
      severity: 'medium',
      module: 'security',
      action: 'file_baseline_accepted',
      summary: `Approved a new checksum for ${path.basename(relativePath)}`,
      metadata: { relativePath },
      subjectKey: `file:${relativePath}`,
    });
    return { accepted: true, relativePath, sha256 };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledScan() {
    try {
      const configs = await this.prisma.securityMonitorConfig.findMany({
        where: { fileIntegrityEnabled: true },
        select: { tenantId: true },
        take: 100,
      });
      for (const config of configs) {
        await this.scan(config.tenantId, null);
      }
    } catch (error) {
      this.logger.warn(
        `Scheduled file integrity scan skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private raise(
    tenantId: string,
    actorUserId: string | null | undefined,
    relativePath: string,
    summary: string,
  ) {
    return this.recorder.capture({
      tenantId,
      actorUserId: actorUserId ?? null,
      eventType: 'FILE_INTEGRITY',
      severity: 'critical',
      module: 'security',
      action: 'file_integrity',
      summary,
      metadata: { relativePath },
      subjectKey: `file:${relativePath}`,
    });
  }
}
