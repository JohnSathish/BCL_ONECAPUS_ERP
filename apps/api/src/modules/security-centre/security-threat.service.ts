import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { SecurityCaptureInput } from './domain/security-event.types';
import { evaluateThreats } from './domain/threat-rules';
import { SecurityAlertNotifier } from './security-alert-notifier.service';
import { SecurityPolicyService } from './security-policy.service';

const COOLDOWN_MS = 15 * 60 * 1000;

@Injectable()
export class SecurityThreatService {
  private readonly logger = new Logger(SecurityThreatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SecurityPolicyService,
    private readonly notifier: SecurityAlertNotifier,
  ) {}

  async inspect(input: SecurityCaptureInput & { eventId: string }) {
    const policy = await this.policy.get(input.tenantId);
    const since = new Date(Date.now() - policy.windowMinutes * 60_000);
    const signals = await this.signals(input, since);
    const findings = evaluateThreats({
      eventType: input.eventType,
      policy,
      ...signals,
    });

    for (const finding of findings) {
      const subjectKey = input.subjectKey ?? input.eventType;
      const recent = await this.prisma.securityAlert.findFirst({
        where: {
          tenantId: input.tenantId,
          ruleCode: finding.ruleCode,
          subjectKey,
          createdAt: { gte: new Date(Date.now() - COOLDOWN_MS) },
        },
        select: { id: true },
      });
      if (recent) continue;

      const alert = await this.prisma.securityAlert.create({
        data: {
          tenantId: input.tenantId,
          ruleCode: finding.ruleCode,
          severity: finding.severity,
          title: finding.title,
          summary: finding.summary,
          subjectKey,
          sourceEventId: input.eventId,
          metadata: {
            eventType: input.eventType,
          } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      try {
        await this.notifier.notify({
          tenantId: input.tenantId,
          alertId: alert.id,
          finding,
          policy,
          detectedAt: new Date(),
          ipAddress: input.ipAddress,
          actorUserId: input.actorUserId,
          account: metaText(input.metadata, 'identifier'),
          lockExpiresAt: metaDate(input.metadata, 'lockedUntil'),
        });
        await this.prisma.securityAlert.update({
          where: { id: alert.id },
          data: { notifiedAt: new Date() },
        });
      } catch (error) {
        this.logger.warn(
          `Alert notification failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async signals(
    input: SecurityCaptureInput,
    since: Date,
  ): Promise<{
    recentFailedLogins: number;
    distinctFailedIdentifiersOnIp: number;
    recentUnauthorized: number;
    recentDownloads: number;
    recentMutations: number;
  }> {
    const tenantId = input.tenantId;
    const [
      recentFailedLogins,
      recentUnauthorized,
      recentDownloads,
      recentMutations,
      ipFailures,
    ] = await Promise.all([
      input.subjectKey
        ? this.prisma.securityEvent.count({
            where: {
              tenantId,
              eventType: 'LOGIN_FAILED',
              subjectKey: input.subjectKey,
              createdAt: { gte: since },
            },
          })
        : Promise.resolve(0),
      this.prisma.securityEvent.count({
        where: {
          tenantId,
          eventType: 'UNAUTHORIZED_API',
          createdAt: { gte: since },
          ...(input.subjectKey ? { subjectKey: input.subjectKey } : {}),
        },
      }),
      this.prisma.securityEvent.count({
        where: {
          tenantId,
          eventType: 'BULK_DOWNLOAD',
          createdAt: { gte: since },
        },
      }),
      this.prisma.securityEvent.count({
        where: {
          tenantId,
          eventType: 'DATA_CHANGE',
          createdAt: { gte: since },
        },
      }),
      input.ipAddress
        ? this.prisma.securityEvent.findMany({
            where: {
              tenantId,
              eventType: 'LOGIN_FAILED',
              ipAddress: input.ipAddress,
              createdAt: { gte: since },
            },
            select: { metadata: true },
            take: 200,
          })
        : Promise.resolve([]),
    ]);

    const identifiers = new Set<string>();
    for (const row of ipFailures) {
      const metadata = row.metadata as { identifier?: string } | null;
      if (metadata?.identifier) identifiers.add(metadata.identifier);
    }

    return {
      recentFailedLogins,
      distinctFailedIdentifiersOnIp: identifiers.size,
      recentUnauthorized,
      recentDownloads,
      recentMutations,
    };
  }
}

function metaText(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function metaDate(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = metaText(metadata, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
