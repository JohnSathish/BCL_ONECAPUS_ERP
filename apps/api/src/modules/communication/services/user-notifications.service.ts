import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';
import { sanitizeNotificationLink } from '../../../common/permissions/portal-access';

@Injectable()
export class UserNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: JwtUser, limit = 30) {
    const rows = await this.prisma.userNotification.findMany({
      where: { tenantId: user.tid, userId: user.sub },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((row) => ({
      ...row,
      link: sanitizeNotificationLink(user.roles ?? [], row.link) ?? null,
    }));
  }

  async unreadCount(user: JwtUser) {
    const count = await this.prisma.userNotification.count({
      where: { tenantId: user.tid, userId: user.sub, readAt: null },
    });
    return { count };
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

  markAllRead(user: JwtUser) {
    return this.prisma.userNotification.updateMany({
      where: { tenantId: user.tid, userId: user.sub, readAt: null },
      data: { readAt: new Date() },
    });
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
        settings: (settings ?? {}) as Prisma.InputJsonValue,
      },
      update: { enabled, settings: (settings ?? {}) as Prisma.InputJsonValue },
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
        title: input.title,
        body: input.body,
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
