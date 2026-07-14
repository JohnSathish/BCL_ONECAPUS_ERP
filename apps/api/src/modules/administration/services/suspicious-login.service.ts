import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export type SuspiciousLoginContext = {
  accessDeviceId?: string | null;
  isNewDevice?: boolean;
  country?: string | null;
  browserName?: string | null;
  clientType?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class SuspiciousLoginService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(
    tenantId: string,
    userId: string,
    context: SuspiciousLoginContext = {},
  ): Promise<string[]> {
    const flags: string[] = [];
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since1h = new Date(now.getTime() - 60 * 60 * 1000);

    const settings = await this.prisma.tenantSecuritySettings.findUnique({
      where: { tenantId },
    });
    const maxFailed = settings?.maxFailedBeforeFlag ?? 5;

    if (context.isNewDevice) {
      flags.push('NEW_DEVICE');
    } else if (context.accessDeviceId) {
      const device = await this.prisma.accessDevice.findFirst({
        where: { id: context.accessDeviceId, tenantId, userId },
        select: { firstSeenAt: true, loginCount: true },
      });
      if (
        device &&
        device.loginCount <= 1 &&
        now.getTime() - device.firstSeenAt.getTime() < 10 * 60 * 1000
      ) {
        flags.push('NEW_DEVICE');
      }
    }

    if (context.country && settings?.alertOnNewCountry !== false) {
      const priorCountry = await this.prisma.accessDevice.findFirst({
        where: {
          tenantId,
          userId,
          lastCountry: { not: null },
          ...(context.accessDeviceId
            ? { id: { not: context.accessDeviceId } }
            : {}),
        },
        orderBy: { lastSeenAt: 'desc' },
        select: { lastCountry: true },
      });
      if (
        priorCountry?.lastCountry &&
        priorCountry.lastCountry !== context.country
      ) {
        flags.push('NEW_COUNTRY');
      }
    }

    const activeSessions = await this.prisma.refreshSession.count({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (activeSessions >= 3) {
      flags.push('MULTI_DEVICE');
    }

    const failedRecent = await this.prisma.authLoginEvent.count({
      where: {
        tenantId,
        userId,
        outcome: { in: ['failure', 'lockout'] },
        createdAt: { gte: since24h },
      },
    });
    if (failedRecent >= maxFailed) {
      flags.push('EXCESS_FAILED');
    }

    const rapidAttempts = await this.prisma.authLoginEvent.count({
      where: {
        tenantId,
        userId,
        createdAt: { gte: since1h },
      },
    });
    if (rapidAttempts >= 8) {
      flags.push('RAPID_ATTEMPTS');
    }

    if (context.browserName) {
      const otherBrowsers = await this.prisma.accessDevice.count({
        where: {
          tenantId,
          userId,
          status: { not: 'BLOCKED' },
          browserName: { not: null },
          NOT: { browserName: context.browserName },
          lastSeenAt: { gte: since24h },
        },
      });
      if (otherBrowsers >= 2) {
        flags.push('MULTI_BROWSER');
      }
    }

    return [...new Set(flags)];
  }
}
