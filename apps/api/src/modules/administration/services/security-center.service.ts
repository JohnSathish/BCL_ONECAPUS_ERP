import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SecurityCenterService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      failedLogins24h,
      activeSessions,
      permissionDenials7d,
      latestBackup,
      recentLogins,
      lockedAccounts,
    ] = await Promise.all([
      this.prisma.loginAttempt.count({
        where: {
          tenantId,
          failedCount: { gt: 0 },
          lastAttemptAt: { gte: since24h },
        },
      }),
      this.prisma.refreshSession.count({
        where: {
          tenantId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.permissionAuditLog.count({
        where: { tenantId, createdAt: { gte: since7d }, outcome: 'denied' },
      }),
      this.prisma.backupRun.findFirst({
        where: { status: 'SUCCESS', scope: 'INSTANCE' },
        orderBy: { completedAt: 'desc' },
        select: {
          id: true,
          completedAt: true,
          sizeBytes: true,
          type: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          tenantId,
          action: 'auth.login',
          createdAt: { gte: since24h },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { email: true, displayName: true } },
        },
      }),
      this.prisma.loginAttempt.findMany({
        where: {
          tenantId,
          lockedUntil: { gt: new Date() },
        },
        orderBy: { lastAttemptAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      failedLogins24h,
      activeSessions,
      permissionDenials7d,
      backup: {
        lastSuccessAt: latestBackup?.completedAt ?? null,
        lastRunId: latestBackup?.id ?? null,
        sizeBytes: latestBackup?.sizeBytes?.toString() ?? null,
        encryptionConfigured: Boolean(process.env.BACKUP_ENCRYPTION_KEY),
      },
      ssl: {
        httpsEnforced: process.env.NODE_ENV === 'production',
        hstsEnabled: true,
      },
      recentLogins: recentLogins.map((l) => ({
        id: l.id,
        email: l.user?.email,
        at: l.createdAt,
        ipAddress: (l.metadata as { ipAddress?: string })?.ipAddress,
        country: (l.metadata as { country?: string })?.country,
      })),
      lockedAccounts,
      lastRbacAuditRecommendation:
        'Run: npx tsx scripts/security/audit-rbac-endpoints.ts',
    };
  }
}
