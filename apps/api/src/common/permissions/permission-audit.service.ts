import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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
  }
}
