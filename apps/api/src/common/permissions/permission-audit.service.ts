import { Prisma } from '@prisma/client';
import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SecurityEventRecorder } from '../../modules/security-centre/security-event.recorder';

export type PermissionAuditEntry = {
  tenantId: string;
  userId?: string;
  roleSlug?: string;
  permissionSlug?: string;
  module?: string;
  action: string;
  outcome?: 'allowed' | 'denied';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class PermissionAuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly securityEvents?: SecurityEventRecorder,
  ) {}

  async log(entry: PermissionAuditEntry): Promise<void> {
    await this.prisma.permissionAuditLog.create({
      data: {
        tenantId: entry.tenantId,
        userId: entry.userId,
        roleSlug: entry.roleSlug,
        permissionSlug: entry.permissionSlug,
        module: entry.module,
        action: entry.action,
        outcome: entry.outcome ?? 'allowed',
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: (entry.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
    if ((entry.outcome ?? 'allowed') !== 'denied') return;
    void this.securityEvents?.capture({
      tenantId: entry.tenantId,
      actorUserId: entry.userId,
      eventType: 'UNAUTHORIZED_API',
      severity: 'medium',
      module: entry.module ?? 'api',
      action: entry.action,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      summary: 'An API request was denied by the permission check',
      metadata: {
        permission: entry.permissionSlug ?? null,
        role: entry.roleSlug ?? null,
      },
      subjectKey: entry.userId
        ? `user:${entry.userId}`
        : entry.ipAddress
          ? `ip:${entry.ipAddress}`
          : 'anonymous',
    });
  }
}
