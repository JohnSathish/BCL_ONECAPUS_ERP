import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PrincipalCommsAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    tenantId: string;
    actorId: string;
    accountId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await this.prisma.principalMailAuditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        accountId: input.accountId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  list(tenantId: string, actorId: string, take = 50) {
    return this.prisma.principalMailAuditLog.findMany({
      where: { tenantId, actorId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
