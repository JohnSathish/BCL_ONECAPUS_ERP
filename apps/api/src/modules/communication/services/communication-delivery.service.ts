import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { join } from 'path';
import { PrismaService } from '../../../database/prisma.service';
import { resolveUploadRoot } from '../../../common/uploads/upload-paths';
import { CommunicationEmailService } from './communication-email.service';
import { CommunicationSmsService } from './communication-sms.service';
import { CommunicationTemplateRendererService } from './communication-template-renderer.service';
import { BrandedEmailLayoutService } from './branded-email-layout.service';
import { UserNotificationsService } from './user-notifications.service';
import { COLLEGE_IOS_BUNDLE_ID, FcmPushService } from './fcm-push.service';
import { CommunicationWhatsAppService } from './communication-whatsapp.service';
import { resolveNotificationLink } from '../utils/notification-link.util';
import {
  isPushCategoryEnabled,
  resolvePushCategory,
} from '../utils/push-preference.util';
import type { CommunicationAttachment } from './communication-assets.service';

@Injectable()
export class CommunicationDeliveryService {
  private readonly logger = new Logger(CommunicationDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: CommunicationEmailService,
    private readonly sms: CommunicationSmsService,
    private readonly notifications: UserNotificationsService,
    private readonly renderer: CommunicationTemplateRendererService,
    private readonly brandedLayout: BrandedEmailLayoutService,
    private readonly fcm: FcmPushService,
    private readonly whatsapp: CommunicationWhatsAppService,
    private readonly config: ConfigService,
  ) {}

  private parseAttachments(raw: unknown): CommunicationAttachment[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        const row = item as Partial<CommunicationAttachment>;
        if (!row?.url || !row.type) return null;
        return {
          type: row.type === 'pdf' ? 'pdf' : 'image',
          url: String(row.url),
          name: String(row.name ?? 'attachment'),
          mimeType: String(row.mimeType ?? ''),
          size: Number(row.size ?? 0),
        } satisfies CommunicationAttachment;
      })
      .filter((x): x is CommunicationAttachment => Boolean(x));
  }

  private toAbsoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const base = (
      this.config.get<string>('APP_PUBLIC_URL') ??
      this.config.get<string>('API_PUBLIC_URL') ??
      this.config.get<string>('WEB_ORIGIN') ??
      'http://127.0.0.1:3001'
    ).replace(/\/$/, '');
    const absolute = `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(absolute)) {
      this.logger.warn(
        `Attachment URL resolves to localhost (${absolute}). Set APP_PUBLIC_URL to a public HTTPS origin so FCM can fetch images.`,
      );
    }
    return absolute;
  }

  private attachmentDiskPath(url: string): string | null {
    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    if (idx < 0) return null;
    return join(resolveUploadRoot(), url.slice(idx + marker.length));
  }

  private appendAttachmentHtml(
    html: string | null | undefined,
    attachments: CommunicationAttachment[],
  ) {
    if (!attachments.length) return html ?? undefined;
    const links = attachments
      .map((a) => {
        const href = this.toAbsoluteUrl(a.url);
        if (a.type === 'image') {
          return `<p><img src="${href}" alt="${a.name}" style="max-width:100%;height:auto" /></p>`;
        }
        return `<p><a href="${href}">${a.name}</a> (PDF)</p>`;
      })
      .join('');
    return `${html ?? ''}${links}`;
  }

  async deliverCampaign(tenantId: string, campaignId: string) {
    const campaignRow = await this.prisma.communicationCampaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { status: true, metadata: true },
    });
    if (!campaignRow) {
      return { sentCount: 0, failedCount: 0, recipientCount: 0 };
    }
    if (
      campaignRow.status === 'SENT' ||
      campaignRow.status === 'CANCELLED' ||
      campaignRow.status === 'REVOKED'
    ) {
      if (campaignRow.status === 'REVOKED') {
        await this.prisma.userNotification.deleteMany({
          where: { tenantId, campaignId },
        });
      }
      return { sentCount: 0, failedCount: 0, recipientCount: 0, skipped: true };
    }

    const total = await this.prisma.communicationRecipient.count({
      where: { tenantId, campaignId },
    });
    if (!total) {
      await this.prisma.communicationCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
          metadata: {
            ...((campaignRow.metadata as object) ?? {}),
            failureReason: 'No recipients to deliver',
          },
        },
      });
      return { sentCount: 0, failedCount: 0, recipientCount: 0 };
    }

    // Small batches keep BullMQ locks healthy on large “everyone” sends.
    const limit = 40;
    let offset = 0;
    let sentCount = 0;
    let failedCount = 0;
    while (offset < total) {
      const batch = await this.deliverCampaignBatch(
        tenantId,
        campaignId,
        offset,
        limit,
        { finalize: false },
      );
      if (batch && 'skipped' in batch && batch.skipped) break;
      sentCount += batch?.sentCount ?? 0;
      failedCount += batch?.failedCount ?? 0;
      offset += limit;
    }

    const stopped = await this.prisma.communicationCampaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { status: true },
    });
    if (stopped?.status === 'REVOKED' || stopped?.status === 'CANCELLED') {
      if (stopped.status === 'REVOKED') {
        await this.prisma.userNotification.deleteMany({
          where: { tenantId, campaignId },
        });
      }
      return {
        sentCount,
        failedCount,
        recipientCount: total,
        skipped: true,
      };
    }

    const pushFailed = await this.prisma.communicationDeliveryLog.count({
      where: { tenantId, campaignId, channel: 'PUSH', status: 'FAILED' },
    });
    const anySent = await this.prisma.communicationDeliveryLog.count({
      where: {
        tenantId,
        campaignId,
        status: { in: ['SENT', 'DELIVERED'] },
      },
    });

    const campaign = await this.prisma.communicationCampaign.findFirst({
      where: { id: campaignId, tenantId },
      select: { metadata: true },
    });

    await this.prisma.communicationCampaign.update({
      where: { id: campaignId },
      data: {
        status: anySent > 0 ? 'SENT' : 'FAILED',
        sentAt: anySent > 0 ? new Date() : undefined,
        metadata: {
          ...((campaign?.metadata as object) ?? {}),
          deliverySummary: {
            sentCount,
            failedCount,
            pushFailed,
            recipientCount: total,
          },
        },
      },
    });

    return { sentCount, failedCount, recipientCount: total };
  }

  async deliverCampaignBatch(
    tenantId: string,
    campaignId: string,
    offset = 0,
    limit = 40,
    options?: { finalize?: boolean; recipientId?: string; channel?: string },
  ) {
    const campaign = await this.prisma.communicationCampaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found`);
      return;
    }

    // A revoke must not be overwritten by a batch that is still finishing.
    if (campaign.status === 'REVOKED') {
      await this.prisma.userNotification.deleteMany({
        where: { tenantId, campaignId },
      });
      return { sentCount: 0, failedCount: 0, recipientCount: 0, skipped: true };
    }

    // Full re-deliver of a finished campaign can create duplicate inbox rows.
    if (
      !options?.recipientId &&
      (campaign.status === 'SENT' || campaign.status === 'CANCELLED')
    ) {
      return { sentCount: 0, failedCount: 0, recipientCount: 0, skipped: true };
    }

    const channels = options?.channel
      ? [options.channel]
      : ((campaign.channels as string[]) ?? ['IN_APP']);
    // Create inbox rows before PUSH so the FCM payload can carry notificationId.
    const orderedChannels = [...channels].sort((a, b) => {
      const rank = (c: string) => (c === 'IN_APP' ? 0 : c === 'PUSH' ? 1 : 2);
      return rank(a) - rank(b);
    });
    const metadata = (campaign.metadata ?? {}) as Record<string, unknown>;
    const variables = (metadata.variables ?? {}) as Record<string, string>;
    const brandingCtx = await this.brandedLayout.resolveContext(tenantId);
    const brandingVars = this.brandedLayout.brandingVariables(brandingCtx);
    const mergedVariables = { ...brandingVars, ...variables };
    const attachments = this.parseAttachments(campaign.attachments);
    const imageAttachment = attachments.find((a) => a.type === 'image');
    const pdfAttachment = attachments.find((a) => a.type === 'pdf');
    const rendered = this.renderer.renderAll(
      {
        subject: campaign.subject,
        bodyHtml: campaign.bodyHtml,
        bodyText: campaign.bodyText,
      },
      mergedVariables,
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
      where: {
        tenantId,
        campaignId,
        ...(options?.recipientId ? { id: options.recipientId } : {}),
      },
      skip: options?.recipientId ? 0 : offset,
      take: options?.recipientId ? 1 : limit,
      orderBy: { createdAt: 'asc' },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      for (const channel of orderedChannels) {
        if (
          await this.channelAlreadySucceeded(
            tenantId,
            campaignId,
            recipient.id,
            channel,
          )
        ) {
          continue;
        }

        if (channel === 'SMS') {
          if (!recipient.phone) {
            await this.logDelivery({
              tenantId,
              campaignId,
              recipientId: recipient.id,
              channel,
              status: 'FAILED',
              errorMessage: 'No phone number',
            });
            failedCount++;
            continue;
          }

          const result = await this.sms.send({
            to: recipient.phone,
            message: bodyText ?? subject,
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

        if (channel === 'WHATSAPP') {
          if (!recipient.phone) {
            await this.logDelivery({
              tenantId,
              campaignId,
              recipientId: recipient.id,
              channel,
              status: 'FAILED',
              errorMessage: 'No phone number',
            });
            failedCount++;
            continue;
          }

          const result = await this.whatsapp.send({
            to: recipient.phone,
            body: bodyText ?? subject,
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

          const pushPref = await this.prisma.notificationPreference.findUnique({
            where: {
              tenantId_userId_channel: {
                tenantId,
                userId: recipient.userId,
                channel: 'PUSH',
              },
            },
          });
          if (pushPref && !pushPref.enabled) {
            await this.logDelivery({
              tenantId,
              campaignId,
              recipientId: recipient.id,
              channel,
              status: 'SKIPPED',
              errorMessage: 'User disabled PUSH notifications',
            });
            continue;
          }

          const category = resolvePushCategory({
            triggerKey: String(metadata.trigger ?? ''),
            entityType: String(metadata.entityType ?? ''),
            messageType: String(metadata.messageType ?? ''),
            subject,
            category: String(metadata.pushCategory ?? metadata.category ?? ''),
          });
          if (!isPushCategoryEnabled(pushPref?.settings, category)) {
            await this.logDelivery({
              tenantId,
              campaignId,
              recipientId: recipient.id,
              channel,
              status: 'SKIPPED',
              errorMessage: `User disabled PUSH category: ${category}`,
            });
            continue;
          }

          const devices = await this.prisma.mobileDevice.findMany({
            where: {
              tenantId,
              userId: recipient.userId,
              status: 'ACTIVE',
            },
            select: {
              id: true,
              pushToken: true,
              platform: true,
              appVersion: true,
            },
          });
          const tokens = devices
            .map((d) => d.pushToken)
            .filter((t): t is string => Boolean(t));
          if (!tokens.length) {
            await this.logDelivery({
              tenantId,
              campaignId,
              recipientId: recipient.id,
              channel,
              status: 'FAILED',
              provider: 'fcm',
              errorMessage: devices.length
                ? `No push token on ${devices
                    .map((d) => `${d.platform} ${d.appVersion ?? ''}`.trim())
                    .join(', ')}`
                : 'No mobile app device registered',
              metadata: {
                fcmAccepted: 0,
                fcmRejected: 0,
                devices: devices.map((d) => ({
                  platform: d.platform,
                  appVersion: d.appVersion,
                  hasToken: false,
                })),
              },
            });
            failedCount++;
            continue;
          }
          const inboxRow = await this.prisma.userNotification.findFirst({
            where: {
              tenantId,
              userId: recipient.userId,
              campaignId,
            },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
          });
          const noticeLink =
            typeof metadata.noticeLink === 'string'
              ? metadata.noticeLink.trim()
              : '';
          const pushLink =
            noticeLink ||
            resolveNotificationLink({
              recipientType: recipient.recipientType,
              triggerKey: String(metadata.trigger ?? ''),
              entityType: String(metadata.entityType ?? ''),
            }) ||
            '/student/notifications';
          const result = await this.fcm.sendToTokens(tokens, {
            title: subject,
            body: bodyText ?? subject,
            apnsBundleId: COLLEGE_IOS_BUNDLE_ID,
            imageUrl: imageAttachment
              ? this.toAbsoluteUrl(imageAttachment.url)
              : undefined,
            data: {
              campaignId,
              notificationId: inboxRow?.id ?? '',
              category,
              link: pushLink,
              mobilePath:
                recipient.recipientType === 'STUDENT'
                  ? '/(student)/(tabs)/notifications'
                  : recipient.recipientType === 'STAFF' ||
                      recipient.recipientType === 'FACULTY'
                    ? '/(staff)/(tabs)/notifications'
                    : '',
              imageUrl: imageAttachment
                ? this.toAbsoluteUrl(imageAttachment.url)
                : '',
              pdfUrl: pdfAttachment
                ? this.toAbsoluteUrl(pdfAttachment.url)
                : '',
              fileUrl: (() => {
                const other = attachments.find(
                  (a) => a.type !== 'image' && a.type !== 'pdf',
                );
                return other ? this.toAbsoluteUrl(other.url) : '';
              })(),
              fileName: (() => {
                const other = attachments.find(
                  (a) => a.type !== 'image' && a.type !== 'pdf',
                );
                return other?.name ?? '';
              })(),
              attachments: JSON.stringify(
                attachments.map((a) => ({
                  type: a.type,
                  url: this.toAbsoluteUrl(a.url),
                  name: a.name ?? null,
                })),
              ),
              attachmentCount: String(attachments.length),
            },
          });

          if (result.replacedTokens?.length) {
            for (const swap of result.replacedTokens) {
              await this.prisma.mobileDevice.updateMany({
                where: {
                  tenantId,
                  userId: recipient.userId,
                  pushToken: swap.from,
                },
                data: { pushToken: swap.to },
              });
            }
          }

          if (result.invalidTokens?.length) {
            await this.prisma.mobileDevice.updateMany({
              where: {
                tenantId,
                userId: recipient.userId,
                pushToken: { in: result.invalidTokens },
              },
              data: { pushToken: null },
            });
          }

          const accepted =
            result.successCount ?? (result.ok ? tokens.length : 0);
          const rejected =
            result.failureCount ?? (result.ok ? 0 : tokens.length);
          const outcomeByToken = new Map(
            (result.deliveries ?? []).map((d) => [d.token, d]),
          );
          const deviceRows = devices.map((d) => {
            const outcome = d.pushToken
              ? outcomeByToken.get(d.pushToken.trim())
              : undefined;
            return {
              platform: d.platform,
              appVersion: d.appVersion,
              hasToken: Boolean(d.pushToken),
              accepted: outcome?.accepted ?? false,
              ...(outcome?.error ? { error: outcome.error } : {}),
            };
          });
          const deviceSummary = deviceRows
            .map((d) => {
              const label = `${d.platform} ${d.appVersion ?? ''}`.trim();
              if (!d.hasToken) return `${label}: no push token`;
              if (d.accepted) return `${label}: accepted`;
              return `${label}: rejected${d.error ? ` (${d.error})` : ''}`;
            })
            .join('; ');
          const detail =
            rejected > 0 || deviceRows.some((d) => !d.hasToken)
              ? deviceSummary || result.error
              : result.error;
          await this.logDelivery({
            tenantId,
            campaignId,
            recipientId: recipient.id,
            channel,
            status: result.ok ? 'SENT' : 'FAILED',
            provider: result.provider,
            providerRef: result.providerRef,
            errorMessage: detail || undefined,
            metadata: {
              fcmAccepted: accepted,
              fcmRejected: rejected,
              deviceDeliveryConfirmed: false,
              devices: deviceRows,
            },
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

          const emailAttachments: Array<{
            filename: string;
            path: string;
            contentType?: string;
          }> = [];
          for (const a of attachments) {
            const path = this.attachmentDiskPath(a.url);
            if (!path) continue;
            emailAttachments.push({
              filename: a.name,
              path,
              ...(a.mimeType ? { contentType: a.mimeType } : {}),
            });
          }

          const rawHtml =
            this.appendAttachmentHtml(
              bodyHtml ?? `<p>${bodyText ?? subject}</p>`,
              attachments,
            ) ?? `<p>${bodyText ?? subject}</p>`;
          const brandedHtml = this.brandedLayout.wrap({
            title: subject,
            bodyHtml: rawHtml,
            ctx: brandingCtx,
          });

          const result = await this.email.send({
            to: recipient.email,
            subject,
            html: brandedHtml,
            text: bodyText ?? undefined,
            attachments: emailAttachments,
            fromName: brandingCtx.senderName ?? brandingCtx.institutionName,
            replyTo: brandingCtx.replyEmail,
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

          const existingInbox = await this.prisma.userNotification.findFirst({
            where: {
              tenantId,
              userId: recipient.userId,
              campaignId,
            },
            select: { id: true },
          });
          if (existingInbox) {
            await this.logDelivery({
              tenantId,
              campaignId,
              recipientId: recipient.id,
              channel,
              status: 'DELIVERED',
              provider: 'in_app',
              providerRef: existingInbox.id,
              errorMessage: 'Skipped duplicate in-app notification',
            });
            sentCount++;
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
            metadata: {
              triggerKey,
              recipientType: recipient.recipientType,
              attachments: attachments.map((a) => ({
                ...a,
                url: this.toAbsoluteUrl(a.url),
              })),
              imageUrl: imageAttachment
                ? this.toAbsoluteUrl(imageAttachment.url)
                : null,
              pdfUrl: pdfAttachment
                ? this.toAbsoluteUrl(pdfAttachment.url)
                : null,
            },
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

    const totalRecipients = await this.prisma.communicationRecipient.count({
      where: { tenantId, campaignId },
    });
    const isLastBatch = offset + recipients.length >= totalRecipients;
    const shouldFinalize = options?.finalize !== false;

    if (shouldFinalize && isLastBatch) {
      const current = await this.prisma.communicationCampaign.findFirst({
        where: { id: campaignId, tenantId },
        select: { status: true },
      });
      if (current?.status === 'REVOKED') {
        await this.prisma.userNotification.deleteMany({
          where: { tenantId, campaignId },
        });
      } else if (current?.status !== 'CANCELLED') {
        const anySent = await this.prisma.communicationDeliveryLog.count({
          where: {
            tenantId,
            campaignId,
            status: { in: ['SENT', 'DELIVERED'] },
          },
        });
        await this.prisma.communicationCampaign.update({
          where: { id: campaignId },
          data: {
            status: anySent > 0 ? 'SENT' : 'FAILED',
            sentAt: anySent > 0 ? new Date() : undefined,
          },
        });
      }
    }

    return { sentCount, failedCount, recipientCount: recipients.length };
  }

  async trackOpen(logId: string) {
    const log = await this.prisma.communicationDeliveryLog.findUnique({
      where: { id: logId },
    });
    if (!log || log.openedAt) return;
    await this.prisma.communicationDeliveryLog.update({
      where: { id: logId },
      data: { openedAt: new Date() },
    });
  }

  async trackClick(logId: string) {
    const log = await this.prisma.communicationDeliveryLog.findUnique({
      where: { id: logId },
    });
    if (!log) return;
    await this.prisma.communicationDeliveryLog.update({
      where: { id: logId },
      data: {
        clickedAt: new Date(),
        openedAt: log.openedAt ?? new Date(),
      },
    });
  }

  async logDirectSend(input: {
    tenantId: string;
    channel: string;
    status: string;
    provider?: string;
    providerRef?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.communicationDeliveryLog.create({
      data: {
        tenantId: input.tenantId,
        channel: input.channel,
        status: input.status,
        provider: input.provider,
        providerRef: input.providerRef,
        errorMessage: input.errorMessage,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        sentAt: ['SENT', 'DELIVERED'].includes(input.status)
          ? new Date()
          : undefined,
        deliveredAt: input.status === 'DELIVERED' ? new Date() : undefined,
      },
    });
  }

  private async channelAlreadySucceeded(
    tenantId: string,
    campaignId: string,
    recipientId: string,
    channel: string,
  ) {
    const existing = await this.prisma.communicationDeliveryLog.findFirst({
      where: {
        tenantId,
        campaignId,
        recipientId,
        channel,
        status: { in: ['SENT', 'DELIVERED', 'SKIPPED'] },
      },
      select: { id: true },
    });
    return Boolean(existing);
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
    metadata?: Record<string, unknown>;
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
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        sentAt: ['SENT', 'DELIVERED'].includes(input.status)
          ? new Date()
          : undefined,
        deliveredAt: input.status === 'DELIVERED' ? new Date() : undefined,
      },
    });
  }

  async resendFailed(tenantId: string, campaignId: string) {
    const pairs = await this.prisma.$queryRaw<
      { recipient_id: string; channel: string }[]
    >`
      SELECT DISTINCT l.recipient_id, l.channel
      FROM platform.communication_delivery_logs l
      WHERE l.tenant_id = CAST(${tenantId} AS uuid)
        AND l.campaign_id = CAST(${campaignId} AS uuid)
        AND l.status = 'FAILED'
        AND NOT EXISTS (
          SELECT 1 FROM platform.communication_delivery_logs ok
          WHERE ok.recipient_id = l.recipient_id
            AND ok.campaign_id = l.campaign_id
            AND ok.channel = l.channel
            AND ok.status IN ('SENT', 'DELIVERED')
        )
    `;
    let retried = 0;
    for (const pair of pairs) {
      await this.deliverCampaignBatch(tenantId, campaignId, 0, 1, {
        recipientId: pair.recipient_id,
        channel: pair.channel,
        finalize: false,
      });
      retried++;
    }
    return { retried };
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
