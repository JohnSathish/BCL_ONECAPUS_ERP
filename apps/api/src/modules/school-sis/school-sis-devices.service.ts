import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { SchoolSisService } from './school-sis.service';

const ONLINE_MS = 15 * 60_000;
const RECENT_MS = 24 * 60 * 60_000;
const INACTIVE_MS = 30 * 24 * 60 * 60_000;

export const DEVICE_REASONS = [
  'Lost device',
  'Device replaced',
  'Security concern',
  'User requested logout',
  'Account issue',
  'Unauthorized device',
  'Other',
] as const;

function has(user: JwtUser, slug: string) {
  const p = user.permissions ?? [];
  return p.includes('*') || p.includes('school-sis:manage') || p.includes(slug);
}

@Injectable()
export class SchoolSisDevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sis: SchoolSisService,
  ) {}

  async overview(tenantId: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const now = Date.now();
    const [total, active, revoked, blocked, android, ios, failed] =
      await Promise.all([
        this.prisma.schoolMobileDevice.count({ where: { tenantId } }),
        this.prisma.schoolMobileDevice.count({
          where: { tenantId, deviceStatus: 'ACTIVE', revokedAt: null },
        }),
        this.prisma.schoolMobileDevice.count({
          where: {
            tenantId,
            OR: [{ deviceStatus: 'REVOKED' }, { revokedAt: { not: null } }],
          },
        }),
        this.prisma.schoolMobileDevice.count({
          where: { tenantId, deviceStatus: 'BLOCKED' },
        }),
        this.prisma.schoolMobileDevice.count({
          where: { tenantId, platform: { in: ['android', 'ANDROID'] } },
        }),
        this.prisma.schoolMobileDevice.count({
          where: { tenantId, platform: { in: ['ios', 'IOS'] } },
        }),
        this.prisma.schoolAuthEvent.count({
          where: {
            tenantId,
            event: 'LOGIN_FAILED',
            createdAt: { gte: new Date(now - RECENT_MS) },
          },
        }),
      ]);
    const online = await this.prisma.schoolMobileDevice.count({
      where: {
        tenantId,
        revokedAt: null,
        deviceStatus: { notIn: ['REVOKED', 'BLOCKED'] },
        lastActiveAt: { gte: new Date(now - ONLINE_MS) },
      },
    });
    const inactive = await this.prisma.schoolMobileDevice.count({
      where: {
        tenantId,
        deviceStatus: { notIn: ['REVOKED', 'BLOCKED'] },
        lastActiveAt: { lt: new Date(now - INACTIVE_MS) },
      },
    });
    return {
      total,
      active,
      online,
      inactive,
      revoked,
      blocked,
      android,
      ios,
      failedAuth: failed,
    };
  }

  async list(
    tenantId: string,
    actor: JwtUser,
    q: {
      search?: string;
      persona?: string;
      platform?: string;
      status?: string;
      session?: string;
      appVersion?: string;
      lastActive?: string;
      security?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(10, q.limit ?? 25));
    const where: Prisma.SchoolMobileDeviceWhereInput = { tenantId };
    if (q.persona) where.persona = q.persona;
    if (q.platform)
      where.platform = { equals: q.platform, mode: 'insensitive' };
    if (q.appVersion) where.appVersion = q.appVersion;
    const now = Date.now();
    if (q.status === 'active')
      Object.assign(where, { deviceStatus: 'ACTIVE', revokedAt: null });
    else if (q.status === 'revoked')
      Object.assign(where, {
        OR: [{ deviceStatus: 'REVOKED' }, { revokedAt: { not: null } }],
      });
    else if (q.status === 'blocked') where.deviceStatus = 'BLOCKED';
    else if (q.status === 'inactive')
      Object.assign(where, {
        deviceStatus: { notIn: ['REVOKED', 'BLOCKED'] },
        lastActiveAt: { lt: new Date(now - INACTIVE_MS) },
      });
    else if (q.status === 'signed_out') where.deviceStatus = 'SIGNED_OUT';
    else if (q.status === 'flagged') where.flaggedAt = { not: null };

    if (q.session === 'online')
      where.lastActiveAt = { gte: new Date(now - ONLINE_MS) };
    else if (q.session === 'recent')
      where.lastActiveAt = { gte: new Date(now - RECENT_MS) };
    else if (q.session === 'expired')
      where.lastActiveAt = { lt: new Date(now - RECENT_MS) };
    else if (q.session === 'logged_out') where.deviceStatus = 'SIGNED_OUT';

    if (q.lastActive === 'today')
      where.lastActiveAt = { gte: new Date(now - RECENT_MS) };
    else if (q.lastActive === '7d')
      where.lastActiveAt = { gte: new Date(now - 7 * RECENT_MS) };
    else if (q.lastActive === '30d')
      where.lastActiveAt = { gte: new Date(now - INACTIVE_MS) };
    else if (q.lastActive === '30d_plus')
      where.lastActiveAt = { lt: new Date(now - INACTIVE_MS) };

    if (q.security === 'failed') where.failedAuthCount = { gte: 5 };
    else if (q.security === 'flagged') where.flaggedAt = { not: null };

    if (q.search?.trim()) {
      const userIds = await this.searchUserIds(tenantId, q.search.trim());
      const term = q.search.trim();
      where.OR = [
        { deviceId: { contains: term, mode: 'insensitive' } },
        { deviceModel: { contains: term, mode: 'insensitive' } },
        { deviceLabel: { contains: term, mode: 'insensitive' } },
        { manufacturer: { contains: term, mode: 'insensitive' } },
        ...(has(actor, 'devices.view_ip')
          ? [{ lastIpAddress: { contains: term, mode: 'insensitive' } }]
          : []),
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
      ];
    }

    if (q.security === 'multi') {
      const grouped = await this.prisma.schoolMobileDevice.groupBy({
        by: ['userId'],
        where: { tenantId, deviceStatus: 'ACTIVE', revokedAt: null },
        _count: { userId: true },
        having: { userId: { _count: { gt: 1 } } },
      });
      where.userId = { in: grouped.map((g) => g.userId) };
    }

    const [total, rows] = await Promise.all([
      this.prisma.schoolMobileDevice.count({ where }),
      this.prisma.schoolMobileDevice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { lastActiveAt: 'desc' },
      }),
    ]);
    const people = await this.peopleForUsers(
      tenantId,
      rows.map((r) => r.userId),
    );
    const showIp = has(actor, 'devices.view_ip');
    const versions = await this.prisma.schoolMobileDevice.findMany({
      where: { tenantId, appVersion: { not: null } },
      distinct: ['appVersion'],
      select: { appVersion: true },
      take: 40,
    });
    return {
      total,
      page,
      limit,
      appVersions: versions.map((v) => v.appVersion).filter(Boolean),
      items: rows.map((row) =>
        this.serialize(row, people.get(row.userId), showIp),
      ),
    };
  }

  async get(tenantId: string, actor: JwtUser, id: string) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const row = await this.prisma.schoolMobileDevice.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Device not found');
    const people = await this.peopleForUsers(tenantId, [row.userId]);
    const showIp = has(actor, 'devices.view_ip');
    const [siblings, ipHistory, events, sessions] = await Promise.all([
      this.prisma.schoolMobileDevice.findMany({
        where: { tenantId, userId: row.userId },
        orderBy: { lastActiveAt: 'desc' },
      }),
      showIp
        ? this.prisma.schoolDeviceIpHistory.findMany({
            where: { tenantId, deviceRowId: row.id },
            orderBy: { observedAt: 'desc' },
            take: 40,
          })
        : Promise.resolve([]),
      this.prisma.schoolDeviceSecurityEvent.findMany({
        where: { tenantId, deviceRowId: row.id },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      has(actor, 'devices.view_sessions')
        ? this.prisma.refreshSession.findMany({
            where: { tenantId, userId: row.userId, revokedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              createdAt: true,
              expiresAt: true,
              ipAddress: true,
              userAgent: true,
              metadata: true,
            },
          })
        : Promise.resolve([]),
    ]);
    return {
      ...this.serialize(row, people.get(row.userId), showIp, true),
      siblings: siblings.map((s) =>
        this.serialize(s, people.get(s.userId), false),
      ),
      ipHistory: showIp ? ipHistory : [],
      events,
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        ipAddress: showIp ? s.ipAddress : null,
        userAgent: s.userAgent,
        deviceId:
          s.metadata && typeof s.metadata === 'object'
            ? ((s.metadata as { deviceId?: string }).deviceId ?? null)
            : null,
      })),
    };
  }

  async logs(
    tenantId: string,
    q: { page?: number; search?: string; eventType?: string },
  ) {
    await this.sis.assertSecondarySisTenant(tenantId);
    const page = Math.max(1, q.page ?? 1);
    const where: Prisma.SchoolDeviceSecurityEventWhereInput = { tenantId };
    if (q.eventType) where.eventType = q.eventType;
    if (q.search?.trim())
      where.description = { contains: q.search.trim(), mode: 'insensitive' };
    const [total, items] = await Promise.all([
      this.prisma.schoolDeviceSecurityEvent.count({ where }),
      this.prisma.schoolDeviceSecurityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 25,
        take: 25,
      }),
    ]);
    return { total, page, items };
  }

  async signOut(
    tenantId: string,
    actor: JwtUser,
    id: string,
    reason?: string,
    ip?: string,
  ) {
    this.assert(actor, 'devices.signout');
    return this.mutate(tenantId, actor, id, 'SIGNED_OUT', reason, ip, false);
  }

  async revoke(
    tenantId: string,
    actor: JwtUser,
    id: string,
    reason?: string,
    ip?: string,
  ) {
    this.assert(actor, 'devices.revoke');
    return this.mutate(tenantId, actor, id, 'REVOKED', reason, ip, true);
  }

  async block(
    tenantId: string,
    actor: JwtUser,
    id: string,
    reason?: string,
    ip?: string,
  ) {
    this.assert(actor, 'devices.block');
    return this.mutate(tenantId, actor, id, 'BLOCKED', reason, ip, true);
  }

  async unblock(tenantId: string, actor: JwtUser, id: string, ip?: string) {
    this.assert(actor, 'devices.unblock');
    const row = await this.requireDevice(tenantId, id);
    await this.prisma.schoolMobileDevice.update({
      where: { id: row.id },
      data: {
        deviceStatus: 'SIGNED_OUT',
        blockedAt: null,
        blockedBy: null,
        blockReason: null,
      },
    });
    await this.event(
      tenantId,
      row,
      'DEVICE_UNBLOCKED',
      'Device unblocked',
      actor,
      ip,
    );
    return { ok: true };
  }

  async revokeAll(
    tenantId: string,
    actor: JwtUser,
    userId: string,
    reason?: string,
    ip?: string,
  ) {
    this.assert(actor, 'devices.revoke_all');
    const rows = await this.prisma.schoolMobileDevice.findMany({
      where: { tenantId, userId },
    });
    for (const row of rows) {
      await this.mutate(tenantId, actor, row.id, 'REVOKED', reason, ip, true);
    }
    await this.prisma.refreshSession.updateMany({
      where: { tenantId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true, count: rows.length };
  }

  async bulk(
    tenantId: string,
    actor: JwtUser,
    ids: string[],
    action: 'revoke' | 'signout' | 'block',
    reason?: string,
    ip?: string,
  ) {
    if (!ids.length) throw new BadRequestException('No devices selected');
    if (ids.length > 100) throw new BadRequestException('Too many devices');
    for (const id of ids) {
      if (action === 'revoke')
        await this.revoke(tenantId, actor, id, reason, ip);
      else if (action === 'block')
        await this.block(tenantId, actor, id, reason, ip);
      else await this.signOut(tenantId, actor, id, reason, ip);
    }
    return { ok: true, count: ids.length };
  }

  private assert(actor: JwtUser, slug: string) {
    if (!has(actor, slug)) throw new ForbiddenException('Not allowed');
  }

  private async killDeviceSessions(
    tenantId: string,
    userId: string,
    deviceId: string,
    now: Date,
  ) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { tenantId, userId, revokedAt: null },
      select: { id: true, metadata: true },
    });
    const ids = sessions
      .filter((s) => {
        const meta = (s.metadata ?? {}) as { deviceId?: string };
        return meta.deviceId === deviceId;
      })
      .map((s) => s.id);
    if (!ids.length) return;
    await this.prisma.refreshSession.updateMany({
      where: { id: { in: ids } },
      data: { revokedAt: now },
    });
  }

  private async requireDevice(tenantId: string, id: string) {
    const row = await this.prisma.schoolMobileDevice.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Device not found');
    return row;
  }

  private async mutate(
    tenantId: string,
    actor: JwtUser,
    id: string,
    status: 'SIGNED_OUT' | 'REVOKED' | 'BLOCKED',
    reason: string | undefined,
    ip: string | undefined,
    killSessions: boolean,
  ) {
    const row = await this.requireDevice(tenantId, id);
    const now = new Date();
    await this.prisma.schoolMobileDevice.update({
      where: { id: row.id },
      data: {
        deviceStatus: status,
        pushToken: killSessions ? null : row.pushToken,
        pushEnabled: killSessions ? false : row.pushEnabled,
        lastLogoutAt: now,
        signedOutAt: status === 'SIGNED_OUT' ? now : row.signedOutAt,
        revokedAt:
          status === 'REVOKED' || status === 'BLOCKED' ? now : row.revokedAt,
        revokedBy: status === 'REVOKED' ? actor.sub : row.revokedBy,
        revokeReason:
          status === 'REVOKED' ? (reason ?? null) : row.revokeReason,
        blockedAt: status === 'BLOCKED' ? now : row.blockedAt,
        blockedBy: status === 'BLOCKED' ? actor.sub : row.blockedBy,
        blockReason: status === 'BLOCKED' ? (reason ?? null) : row.blockReason,
      },
    });
    if (killSessions || status === 'SIGNED_OUT') {
      await this.killDeviceSessions(tenantId, row.userId, row.deviceId, now);
    }
    await this.event(
      tenantId,
      row,
      `DEVICE_${status}`,
      `Device ${status.toLowerCase().replace('_', ' ')}`,
      actor,
      ip,
      { reason: reason ?? null },
    );
    return { ok: true };
  }

  private async event(
    tenantId: string,
    row: { id: string; userId: string },
    eventType: string,
    description: string,
    actor: JwtUser,
    ip?: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.schoolDeviceSecurityEvent.create({
      data: {
        id: randomUUID(),
        tenantId,
        deviceRowId: row.id,
        userId: row.userId,
        eventType,
        description,
        ipAddress: ip ?? null,
        performedBy: actor.sub,
        metadata: metadata ?? {},
      },
    });
  }

  private async searchUserIds(tenantId: string, term: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { displayName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { username: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 200,
    });
    const links = await this.prisma.schoolPersonAccount.findMany({
      where: {
        tenantId,
        OR: [
          { student: { fullName: { contains: term, mode: 'insensitive' } } },
          {
            student: {
              admissionNumber: { contains: term, mode: 'insensitive' },
            },
          },
          {
            student: {
              enrollments: {
                some: { rollNumber: { contains: term, mode: 'insensitive' } },
              },
            },
          },
          { staff: { fullName: { contains: term, mode: 'insensitive' } } },
          { staff: { employeeCode: { contains: term, mode: 'insensitive' } } },
          { guardian: { fullName: { contains: term, mode: 'insensitive' } } },
        ],
      },
      select: { userId: true },
      take: 200,
    });
    return [
      ...new Set([...users.map((u) => u.id), ...links.map((l) => l.userId)]),
    ];
  }

  private async peopleForUsers(tenantId: string, userIds: string[]) {
    const unique = [...new Set(userIds)];
    const [users, links] = await Promise.all([
      this.prisma.user.findMany({
        where: { tenantId, id: { in: unique } },
        select: {
          id: true,
          displayName: true,
          email: true,
          username: true,
          phone: true,
        },
      }),
      this.prisma.schoolPersonAccount.findMany({
        where: { tenantId, userId: { in: unique } },
        include: {
          student: {
            select: {
              fullName: true,
              admissionNumber: true,
              enrollments: {
                where: { deletedAt: null, status: 'ACTIVE' },
                take: 1,
                orderBy: { updatedAt: 'desc' },
                select: {
                  rollNumber: true,
                  section: {
                    select: { name: true, grade: { select: { name: true } } },
                  },
                },
              },
            },
          },
          staff: { select: { fullName: true, employeeCode: true } },
          guardian: { select: { fullName: true } },
        },
      }),
    ]);
    const map = new Map<
      string,
      {
        name: string;
        email: string | null;
        username: string | null;
        identifier: string | null;
        classLabel: string | null;
      }
    >();
    for (const u of users) {
      const link = links.find((l) => l.userId === u.id);
      const name =
        link?.student?.fullName ||
        link?.staff?.fullName ||
        link?.guardian?.fullName ||
        u.displayName ||
        u.email;
      const identifier =
        link?.student?.admissionNumber ||
        link?.staff?.employeeCode ||
        u.username;
      const enr = link?.student?.enrollments[0];
      map.set(u.id, {
        name,
        email: u.email,
        username: u.username,
        identifier: identifier ?? null,
        classLabel: enr
          ? `${enr.section.grade.name} ${enr.section.name}`
          : null,
      });
    }
    return map;
  }

  private serialize(
    row: {
      id: string;
      userId: string;
      deviceId: string;
      platform: string;
      persona: string;
      appVersion: string | null;
      deviceLabel: string | null;
      deviceModel: string | null;
      osVersion: string | null;
      manufacturer: string | null;
      deviceName: string | null;
      buildNumber: string | null;
      screenResolution: string | null;
      timezone: string | null;
      locale: string | null;
      networkType: string | null;
      lastIpAddress: string | null;
      previousIpAddress: string | null;
      deviceStatus: string;
      pushEnabled: boolean;
      biometricEnabled: boolean;
      lastActiveAt: Date;
      lastLoginAt: Date | null;
      lastLogoutAt: Date | null;
      lastPushAt: Date | null;
      lastSyncAt: Date | null;
      createdAt: Date;
      revokedAt: Date | null;
      blockedAt: Date | null;
      signedOutAt: Date | null;
      flagReason: string | null;
      flaggedAt: Date | null;
      failedAuthCount: number;
      revokeReason: string | null;
      blockReason: string | null;
    },
    person:
      | {
          name: string;
          email: string | null;
          username: string | null;
          identifier: string | null;
          classLabel: string | null;
        }
      | undefined,
    showIp: boolean,
    detail = false,
  ) {
    const now = Date.now();
    const last = row.lastActiveAt.getTime();
    const session =
      row.deviceStatus === 'REVOKED' || row.revokedAt
        ? 'revoked'
        : row.deviceStatus === 'BLOCKED'
          ? 'blocked'
          : row.deviceStatus === 'SIGNED_OUT'
            ? 'logged_out'
            : now - last < ONLINE_MS
              ? 'online'
              : now - last < RECENT_MS
                ? 'recent'
                : 'expired';
    const base = {
      id: row.id,
      userId: row.userId,
      installationId: row.deviceId,
      platform: row.platform,
      persona: row.persona,
      appVersion: row.appVersion,
      deviceLabel: row.deviceLabel,
      deviceModel: row.deviceModel,
      osVersion: row.osVersion,
      manufacturer: row.manufacturer,
      deviceName: row.deviceName,
      deviceStatus: row.deviceStatus,
      pushEnabled:
        row.pushEnabled && Boolean(row.lastPushAt || row.pushEnabled),
      lastActiveAt: row.lastActiveAt,
      lastLoginAt: row.lastLoginAt,
      lastPushAt: row.lastPushAt,
      createdAt: row.createdAt,
      session,
      flagged: Boolean(row.flaggedAt),
      userName: person?.name ?? 'Unknown user',
      userEmail: person?.email ?? null,
      username: person?.username ?? null,
      identifier: person?.identifier ?? null,
      classLabel: person?.classLabel ?? null,
      lastIpAddress: showIp ? row.lastIpAddress : null,
    };
    if (!detail) return base;
    return {
      ...base,
      buildNumber: row.buildNumber,
      screenResolution: row.screenResolution,
      timezone: row.timezone,
      locale: row.locale,
      networkType: row.networkType,
      previousIpAddress: showIp ? row.previousIpAddress : null,
      biometricEnabled: row.biometricEnabled,
      lastLogoutAt: row.lastLogoutAt,
      lastSyncAt: row.lastSyncAt,
      failedAuthCount: row.failedAuthCount,
      flagReason: row.flagReason,
      revokeReason: row.revokeReason,
      blockReason: row.blockReason,
      blockedAt: row.blockedAt,
      signedOutAt: row.signedOutAt,
      revokedAt: row.revokedAt,
    };
  }
}
