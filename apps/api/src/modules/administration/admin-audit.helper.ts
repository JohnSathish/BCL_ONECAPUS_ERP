import { Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { inferAdminSecurityEvent } from '../security-centre/domain/security-event.types';
import { SecurityEventRecorder } from '../security-centre/security-event.recorder';

export type AdminAuditInput = {
  tenantId: string;
  userId?: string;
  module: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
};

@Injectable()
export class AdminAuditHelper {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly securityEvents?: SecurityEventRecorder,
  ) {}

  async log(input: AdminAuditInput) {
    const row = await this.prisma.auditLog.create({
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
    const inferred = inferAdminSecurityEvent(input);
    if (inferred) {
      void this.securityEvents?.capture({
        tenantId: input.tenantId,
        actorUserId: input.userId,
        eventType: inferred.eventType,
        severity: inferred.severity,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        ipAddress: input.ipAddress,
        summary: `${input.module}: ${input.action}`,
        previousValue: input.previousValue,
        newValue: input.newValue ?? input.metadata,
        subjectKey: input.entityId
          ? `${input.entityType}:${input.entityId}`
          : `actor:${input.userId ?? 'unknown'}`,
      });
    }
    return row;
  }
}
