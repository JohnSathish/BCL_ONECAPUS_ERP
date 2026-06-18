import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CommunicationAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(tenantId: string, from?: string, to?: string) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const where = {
      tenantId,
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    };

    const byChannel = await this.prisma.communicationDeliveryLog.groupBy({
      by: ['channel', 'status'],
      where,
      _count: true,
    });

    const channels = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'] as const;
    const result: Record<
      string,
      {
        sent: number;
        delivered: number;
        failed: number;
        opened: number;
        read: number;
        clicked: number;
      }
    > = {};

    for (const ch of channels) {
      const rows = byChannel.filter((r) => r.channel === ch);
      const sent = rows
        .filter((r) => ['SENT', 'DELIVERED', 'FAILED'].includes(r.status))
        .reduce((s, r) => s + r._count, 0);
      const delivered = rows
        .filter((r) => ['SENT', 'DELIVERED'].includes(r.status))
        .reduce((s, r) => s + r._count, 0);
      const failed = rows
        .filter((r) => r.status === 'FAILED')
        .reduce((s, r) => s + r._count, 0);

      const opened =
        ch === 'EMAIL'
          ? await this.prisma.communicationDeliveryLog.count({
              where: { ...where, channel: ch, openedAt: { not: null } },
            })
          : 0;
      const clicked =
        ch === 'EMAIL'
          ? await this.prisma.communicationDeliveryLog.count({
              where: { ...where, channel: ch, clickedAt: { not: null } },
            })
          : 0;

      result[ch] = { sent, delivered, failed, opened, read: 0, clicked };
    }

    const daily = await this.prisma.$queryRaw<
      { day: Date; channel: string; count: bigint }[]
    >`
      SELECT DATE(created_at) as day, channel, COUNT(*)::bigint as count
      FROM platform.communication_delivery_logs
      WHERE tenant_id = ${tenantId}::uuid
      GROUP BY DATE(created_at), channel
      ORDER BY day DESC
      LIMIT 30
    `;

    return {
      byChannel: result,
      daily: daily.map((d) => ({
        day: d.day,
        channel: d.channel,
        count: Number(d.count),
      })),
    };
  }

  async exportLogs(
    tenantId: string,
    query: {
      campaignId?: string;
      channel?: string;
      status?: string;
      from?: string;
      to?: string;
    },
  ) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.from) dateFilter.gte = new Date(query.from);
    if (query.to) dateFilter.lte = new Date(query.to);

    return this.prisma.communicationDeliveryLog.findMany({
      where: {
        tenantId,
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.channel ? { channel: query.channel } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: {
        recipient: { select: { displayName: true, email: true, phone: true } },
        campaign: { select: { name: true, subject: true, audienceType: true } },
      },
    });
  }
}
