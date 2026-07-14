import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AdminAuditHelper } from '../admin-audit.helper';
import type {
  ListDeviceSessionsQueryDto,
  ListDevicesQueryDto,
  ListLoginHistoryQueryDto,
  ReportQueryDto,
  UpdateDevicePoliciesDto,
} from '../dto/device-security.dto';
import { AccessDeviceService } from './access-device.service';
import { SecurityService } from './security.service';
import { SecurityNotifyService } from './security-notify.service';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function localDayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeOs(raw?: string | null): string {
  const v = (raw || '').trim();
  if (!v) return 'Unknown';
  const lower = v.toLowerCase();
  if (
    lower === 'win32' ||
    lower === 'win64' ||
    lower.startsWith('windows') ||
    lower.includes('windows nt')
  ) {
    return 'Windows';
  }
  if (
    lower === 'macintel' ||
    lower === 'macintosh' ||
    lower === 'darwin' ||
    lower.includes('mac os')
  ) {
    return 'macOS';
  }
  if (lower.includes('android')) return 'Android';
  if (
    lower.includes('iphone') ||
    lower.includes('ipad') ||
    lower === 'ios' ||
    lower.includes('ios')
  ) {
    return 'iOS';
  }
  if (lower.includes('chrome os') || lower === 'cros') return 'Chrome OS';
  if (lower.includes('linux') || lower === 'x11') return 'Linux';
  return v;
}

function normalizeBrowser(raw?: string | null): string {
  const v = (raw || '').trim();
  if (!v) return 'Unknown';
  const lower = v.toLowerCase();
  if (lower.includes('edg')) return 'Edge';
  if (lower.includes('chrome') && !lower.includes('chromium')) return 'Chrome';
  if (lower.includes('firefox') || lower.includes('fxios')) return 'Firefox';
  if (lower.includes('safari') && !lower.includes('chrome')) return 'Safari';
  if (lower.includes('opera') || lower.includes('opr')) return 'Opera';
  if (lower.includes('samsung')) return 'Samsung Internet';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function normalizeDeviceType(raw?: string | null): string {
  const v = (raw || '').trim();
  if (!v) return 'Unknown';
  const key = v.toUpperCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    DESKTOP: 'Desktop',
    MOBILE: 'Mobile',
    TABLET: 'Tablet',
    WEB: 'Web',
    ANDROID: 'Mobile',
    IOS: 'Mobile',
    UNKNOWN: 'Unknown',
  };
  if (map[key]) return map[key];
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function formatClientIp(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (v.startsWith('::ffff:')) return v.slice(7);
  if (v === '::1') return '127.0.0.1';
  return v;
}

@Injectable()
export class DeviceSecurityService {
  private readonly logger = new Logger(DeviceSecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditHelper,
    private readonly devices: AccessDeviceService,
    private readonly security: SecurityService,
    private readonly notify: SecurityNotifyService,
  ) {}

  async dashboard(tenantId: string) {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const since14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS);

    const activeWhere = {
      tenantId,
      revokedAt: null,
      expiresAt: { gt: now },
    } as const;

    const [
      todaysLogins,
      failedLoginsToday,
      blockedDevices,
      trustedDevices,
      newDevicesDetected,
      lockedAccounts,
      recentSessions,
      loginEvents14d,
      devices,
      recentSuspicious,
    ] = await Promise.all([
      this.prisma.authLoginEvent.count({
        where: {
          tenantId,
          outcome: 'success',
          createdAt: { gte: startOfToday },
        },
      }),
      this.prisma.authLoginEvent.count({
        where: {
          tenantId,
          outcome: { in: ['failure', 'lockout'] },
          createdAt: { gte: startOfToday },
        },
      }),
      this.prisma.accessDevice.count({
        where: { tenantId, status: 'BLOCKED' },
      }),
      this.prisma.accessDevice.count({
        where: { tenantId, status: 'TRUSTED' },
      }),
      this.prisma.accessDevice.count({
        where: { tenantId, firstSeenAt: { gte: startOfToday } },
      }),
      this.prisma.loginAttempt.count({
        where: { tenantId, lockedUntil: { gt: now } },
      }),
      this.prisma.refreshSession.findMany({
        where: activeWhere,
        select: { userId: true, updatedAt: true, metadata: true },
      }),
      this.prisma.authLoginEvent.findMany({
        where: {
          tenantId,
          outcome: 'success',
          createdAt: { gte: since14d },
        },
        select: {
          createdAt: true,
          userAgent: true,
          metadata: true,
        },
      }),
      this.prisma.accessDevice.findMany({
        where: { tenantId },
        select: {
          clientType: true,
          browserName: true,
          platform: true,
          deviceType: true,
        },
      }),
      this.prisma.authLoginEvent.findMany({
        where: {
          tenantId,
          createdAt: { gte: since14d },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
        },
      }),
    ]);

    const activeSessions = recentSessions.length;
    let webSessions = 0;
    let mobileSessions = 0;
    const onlineUserIds = new Set<string>();
    for (const s of recentSessions) {
      const meta = (s.metadata ?? {}) as {
        lastActivityAt?: string;
        clientType?: string;
      };
      const ct = (meta.clientType ?? '').toUpperCase();
      if (ct === 'MOBILE' || ct === 'ANDROID') mobileSessions += 1;
      else webSessions += 1;
      const last = meta.lastActivityAt
        ? new Date(meta.lastActivityAt)
        : s.updatedAt;
      if (last.getTime() >= onlineSince.getTime()) {
        onlineUserIds.add(s.userId);
      }
    }

    const dailyMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dailyMap.set(localDayKey(d), 0);
    }
    const hourCounts = Array.from({ length: 24 }, () => 0);
    for (const ev of loginEvents14d) {
      const day = localDayKey(ev.createdAt);
      if (dailyMap.has(day)) dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
      hourCounts[ev.createdAt.getHours()] += 1;
    }

    const countBy = (items: (string | null | undefined)[]) => {
      const map = new Map<string, number>();
      for (const raw of items) {
        const key = (raw || 'Unknown').trim() || 'Unknown';
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
    };

    const recentAlerts = recentSuspicious
      .map((ev) => {
        const meta = (ev.metadata ?? {}) as {
          suspiciousFlags?: string[];
          accessDeviceId?: string;
        };
        const flags = Array.isArray(meta.suspiciousFlags)
          ? meta.suspiciousFlags
          : [];
        if (!flags.length) return null;
        return {
          id: ev.id,
          userId: ev.userId,
          user: ev.user,
          identifier: ev.identifier,
          outcome: ev.outcome,
          flags,
          accessDeviceId: meta.accessDeviceId ?? null,
          ipAddress: formatClientIp(ev.ipAddress),
          createdAt: ev.createdAt,
        };
      })
      .filter(Boolean)
      .slice(0, 25);

    const loginAttemptsToday = todaysLogins + failedLoginsToday;
    const successRate =
      loginAttemptsToday > 0
        ? Math.round((todaysLogins / loginAttemptsToday) * 100)
        : 100;

    return {
      kpis: {
        activeSessions,
        webSessions,
        mobileSessions,
        onlineUsers: onlineUserIds.size,
        todaysLogins,
        failedLoginsToday,
        blockedDevices,
        trustedDevices,
        lockedAccounts,
        newDevicesDetected,
        successRate,
      },
      charts: {
        dailyLoginTrend: [...dailyMap.entries()].map(([date, count]) => ({
          date,
          count,
        })),
        deviceDistribution: countBy(
          devices.map((d) => normalizeDeviceType(d.deviceType || d.clientType)),
        ),
        browserDistribution: countBy(
          devices.map((d) => normalizeBrowser(d.browserName)),
        ),
        osDistribution: countBy(devices.map((d) => normalizeOs(d.platform))),
        loginByHour: hourCounts.map((count, hour) => ({ hour, count })),
      },
      recentAlerts,
    };
  }

  async listSessions(tenantId: string, query: ListDeviceSessionsQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '25', 10) || 25),
    );
    const skip = (page - 1) * limit;
    const now = new Date();
    const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS);

    const where: Prisma.RefreshSessionWhereInput = {
      tenantId,
      revokedAt: null,
      expiresAt: { gt: now },
      ...(query.search?.trim()
        ? {
            user: {
              OR: [
                {
                  email: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
                {
                  displayName: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
                {
                  username: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }
        : {}),
      ...(query.clientType
        ? {
            metadata: {
              path: ['clientType'],
              equals: query.clientType,
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
        orderBy: { updatedAt: 'desc' },
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

    const deviceIds = [
      ...new Set(
        sessions
          .map((s) => {
            const meta = (s.metadata ?? {}) as { accessDeviceId?: string };
            return meta.accessDeviceId;
          })
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const deviceRows = deviceIds.length
      ? await this.prisma.accessDevice.findMany({
          where: { tenantId, id: { in: deviceIds } },
        })
      : [];
    const deviceMap = new Map(deviceRows.map((d) => [d.id, d]));

    const items = sessions.map((s) => {
      const meta = (s.metadata ?? {}) as {
        accessDeviceId?: string;
        lastActivityAt?: string;
        clientType?: string;
        deviceLabel?: string;
        deviceId?: string;
      };
      const accessDevice = meta.accessDeviceId
        ? (deviceMap.get(meta.accessDeviceId) ?? null)
        : null;
      const lastActivity = meta.lastActivityAt
        ? new Date(meta.lastActivityAt)
        : s.updatedAt;
      const status =
        lastActivity.getTime() >= onlineSince.getTime() ? 'Online' : 'Idle';
      return {
        id: s.id,
        userId: s.userId,
        user: s.user,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        device: accessDevice?.deviceName ?? this.parseDevice(s.userAgent),
        browser: accessDevice?.browserName ?? this.parseBrowser(s.userAgent),
        clientType:
          meta.clientType ??
          accessDevice?.clientType ??
          (s.userAgent && /mobile/i.test(s.userAgent) ? 'MOBILE' : 'WEB'),
        accessDevice,
        loginAt: s.createdAt,
        lastActivity,
        expiresAt: s.expiresAt,
        status,
      };
    });

    const filtered =
      query.status === 'Online' || query.status === 'Idle'
        ? items.filter((i) => i.status === query.status)
        : items;

    return {
      items: filtered,
      total: query.status ? filtered.length : total,
      page,
      limit,
      totalPages: Math.ceil((query.status ? filtered.length : total) / limit),
    };
  }

  async revokeSession(
    tenantId: string,
    sessionId: string,
    actorUserId: string,
  ) {
    const result = await this.security.revokeSession(
      tenantId,
      sessionId,
      actorUserId,
    );
    const session = await this.prisma.refreshSession.findFirst({
      where: { id: sessionId, tenantId },
      select: { userId: true },
    });
    if (session?.userId) {
      const settings = await this.security.getSettings(tenantId);
      await this.notify.notify({
        tenantId,
        userId: session.userId,
        templateCode: 'SECURITY_FORCE_LOGOUT',
        triggerKey: `security.force_logout.${sessionId}`,
        entityType: 'refresh_session',
        entityId: sessionId,
        variables: {
          reason: 'An administrator ended this session.',
        },
        enabled:
          settings.notifyEmailOnSecurity || settings.notifyPushOnSecurity,
        channels: [
          ...(settings.notifyEmailOnSecurity ? (['EMAIL'] as const) : []),
          'IN_APP',
          ...(settings.notifyPushOnSecurity ? (['PUSH'] as const) : []),
        ],
      });
    }
    return result;
  }

  async revokeAllUserSessions(
    tenantId: string,
    userId: string,
    actorUserId: string,
  ) {
    const result = await this.security.revokeAllUserSessions(
      tenantId,
      userId,
      actorUserId,
    );
    const settings = await this.security.getSettings(tenantId);
    await this.notify.notify({
      tenantId,
      userId,
      templateCode: 'SECURITY_FORCE_LOGOUT',
      triggerKey: `security.force_logout_all.${userId}.${Date.now()}`,
      entityType: 'user',
      entityId: userId,
      variables: {
        reason: 'An administrator ended all of your sessions.',
      },
      enabled: settings.notifyEmailOnSecurity || settings.notifyPushOnSecurity,
      channels: [
        ...(settings.notifyEmailOnSecurity ? (['EMAIL'] as const) : []),
        'IN_APP',
        ...(settings.notifyPushOnSecurity ? (['PUSH'] as const) : []),
      ],
    });
    return result;
  }

  async listLoginHistory(tenantId: string, query: ListLoginHistoryQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '25', 10) || 25),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.AuthLoginEventWhereInput = {
      tenantId,
      ...(query.outcome ? { outcome: query.outcome } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                identifier: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                user: {
                  email: {
                    contains: query.search.trim(),
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.authLoginEvent.count({ where }),
      this.prisma.authLoginEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((ev) => {
        const meta = (ev.metadata ?? {}) as Record<string, unknown>;
        return {
          id: ev.id,
          userId: ev.userId,
          user: ev.user,
          identifier: ev.identifier,
          method: ev.method,
          outcome: ev.outcome,
          reason: ev.reason,
          ipAddress: ev.ipAddress,
          userAgent: ev.userAgent,
          accessDeviceId: (meta.accessDeviceId as string) ?? null,
          suspiciousFlags: Array.isArray(meta.suspiciousFlags)
            ? (meta.suspiciousFlags as string[])
            : [],
          country: (meta.country as string) ?? null,
          clientType: (meta.clientType as string) ?? null,
          createdAt: ev.createdAt,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listFailedLogins(tenantId: string, query: ListLoginHistoryQueryDto) {
    return this.listLoginHistory(tenantId, {
      ...query,
      outcome: 'failure',
    });
  }

  async listDevices(tenantId: string, query: ListDevicesQueryDto) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(query.limit ?? '25', 10) || 25),
    );
    const skip = (page - 1) * limit;

    const where: Prisma.AccessDeviceWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientType ? { clientType: query.clientType } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                deviceName: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                browserName: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                platform: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                lastIpMasked: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                user: {
                  OR: [
                    {
                      email: {
                        contains: query.search.trim(),
                        mode: 'insensitive',
                      },
                    },
                    {
                      displayName: {
                        contains: query.search.trim(),
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.accessDevice.count({ where }),
      this.prisma.accessDevice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastSeenAt: 'desc' },
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
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDevice(tenantId: string, id: string) {
    const device = await this.devices.getById(tenantId, id);
    const timeline = await this.prisma.authLoginEvent.findMany({
      where: {
        tenantId,
        metadata: { path: ['accessDeviceId'], equals: id },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });
    const activeSessions = await this.prisma.refreshSession.findMany({
      where: {
        tenantId,
        userId: device.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        metadata: { path: ['accessDeviceId'], equals: id },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
    return { device, timeline, activeSessions };
  }

  async blockDevice(
    tenantId: string,
    id: string,
    actorUserId: string,
    reason?: string,
  ) {
    const updated = await this.devices.block(tenantId, id, actorUserId, reason);
    await this.prisma.refreshSession.updateMany({
      where: {
        tenantId,
        userId: updated.userId,
        revokedAt: null,
        metadata: { path: ['accessDeviceId'], equals: id },
      },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'device.blocked',
      entityType: 'access_device',
      entityId: id,
      metadata: { reason: reason ?? null, targetUserId: updated.userId },
    });
    const settings = await this.security.getSettings(tenantId);
    await this.notify.notify({
      tenantId,
      userId: updated.userId,
      templateCode: 'SECURITY_DEVICE_BLOCKED',
      triggerKey: `security.device_blocked.${id}`,
      entityType: 'access_device',
      entityId: id,
      variables: {
        device_name: updated.deviceName ?? 'Unknown device',
        reason: reason ?? 'Blocked by administrator',
      },
      enabled: settings.notifyEmailOnSecurity || settings.notifyPushOnSecurity,
      channels: [
        ...(settings.notifyEmailOnSecurity ? (['EMAIL'] as const) : []),
        'IN_APP',
        ...(settings.notifyPushOnSecurity ? (['PUSH'] as const) : []),
      ],
    });
    return updated;
  }

  async unblockDevice(tenantId: string, id: string, actorUserId: string) {
    const updated = await this.devices.unblock(tenantId, id);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'device.unblocked',
      entityType: 'access_device',
      entityId: id,
      metadata: { targetUserId: updated.userId },
    });
    return updated;
  }

  async trustDevice(tenantId: string, id: string, actorUserId: string) {
    const updated = await this.devices.trust(tenantId, id);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'device.trusted',
      entityType: 'access_device',
      entityId: id,
      metadata: { targetUserId: updated.userId },
    });
    return updated;
  }

  async clearTrusted(tenantId: string, userId: string, actorUserId: string) {
    const result = await this.devices.clearTrustedForUser(tenantId, userId);
    await this.audit.log({
      tenantId,
      userId: actorUserId,
      module: 'administration',
      action: 'device.trusted_cleared',
      entityType: 'user',
      entityId: userId,
      metadata: { cleared: result.cleared },
    });
    return result;
  }

  async getPolicies(tenantId: string) {
    return this.security.getSettings(tenantId);
  }

  async updatePolicies(
    tenantId: string,
    dto: UpdateDevicePoliciesDto,
    actorUserId: string,
  ) {
    const settings = await this.prisma.tenantSecuritySettings.upsert({
      where: { tenantId },
      update: {
        ...(dto.minPasswordLength !== undefined
          ? { minPasswordLength: dto.minPasswordLength }
          : {}),
        ...(dto.passwordExpiryDays !== undefined
          ? { passwordExpiryDays: dto.passwordExpiryDays }
          : {}),
        ...(dto.passwordHistoryCount !== undefined
          ? { passwordHistoryCount: dto.passwordHistoryCount }
          : {}),
        ...(dto.forceResetOnFirstLogin !== undefined
          ? { forceResetOnFirstLogin: dto.forceResetOnFirstLogin }
          : {}),
        ...(dto.sessionTimeoutMinutes !== undefined
          ? { sessionTimeoutMinutes: dto.sessionTimeoutMinutes }
          : {}),
        ...(dto.mfaEnforced !== undefined
          ? { mfaEnforced: dto.mfaEnforced }
          : {}),
        ...(dto.allowBiometricLogin !== undefined
          ? { allowBiometricLogin: dto.allowBiometricLogin }
          : {}),
        ...(dto.allowQrLogin !== undefined
          ? { allowQrLogin: dto.allowQrLogin }
          : {}),
        ...(dto.allowRfidLogin !== undefined
          ? { allowRfidLogin: dto.allowRfidLogin }
          : {}),
        ...(dto.requireUppercase !== undefined
          ? { requireUppercase: dto.requireUppercase }
          : {}),
        ...(dto.requireLowercase !== undefined
          ? { requireLowercase: dto.requireLowercase }
          : {}),
        ...(dto.requireNumber !== undefined
          ? { requireNumber: dto.requireNumber }
          : {}),
        ...(dto.requireSpecial !== undefined
          ? { requireSpecial: dto.requireSpecial }
          : {}),
        ...(dto.maxConcurrentSessions !== undefined
          ? { maxConcurrentSessions: dto.maxConcurrentSessions }
          : {}),
        ...(dto.alertOnNewDevice !== undefined
          ? { alertOnNewDevice: dto.alertOnNewDevice }
          : {}),
        ...(dto.alertOnNewCountry !== undefined
          ? { alertOnNewCountry: dto.alertOnNewCountry }
          : {}),
        ...(dto.maxFailedBeforeFlag !== undefined
          ? { maxFailedBeforeFlag: dto.maxFailedBeforeFlag }
          : {}),
        ...(dto.blockOnExcessiveFails !== undefined
          ? { blockOnExcessiveFails: dto.blockOnExcessiveFails }
          : {}),
        ...(dto.notifyEmailOnSecurity !== undefined
          ? { notifyEmailOnSecurity: dto.notifyEmailOnSecurity }
          : {}),
        ...(dto.notifyPushOnSecurity !== undefined
          ? { notifyPushOnSecurity: dto.notifyPushOnSecurity }
          : {}),
        ...(dto.allowRememberMe !== undefined
          ? { allowRememberMe: dto.allowRememberMe }
          : {}),
        ...(dto.geoLookupEnabled !== undefined
          ? { geoLookupEnabled: dto.geoLookupEnabled }
          : {}),
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
      action: 'security.device_policies_updated',
      entityType: 'tenant_security_settings',
      entityId: settings.id,
    });

    return settings;
  }

  async exportDevicesCsv(tenantId: string, query: ReportQueryDto) {
    const rows = await this.prisma.accessDevice.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.from || query.to
          ? {
              lastSeenAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        user: { select: { email: true, displayName: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 5000,
    });
    return this.toCsv(
      rows.map((r) => ({
        id: r.id,
        email: r.user.email,
        displayName: r.user.displayName ?? '',
        deviceName: r.deviceName ?? '',
        clientType: r.clientType,
        platform: r.platform ?? '',
        browser: r.browserName ?? '',
        status: r.status,
        lastIp: r.lastIpMasked ?? '',
        country: r.lastCountry ?? '',
        loginCount: r.loginCount,
        firstSeenAt: r.firstSeenAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
      })),
      [
        'id',
        'email',
        'displayName',
        'deviceName',
        'clientType',
        'platform',
        'browser',
        'status',
        'lastIp',
        'country',
        'loginCount',
        'firstSeenAt',
        'lastSeenAt',
      ],
    );
  }

  async exportSessionsCsv(tenantId: string) {
    const now = new Date();
    const rows = await this.prisma.refreshSession.findMany({
      where: { tenantId, revokedAt: null, expiresAt: { gt: now } },
      include: {
        user: { select: { email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return this.toCsv(
      rows.map((r) => {
        const meta = (r.metadata ?? {}) as {
          clientType?: string;
          accessDeviceId?: string;
          lastActivityAt?: string;
        };
        return {
          id: r.id,
          email: r.user.email,
          displayName: r.user.displayName ?? '',
          ipAddress: r.ipAddress ?? '',
          clientType: meta.clientType ?? '',
          accessDeviceId: meta.accessDeviceId ?? '',
          loginAt: r.createdAt.toISOString(),
          lastActivity: meta.lastActivityAt ?? r.updatedAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
        };
      }),
      [
        'id',
        'email',
        'displayName',
        'ipAddress',
        'clientType',
        'accessDeviceId',
        'loginAt',
        'lastActivity',
        'expiresAt',
      ],
    );
  }

  async exportFailedCsv(tenantId: string, query: ReportQueryDto) {
    const rows = await this.prisma.authLoginEvent.findMany({
      where: {
        tenantId,
        outcome: { in: ['failure', 'lockout'] },
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return this.toCsv(
      rows.map((r) => ({
        id: r.id,
        identifier: r.identifier,
        method: r.method,
        outcome: r.outcome,
        reason: r.reason ?? '',
        ipAddress: r.ipAddress ?? '',
        createdAt: r.createdAt.toISOString(),
      })),
      [
        'id',
        'identifier',
        'method',
        'outcome',
        'reason',
        'ipAddress',
        'createdAt',
      ],
    );
  }

  async exportLoginActivityCsv(tenantId: string, query: ReportQueryDto) {
    const rows = await this.prisma.authLoginEvent.findMany({
      where: {
        tenantId,
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        user: { select: { email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return this.toCsv(
      rows.map((r) => {
        const meta = (r.metadata ?? {}) as {
          accessDeviceId?: string;
          suspiciousFlags?: string[];
          country?: string;
        };
        return {
          id: r.id,
          email: r.user?.email ?? '',
          identifier: r.identifier,
          method: r.method,
          outcome: r.outcome,
          reason: r.reason ?? '',
          ipAddress: r.ipAddress ?? '',
          country: meta.country ?? '',
          accessDeviceId: meta.accessDeviceId ?? '',
          flags: Array.isArray(meta.suspiciousFlags)
            ? meta.suspiciousFlags.join('|')
            : '',
          createdAt: r.createdAt.toISOString(),
        };
      }),
      [
        'id',
        'email',
        'identifier',
        'method',
        'outcome',
        'reason',
        'ipAddress',
        'country',
        'accessDeviceId',
        'flags',
        'createdAt',
      ],
    );
  }

  private toCsv(
    rows: Record<string, string | number | boolean | null | undefined>[],
    columns: string[],
  ) {
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [columns.join(',')];
    for (const row of rows) {
      lines.push(columns.map((c) => escape(row[c])).join(','));
    }
    return lines.join('\n');
  }

  private parseDevice(ua?: string | null): string {
    if (!ua) return 'Unknown';
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet/i.test(ua)) return 'Tablet';
    return 'Desktop';
  }

  private parseBrowser(ua?: string | null): string {
    if (!ua) return 'Unknown';
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    return 'Other';
  }
}
