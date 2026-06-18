import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { QueueService } from '../../../shared/queue/queue.service';
import { CommunicationSmsService } from './communication-sms.service';
import { FcmPushService } from './fcm-push.service';

@Injectable()
export class CommunicationDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
    private readonly sms: CommunicationSmsService,
    private readonly fcm: FcmPushService,
  ) {}

  private startOfDay(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private startOfMonth(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  async dashboard(tenantId: string) {
    const today = this.startOfDay();
    const monthStart = this.startOfMonth();
    const successStatuses = ['SENT', 'DELIVERED'];

    const [
      templates,
      campaigns,
      sent,
      pending,
      scheduledCount,
      activeCampaigns,
      messagesSentToday,
      messagesSentThisMonth,
      failedCount,
      totalDeliveries,
      openedCount,
      clickedCount,
      deliveryStats,
      recentCampaigns,
      liveActivity,
      queueStats,
      channelHealth,
      smsToday,
      smsMonth,
      activeDevices,
    ] = await Promise.all([
      this.prisma.communicationTemplate.count({
        where: { tenantId, deletedAt: null, isActive: true },
      }),
      this.prisma.communicationCampaign.count({ where: { tenantId } }),
      this.prisma.communicationCampaign.count({
        where: { tenantId, status: 'SENT' },
      }),
      this.prisma.communicationCampaign.count({
        where: { tenantId, status: { in: ['DRAFT', 'SCHEDULED', 'SENDING'] } },
      }),
      this.prisma.communicationCampaign.count({
        where: { tenantId, status: 'SCHEDULED' },
      }),
      this.prisma.communicationCampaign.count({
        where: { tenantId, status: { in: ['SENDING', 'SCHEDULED'] } },
      }),
      this.prisma.communicationDeliveryLog.count({
        where: {
          tenantId,
          status: { in: successStatuses },
          createdAt: { gte: today },
        },
      }),
      this.prisma.communicationDeliveryLog.count({
        where: {
          tenantId,
          status: { in: successStatuses },
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.communicationDeliveryLog.count({
        where: { tenantId, status: 'FAILED' },
      }),
      this.prisma.communicationDeliveryLog.count({ where: { tenantId } }),
      this.prisma.communicationDeliveryLog.count({
        where: { tenantId, openedAt: { not: null } },
      }),
      this.prisma.communicationDeliveryLog.count({
        where: { tenantId, clickedAt: { not: null } },
      }),
      this.prisma.communicationDeliveryLog.groupBy({
        by: ['channel', 'status'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.communicationCampaign.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          sentAt: true,
          createdAt: true,
          audienceType: true,
        },
      }),
      this.buildLiveActivity(tenantId),
      this.queue.getNotificationQueueStats(),
      this.channelHealth(tenantId),
      this.prisma.communicationDeliveryLog.count({
        where: { tenantId, channel: 'SMS', createdAt: { gte: today } },
      }),
      this.prisma.communicationDeliveryLog.count({
        where: { tenantId, channel: 'SMS', createdAt: { gte: monthStart } },
      }),
      this.prisma.mobileDevice.count({
        where: { tenantId, status: 'ACTIVE', pushToken: { not: null } },
      }),
    ]);

    const deliverySuccessRate =
      totalDeliveries > 0
        ? Math.round(
            ((totalDeliveries - failedCount) / totalDeliveries) * 1000,
          ) / 10
        : 100;

    const emailDelivered = await this.prisma.communicationDeliveryLog.count({
      where: {
        tenantId,
        channel: 'EMAIL',
        status: { in: successStatuses },
      },
    });
    const openRate =
      emailDelivered > 0
        ? Math.round((openedCount / emailDelivered) * 1000) / 10
        : null;
    const clickRate =
      emailDelivered > 0
        ? Math.round((clickedCount / emailDelivered) * 1000) / 10
        : null;

    const lastEmail = await this.prisma.communicationDeliveryLog.findFirst({
      where: { tenantId, channel: 'EMAIL', status: { in: successStatuses } },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    });

    const pushDelivered = await this.prisma.communicationDeliveryLog.count({
      where: { tenantId, channel: 'PUSH', status: { in: successStatuses } },
    });
    const pushTotal = await this.prisma.communicationDeliveryLog.count({
      where: { tenantId, channel: 'PUSH' },
    });

    return {
      templates,
      campaigns,
      sent,
      pending,
      scheduledCount,
      activeCampaigns,
      messagesSentToday,
      messagesSentThisMonth,
      deliverySuccessRate,
      failedCount,
      openRate,
      clickRate,
      deliveryStats,
      recentCampaigns,
      liveActivity,
      queueStats,
      channelHealth: {
        ...channelHealth,
        email: {
          ...channelHealth.email,
          lastSent: lastEmail?.sentAt?.toISOString() ?? null,
        },
        sms: {
          ...channelHealth.sms,
          usedToday: smsToday,
          usedThisMonth: smsMonth,
        },
        push: {
          ...channelHealth.push,
          activeDevices,
          deliveryRate:
            pushTotal > 0
              ? Math.round((pushDelivered / pushTotal) * 1000) / 10
              : null,
        },
      },
    };
  }

  async channelHealth(tenantId: string) {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const whatsappToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');

    const whatsappTemplates =
      await this.prisma.communicationWhatsAppTemplate.count({
        where: { tenantId, status: 'APPROVED' },
      });

    const queueStats = await this.queue.getNotificationQueueStats();

    return {
      email: {
        connected: Boolean(smtpHost),
        provider: smtpHost ? 'smtp' : 'dev-log',
        queueSize: queueStats.waiting + queueStats.active,
      },
      sms: {
        connected: this.sms.isConfigured(),
        provider: 'http-gateway',
        balance: null as number | null,
      },
      whatsapp: {
        connected: Boolean(whatsappToken),
        templatesApproved: whatsappTemplates,
        messagesDelivered: await this.prisma.communicationDeliveryLog.count({
          where: {
            tenantId,
            channel: 'WHATSAPP',
            status: { in: ['SENT', 'DELIVERED'] },
          },
        }),
      },
      push: {
        connected: this.fcm.isConfigured(),
        demoMode: this.fcm.isDemoMode(),
        activeDevices: 0,
        deliveryRate: null as number | null,
      },
    };
  }

  private async buildLiveActivity(tenantId: string) {
    const logs = await this.prisma.communicationDeliveryLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        campaign: { select: { name: true, audienceType: true } },
        recipient: { select: { displayName: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      time: log.createdAt.toISOString(),
      channel: log.channel,
      status: log.status,
      label: this.formatActivityLabel(log),
    }));
  }

  private formatActivityLabel(log: {
    channel: string;
    status: string;
    campaign?: { name: string; audienceType: string } | null;
    recipient?: { displayName: string | null } | null;
  }) {
    const name = log.campaign?.name ?? 'Message';
    const recipient = log.recipient?.displayName;
    if (log.status === 'FAILED') {
      return `${name} failed${recipient ? ` for ${recipient}` : ''}`;
    }
    if (log.channel === 'EMAIL' && log.status === 'DELIVERED') {
      return `${name} delivered via email`;
    }
    if (log.channel === 'IN_APP') {
      return `${name} sent as in-app notification`;
    }
    if (log.campaign?.audienceType === 'STUDENTS') {
      return `${name} sent to students`;
    }
    return `${name} · ${log.channel} · ${log.status}`;
  }
}
