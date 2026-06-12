import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../admin-audit.helper';
import type {
  ListLoginHistoryQueryDto,
  ListSessionsQueryDto,
  UpdateSecuritySettingsDto,
} from '../dto/security.dto';

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
  ) {}

  async getSettings(tenantId: string) {
    let settings = await this.prisma.tenantSecuritySettings.findUnique({
      where: { tenantId },
    });
    if (!settings) {
      settings = await this.prisma.tenantSecuritySettings.create({
        data: { tenantId },
      });
    }
    return settings;
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateSecuritySettingsDto,
    actorUserId: string,
  ) {
    const settings = await this.prisma.tenantSecuritySettings.upsert({
      where: { tenantId },
      update: {
        minPasswordLength: dto.minPasswordLength,
        passwordExpiryDays: dto.passwordExpiryDays,
        passwordHistoryCount: dto.passwordHistoryCount,
        forceResetOnFirstLogin: dto.forceResetOnFirstLogin,
        sessionTimeoutMinutes: dto.sessionTimeoutMinutes,
        mfaEnforced: dto.mfaEnforced,
      },
      create: {
        tenantId,
        ...dto,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'security.settings_updated',
      entityType: 'tenant_security_settings',
      entityId: settings.id,
    });

    return settings;
  }

  async listActiveSessions(tenantId: string, query: ListSessionsQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '25', 10) || 25),
    );
    const skip = (page - 1) * limit;
    const now = new Date();

    const where = {
      tenantId,
      revokedAt: null,
      expiresAt: { gt: now },
      ...(query.search?.trim()
        ? {
            user: {
              email: {
                contains: query.search.trim(),
                mode: 'insensitive' as const,
              },
            },
          }
        : {}),
    };

    const [total, sessions] = await Promise.all([
      this.prisma.refreshSession.count({ where }),
      this.prisma.refreshSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              username: true,
            },
          },
        },
      }),
    ]);

    return {
      items: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        user: s.user,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        device: this.parseDevice(s.userAgent),
        browser: this.parseBrowser(s.userAgent),
        loginAt: s.createdAt,
        expiresAt: s.expiresAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async revokeSession(
    tenantId: string,
    sessionId: string,
    actorUserId: string,
  ) {
    const session = await this.prisma.refreshSession.findFirst({
      where: { id: sessionId, tenantId, revokedAt: null },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.prisma.refreshSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'session.revoked',
      entityType: 'refresh_session',
      entityId: sessionId,
      metadata: { targetUserId: session.userId },
    });

    return { ok: true };
  }

  async revokeAllUserSessions(
    tenantId: string,
    userId: string,
    actorUserId: string,
  ) {
    const result = await this.prisma.refreshSession.updateMany({
      where: { tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'session.revoked_all',
      entityType: 'user',
      entityId: userId,
      metadata: { count: result.count },
    });

    return { count: result.count };
  }

  async listLoginHistory(tenantId: string, query: ListLoginHistoryQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '25', 10) || 25),
    );
    const skip = (page - 1) * limit;

    const auditWhere = {
      tenantId,
      action: { in: ['auth.login', 'auth.logout'] },
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [auditTotal, auditLogs] = await Promise.all([
      this.prisma.auditLog.count({ where: auditWhere }),
      this.prisma.auditLog.findMany({
        where: auditWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
        },
      }),
    ]);

    const failedAttempts = await this.prisma.loginAttempt.findMany({
      where: {
        tenantId,
        failedCount: { gt: 0 },
        ...(query.search?.trim()
          ? { email: { contains: query.search.trim(), mode: 'insensitive' } }
          : {}),
      },
      orderBy: { lastAttemptAt: 'desc' },
      take: 20,
    });

    return {
      items: auditLogs.map((l) => ({
        id: l.id,
        type: l.action === 'auth.login' ? 'success' : 'logout',
        email: l.user?.email,
        user: l.user,
        ipAddress: (l.metadata as { ipAddress?: string })?.ipAddress ?? null,
        createdAt: l.createdAt,
      })),
      failedAttempts: failedAttempts.map((a) => ({
        email: a.email,
        ipAddress: a.ipAddress,
        failedCount: a.failedCount,
        lockedUntil: a.lockedUntil,
        lastAttemptAt: a.lastAttemptAt,
      })),
      total: auditTotal,
      page,
      limit,
      totalPages: Math.ceil(auditTotal / limit),
    };
  }

  private parseDevice(ua?: string | null): string {
    if (!ua) return 'Unknown';
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet/i.test(ua)) return 'Tablet';
    return 'Desktop';
  }

  private parseBrowser(ua?: string | null): string {
    if (!ua) return 'Unknown';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  }
}
