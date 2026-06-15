import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CommunicationEmailService } from './communication-email.service';
import { CommunicationTemplateRendererService } from './communication-template-renderer.service';
import { UserNotificationsService } from './user-notifications.service';
import { FcmPushService } from './fcm-push.service';
import { resolveNotificationLink } from '../utils/notification-link.util';

@Injectable()
export class CommunicationDeliveryService {
  private readonly logger = new Logger(CommunicationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: CommunicationEmailService,
    private readonly notifications: UserNotificationsService,
    private readonly renderer: CommunicationTemplateRendererService,
    private readonly fcm: FcmPushService,
  ) {}

  async deliverCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.communicationCampaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found`);
      return;
    }

    const channels = (campaign.channels as string[]) ?? ['IN_APP'];
    const metadata = (campaign.metadata ?? {}) as Record<string, unknown>;
    const variables = (metadata.variables ?? {}) as Record<string, string>;
    const rendered = this.renderer.renderAll(
      {
        subject: campaign.subject,
        bodyHtml: campaign.bodyHtml,
        bodyText: campaign.bodyText,
      },
      variables,
    );
    const subject = this.coalesceRendered(
      rendered.subject,
      campaign.subject,
      campaign.name,
    );
    const bodyHtml = this.coalesceRendered(
      rendered.bodyHtml,
      campaign.bodyHtml,
    );
    const bodyText = this.coalesceRendered(
      rendered.bodyText,
      campaign.bodyText,
      subject,
    );

    const recipients = await this.prisma.communicationRecipient.findMany({
      where: { tenantId, campaignId },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      for (const channel of channels) {
        if (channel === 'SMS' || channel === 'WHATSAPP') {
          await this.logDelivery({
            tenantId,
            campaignId,
            recipientId: recipient.id,
            channel,
            status: 'FAILED',
            errorMessage: `${channel} integration not configured yet`,
          });
          failedCount++;
          continue;
        }

        if (channel === 'PUSH') {
          if (!recipient.userId) {
            await this.logDelivery({
              tenantId,
              campaignId,
              recipientId: recipient.id,
              channel,
              status: 'FAILED',
              errorMessage: 'No portal user linked',
            });
            failedCount++;
            continue;
          }
          const devices = await this.prisma.mobileDevice.findMany({
            where: {
              tenantId,
              userId: recipient.userId,
              status: 'ACTIVE',
              pushToken: { not: null },
            },
            select: { pushToken: true },
          });
          const tokens = devices
            .map((d) => d.pushToken)
            .filter((t): t is string => Boolean(t));
          const result = await this.fcm.sendToTokens(tokens, {
            title: subject,
            body: bodyText ?? subject,
            data: {
              campaignId,
              link:
                resolveNotificationLink({
                  recipientType: recipient.recipientType,
                  triggerKey: String(metadata.trigger ?? ''),
                  entityType: String(metadata.entityType ?? ''),
                }) ?? '',
            },
          });
          await this.logDelivery({
            tenantId,
            campaignId,
            recipientId: recipient.id,
            channel,
            status: result.ok ? 'SENT' : 'FAILED',
            provider: result.provider,
            providerRef: result.providerRef,
            errorMessage: result.error,
          });
          if (result.ok) sentCount++;
          else failedCount++;
          continue;
        }

        if (channel === 'EMAIL') {
          if (!recipient.email) {
            await this.logDelivery({
              tenantId,
              campaignId,
              recipientId: recipient.id,
              channel,
              status: 'FAILED',
              errorMessage: 'No email address',
            });
            failedCount++;
            continue;
          }

          const pref = recipient.userId
            ? await this.prisma.notificationPreference.findUnique({
                where: {
                  tenantId_userId_channel: {
                    tenantId,
                    userId: recipient.userId,
                    channel: 'EMAIL',
                  },
                },
              })
            : null;
          if (pref && !pref.enabled) continue;

          const result = await this.email.send({
            to: recipient.email,
            subject,
            html: bodyHtml ?? `<p>${bodyText ?? subject}</p>`,
            text: bodyText ?? undefined,
          });

          await this.logDelivery({
            tenantId,
            campaignId,
            recipientId: recipient.id,
            channel,
            status: result.ok ? 'SENT' : 'FAILED',
            provider: result.provider,
            providerRef: result.providerRef,
            errorMessage: result.error,
          });

          if (result.ok) sentCount++;
          else failedCount++;
        }

        if (channel === 'IN_APP') {
          if (!recipient.userId) {
            await this.logDelivery({
              tenantId,
              campaignId,
              recipientId: recipient.id,
              channel,
              status: 'FAILED',
              errorMessage: 'No portal user linked',
            });
            failedCount++;
            continue;
          }

          const triggerKey = String(metadata.trigger ?? '');
          const notificationLink = resolveNotificationLink({
            recipientType: recipient.recipientType,
            triggerKey,
            entityType: String(metadata.entityType ?? ''),
          });

          const notification = await this.notifications.createInApp({
            tenantId,
            userId: recipient.userId,
            type: 'CAMPAIGN',
            title: subject,
            body: bodyText ?? bodyHtml?.replace(/<[^>]+>/g, ' ') ?? subject,
            link: notificationLink,
            campaignId,
            metadata: { triggerKey, recipientType: recipient.recipientType },
          });

          await this.logDelivery({
            tenantId,
            campaignId,
            recipientId: recipient.id,
            channel,
            status: notification ? 'DELIVERED' : 'FAILED',
            provider: 'in_app',
            providerRef: notification?.id,
            errorMessage: notification
              ? undefined
              : 'User opted out or delivery skipped',
          });

          if (notification) sentCount++;
          else failedCount++;
        }
      }

      await this.prisma.communicationRecipient.update({
        where: { id: recipient.id },
        data: {
          deliveryStatus: 'SENT',
          sentAt: new Date(),
        },
      });
    }

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: {
        status:
          failedCount === recipients.length * channels.length
            ? 'FAILED'
            : 'SENT',
        sentAt: new Date(),
      },
    });

    return { sentCount, failedCount, recipientCount: recipients.length };
  }

  private coalesceRendered(...candidates: Array<string | null | undefined>) {
    for (const value of candidates) {
      if (!value?.trim()) continue;
      if (/\{\{[^}]+\}\}/.test(value)) continue;
      return value;
    }
    return candidates.find((v) => v?.trim())?.trim() ?? 'Notification';
  }

  private async logDelivery(input: {
    tenantId: string;
    campaignId: string;
    recipientId: string;
    channel: string;
    status: string;
    provider?: string;
    providerRef?: string;
    errorMessage?: string;
  }) {
    return this.prisma.communicationDeliveryLog.create({
      data: {
        tenantId: input.tenantId,
        campaignId: input.campaignId,
        recipientId: input.recipientId,
        channel: input.channel,
        status: input.status,
        provider: input.provider,
        providerRef: input.providerRef,
        errorMessage: input.errorMessage,
        sentAt: ['SENT', 'DELIVERED'].includes(input.status)
          ? new Date()
          : undefined,
        deliveredAt: input.status === 'DELIVERED' ? new Date() : undefined,
      },
    });
  }

  async processLegacyNotificationJob(data: Record<string, unknown>) {
    const tenantId = String(data.tenantId ?? '');
    const userIds = (data.userIds as string[]) ?? [];
    if (!tenantId || !userIds.length) return;

    for (const userId of userIds) {
      await this.notifications.createInApp({
        tenantId,
        userId,
        type: String(data.type ?? 'GENERAL'),
        title: String(data.title ?? 'Notification'),
        body: String(data.body ?? ''),
        metadata: (data.metadata as Record<string, unknown>) ?? {},
      });
    }
  }
}
