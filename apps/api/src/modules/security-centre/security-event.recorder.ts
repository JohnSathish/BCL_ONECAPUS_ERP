import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { redactSecurityValue } from './domain/redact-security-payload';
import {
  hashSecurityRecord,
  type SecurityHashPayload,
} from './domain/security-hash';
import type { SecurityCaptureInput } from './domain/security-event.types';
import { SecurityThreatService } from './security-threat.service';

const INSPECT_TYPES = new Set([
  'LOGIN_FAILED',
  'ACCOUNT_LOCKOUT',
  'UNAUTHORIZED_API',
  'PRIVILEGE_CHANGE',
  'ADMIN_ACCOUNT_CREATED',
  'BULK_DOWNLOAD',
  'DATA_CHANGE',
  'MASS_MUTATION',
  'BACKUP_DELETION',
  'FILE_INTEGRITY',
  'NEW_DEVICE_LOGIN',
]);

@Injectable()
export class SecurityEventRecorder {
  private readonly logger = new Logger(SecurityEventRecorder.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly threats: SecurityThreatService,
  ) {}

  /** Never throws. Security monitoring must not block sign-in or business writes. */
  async capture(input: SecurityCaptureInput): Promise<void> {
    try {
      const eventId = await this.append(input);
      if (!eventId || !INSPECT_TYPES.has(input.eventType)) return;
      void this.threats
        .inspect({ ...input, eventId })
        .catch((error: unknown) => {
          this.logger.warn(
            `Threat inspection skipped: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    } catch (error) {
      this.logger.warn(
        `Security event skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async append(input: SecurityCaptureInput): Promise<string | null> {
    if (!input.tenantId || !input.action || !input.summary) return null;
    const createdAt = new Date();
    const summary = input.summary.slice(0, 300);
    const payloadBase = {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      severity: input.severity ?? 'info',
      module: input.module ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      action: input.action.slice(0, 120),
      ipAddress: input.ipAddress ?? null,
      summary,
      subjectKey: input.subjectKey ?? null,
      createdAt: createdAt.toISOString(),
    } satisfies SecurityHashPayload;

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenantId}, 0))`,
      );
      const previous = await tx.securityEvent.findFirst({
        where: { tenantId: input.tenantId },
        orderBy: { seq: 'desc' },
        select: { recordHash: true },
      });
      const prevHash = previous?.recordHash ?? null;
      const recordHash = hashSecurityRecord(payloadBase, prevHash);
      const row = await tx.securityEvent.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: payloadBase.actorUserId,
          eventType: payloadBase.eventType,
          severity: payloadBase.severity,
          module: payloadBase.module,
          entityType: payloadBase.entityType,
          entityId: payloadBase.entityId,
          action: payloadBase.action,
          ipAddress: payloadBase.ipAddress,
          userAgent: input.userAgent ? input.userAgent.slice(0, 400) : null,
          summary,
          previousValue: redactSecurityValue(input.previousValue) as
            | Prisma.InputJsonValue
            | undefined,
          newValue: redactSecurityValue(input.newValue) as
            | Prisma.InputJsonValue
            | undefined,
          metadata: (redactSecurityValue(input.metadata ?? {}) ??
            {}) as Prisma.InputJsonValue,
          subjectKey: payloadBase.subjectKey,
          prevHash,
          recordHash,
          createdAt,
        },
        select: { id: true },
      });
      return row.id;
    });
  }
}
