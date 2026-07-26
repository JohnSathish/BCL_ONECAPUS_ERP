import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SupportSettingsService } from './support-settings.service';

@Injectable()
export class SupportAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SupportSettingsService,
  ) {}

  private db() {
    return this.prisma as unknown as Record<string, any>;
  }

  async dashboard(tenantId: string) {
    await this.settings.ensureBootstrap(tenantId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      openTickets,
      pendingTickets,
      resolvedToday,
      activeChats,
      unassignedChats,
      waitingChats,
      onlineAgents,
      unreadMessages,
      byCategory,
      byDepartment,
      recentChats,
      messagesToday,
    ] = await Promise.all([
      this.db().supportTicket.count({
        where: {
          tenantId,
          status: {
            in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_STUDENT'],
          },
        },
      }),
      this.db().supportTicket.count({
        where: { tenantId, status: { in: ['OPEN', 'ASSIGNED'] } },
      }),
      this.db().supportTicket.count({
        where: {
          tenantId,
          status: 'RESOLVED',
          resolvedAt: { gte: startOfDay },
        },
      }),
      this.db().supportChatThread.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'ASSIGNED', 'WAITING'] },
        },
      }),
      this.db().supportChatThread.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'ASSIGNED', 'WAITING'] },
          agentId: null,
        },
      }),
      this.db().supportChatThread.count({
        where: { tenantId, status: 'WAITING' },
      }),
      this.db().supportAgent.count({
        where: { tenantId, isOnline: true, isActive: true },
      }),
      this.db().supportChatThread.aggregate({
        where: { tenantId, status: { not: 'CLOSED' } },
        _sum: { unreadAgent: true },
      }),
      this.db().supportTicket.groupBy({
        by: ['category'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.db().supportTicket.groupBy({
        by: ['departmentId'],
        where: { tenantId, departmentId: { not: null } },
        _count: { _all: true },
      }),
      this.db().supportChatThread.findMany({
        where: { tenantId, status: { not: 'CLOSED' } },
        include: { department: true, agent: true },
        orderBy: [{ unreadAgent: 'desc' }, { lastMessageAt: 'desc' }],
        take: 8,
      }),
      this.db().supportChatMessage.count({
        where: { tenantId, createdAt: { gte: startOfDay } },
      }),
    ]);

    const chatsThisWeek = await this.db().supportChatThread.count({
      where: { tenantId, createdAt: { gte: weekAgo } },
    });

    const rated = await this.db().supportTicket.findMany({
      where: { tenantId, satisfactionScore: { not: null } },
      select: { satisfactionScore: true },
      take: 500,
    });
    const avgSatisfaction =
      rated.length > 0
        ? rated.reduce(
            (s: number, r: { satisfactionScore: number }) =>
              s + r.satisfactionScore,
            0,
          ) / rated.length
        : null;

    return {
      openTickets,
      pendingTickets,
      resolvedToday,
      activeChats,
      unassignedChats,
      waitingChats,
      onlineAgents,
      unreadMessages: unreadMessages._sum?.unreadAgent ?? 0,
      messagesToday,
      chatsThisWeek,
      avgSatisfaction,
      recentChats,
      byCategory: (
        byCategory as Array<{ category: string; _count: { _all: number } }>
      ).map((r) => ({ category: r.category, count: r._count._all })),
      byDepartment,
      translationReady: true,
    };
  }
}
