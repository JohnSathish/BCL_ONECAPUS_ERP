import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LmsAuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: {
    tenantId: string;
    workspaceId?: string;
    entityType: string;
    entityId?: string;
    action: string;
    actorId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.lmsAuditLog.create({
      data: {
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
