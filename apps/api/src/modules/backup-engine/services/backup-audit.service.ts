import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { backupActionToSecurityEvent } from '../../security-centre/domain/security-event.types';
import { SecurityEventRecorder } from '../../security-centre/security-event.recorder';

export type BackupAuditAction =
  | 'CREATE'
  | 'DOWNLOAD'
  | 'VERIFY'
  | 'RESTORE'
  | 'DELETE'
  | 'CONFIG_CHANGE';

@Injectable()
export class BackupAuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly securityEvents?: SecurityEventRecorder,
  ) {}

  async log(input: {
    action: BackupAuditAction;
    actorId?: string;
    ipAddress?: string;
    runId?: string;
    metadata?: Record<string, unknown>;
    tenantId?: string;
  }) {
    const row = await this.prisma.backupAuditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        ipAddress: input.ipAddress,
        runId: input.runId,
        metadata: (input.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
    if (input.action !== 'DOWNLOAD') {
      const tenantIds = await this.tenantIdsFor(input);
      const mapped = backupActionToSecurityEvent(input.action);
      for (const tenantId of tenantIds) {
        void this.securityEvents?.capture({
          tenantId,
          actorUserId: input.actorId,
          eventType: mapped.eventType,
          severity: mapped.severity,
          module: 'backup',
          action: input.action,
          ipAddress: input.ipAddress,
          entityId: input.runId,
          summary:
            input.action === 'DELETE'
              ? 'A backup was deleted'
              : `Backup action ${input.action}`,
          metadata: input.metadata,
          subjectKey: input.runId ? `backup:${input.runId}` : 'backup',
        });
      }
    }
    return row;
  }

  private async tenantIdsFor(input: {
    action: BackupAuditAction;
    runId?: string;
    tenantId?: string;
  }) {
    if (input.tenantId) return [input.tenantId];
    if (input.runId) {
      const run = await this.prisma.backupRun.findUnique({
        where: { id: input.runId },
        select: { tenantId: true },
      });
      if (run?.tenantId) return [run.tenantId];
    }
    if (input.action !== 'DELETE') return [];
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      select: { id: true },
      take: 20,
    });
    return tenants.map((tenant) => tenant.id);
  }

  async list(query: { page?: number; limit?: number; action?: string }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 30, 100);
    const where = query.action ? { action: query.action } : {};
    const [items, total] = await Promise.all([
      this.prisma.backupAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          run: { select: { id: true, type: true, status: true } },
        },
      }),
      this.prisma.backupAuditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
