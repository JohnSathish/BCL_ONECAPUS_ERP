import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { sanitizeNotificationLink } from '../../../common/permissions/portal-access';
import { DEFAULT_PUSH_CATEGORY_SETTINGS } from '../utils/push-preference.util';

const ADMIN_OPS_ENTITY_TYPES = new Set([
  'backup_run',
  'license',
  'server_alert',
]);

/** Fix common UTF-8 mojibake (e.g. em dash shown as â€”). */
function sanitizeNotificationText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/\u00e2\u20ac\u201d/g, '-') // mojibake of —
    .replace(/â€”/g, '-')
    .replace(/â€“/g, '-')
    .replace(/Â·/g, '·')
    .replace(/\u2014/g, '-') // em dash
    .replace(/\u2013/g, '-'); // en dash
}

function isAdminOpsNotification(row: {
  title: string;
  body: string;
  metadata: unknown;
}): boolean {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const entityType = String(meta.entityType ?? '');
  const triggerKey = String(meta.triggerKey ?? meta.trigger ?? '');
  if (ADMIN_OPS_ENTITY_TYPES.has(entityType)) return true;
  if (triggerKey.startsWith('backup.')) return true;
  if (/^backup\b/i.test(row.title) || /^backup\b/i.test(row.body)) return true;
  return false;
}

function canViewAdminOpsNotifications(user: JwtUser): boolean {
  const perms = user.permissions ?? [];
  if (perms.includes('backup:read') || perms.includes('backup:manage')) {
    return true;
  }
  const roles = user.roles ?? [];
  return roles.some((r) =>
    [
      'college-admin',
      'super-admin',
      'institution-admin',
      'platform-admin',
    ].includes(r),
  );
}

@Injectable()
export class UserNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRow<
    T extends { title: string; body: string; link: string | null },
  >(
    user: JwtUser,
    row: T,
  ): T & { title: string; body: string; link: string | null } {
    return {
      ...row,
      title: sanitizeNotificationText(row.title),
      body: sanitizeNotificationText(row.body),
      link: sanitizeNotificationLink(user.roles ?? [], row.link) ?? null,
    };
  }

  private filterForViewer<
    T extends { title: string; body: string; metadata: unknown },
  >(user: JwtUser, rows: T[]): T[] {
    if (canViewAdminOpsNotifications(user)) return rows;
    return rows.filter((row) => !isAdminOpsNotification(row));
  }

  async list(user: JwtUser, limit = 30) {
    const rows = await this.prisma.userNotification.findMany({
      where: { tenantId: user.tid, userId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return this.filterForViewer(user, rows).map((row) =>
      this.mapRow(user, row),
    );
  }

  async unreadCount(user: JwtUser) {
    if (canViewAdminOpsNotifications(user)) {
      const count = await this.prisma.userNotification.count({
        where: { tenantId: user.tid, userId: user.sub, readAt: null },
      });
      return { count };
    }
    const rows = await this.prisma.userNotification.findMany({
      where: { tenantId: user.tid, userId: user.sub, readAt: null },
      select: { title: true, body: true, metadata: true },
      take: 200,
    });
    return { count: this.filterForViewer(user, rows).length };
  }

  async markRead(user: JwtUser, id: string) {
    const row = await this.prisma.userNotification.findFirst({
      where: { id, tenantId: user.tid, userId: user.sub },
    });
    if (!row) throw new NotFoundException('Notification not found');
    return this.prisma.userNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(user: JwtUser) {
    return this.prisma.userNotification.updateMany({
      where: { tenantId: user.tid, userId: user.sub, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async dismiss(user: JwtUser, id: string) {
    const row = await this.prisma.userNotification.findFirst({
      where: { id, tenantId: user.tid, userId: user.sub },
    });
    if (!row) throw new NotFoundException('Notification not found');
    return this.prisma.userNotification.update({
      where: { id },
      data: { dismissedAt: new Date(), readAt: row.readAt ?? new Date() },
    });
  }

  async archive(user: JwtUser, id: string) {
    const row = await this.prisma.userNotification.findFirst({
      where: { id, tenantId: user.tid, userId: user.sub },
    });
    if (!row) throw new NotFoundException('Notification not found');
    return this.prisma.userNotification.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async listInbox(
    user: JwtUser,
    filter: 'all' | 'unread' | 'archived' = 'all',
    limit = 50,
  ) {
    const where: Record<string, unknown> = {
      tenantId: user.tid,
      userId: user.sub,
      dismissedAt: null,
    };
    if (filter === 'unread') where.readAt = null;
    if (filter === 'archived') {
      where.archivedAt = { not: null };
      delete where.dismissedAt;
    } else {
      where.archivedAt = null;
    }
    const rows = await this.prisma.userNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return this.filterForViewer(user, rows).map((row) =>
      this.mapRow(user, row),
    );
  }

  getPreferences(user: JwtUser) {
    return this.prisma.notificationPreference.findMany({
      where: { tenantId: user.tid, userId: user.sub },
      orderBy: { channel: 'asc' },
    });
  }

  async upsertPreference(
    user: JwtUser,
    channel: string,
    enabled: boolean,
    settings?: Record<string, unknown>,
  ) {
    const mergedSettings =
      channel === 'PUSH'
        ? {
            ...DEFAULT_PUSH_CATEGORY_SETTINGS,
            ...(settings ?? {}),
          }
        : (settings ?? {});

    return this.prisma.notificationPreference.upsert({
      where: {
        tenantId_userId_channel: {
          tenantId: user.tid,
          userId: user.sub,
          channel,
        },
      },
      create: {
        tenantId: user.tid,
        userId: user.sub,
        channel,
        enabled,
        settings: mergedSettings as Prisma.InputJsonValue,
      },
      update: {
        enabled,
        settings: mergedSettings as Prisma.InputJsonValue,
      },
    });
  }

  async createInApp(input: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    link?: string;
    campaignId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        tenantId_userId_channel: {
          tenantId: input.tenantId,
          userId: input.userId,
          channel: 'IN_APP',
        },
      },
    });
    if (pref && !pref.enabled) return null;

    const roles = await this.userRoleSlugs(input.tenantId, input.userId);
    const safeLink = input.link
      ? sanitizeNotificationLink(roles, input.link)
      : undefined;

    return this.prisma.userNotification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: sanitizeNotificationText(input.title),
        body: sanitizeNotificationText(input.body),
        link: safeLink,
        campaignId: input.campaignId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private async userRoleSlugs(tenantId: string, userId: string) {
    const rows = await this.prisma.userRole.findMany({
      where: { userId, deletedAt: null, role: { tenantId } },
      include: { role: { select: { slug: true } } },
    });
    return rows.map((row) => row.role.slug);
  }
}
