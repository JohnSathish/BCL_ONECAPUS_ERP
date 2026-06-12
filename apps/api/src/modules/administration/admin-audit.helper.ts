import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type AdminAuditInput = {
  tenantId: string;
  userId?: string;
  module: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AdminAuditHelper {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AdminAuditInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        module: input.module,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  }
}
