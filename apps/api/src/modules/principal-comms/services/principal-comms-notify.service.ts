import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { FcmPushService } from '../../communication/services/fcm-push.service';
import { UserNotificationsService } from '../../communication/services/user-notifications.service';

@Injectable()
export class PrincipalCommsNotifyService {
  private readonly logger = new Logger(PrincipalCommsNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: UserNotificationsService,
    private readonly fcm: FcmPushService,
  ) {}

  async notifyNewMail(input: {
    tenantId: string;
    userId: string;
    messageId: string;
    subject: string;
    from: string;
    category: string;
    googleEmail?: string;
  }) {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        tenantId_userId_channel: {
          tenantId: input.tenantId,
          userId: input.userId,
          channel: 'PUSH',
        },
      },
    });
    // Default ON. Only skip when user explicitly disabled principal mail or whole PUSH channel.
    const settings = (pref?.settings ?? {}) as Record<string, unknown>;
    if (pref && pref.enabled === false) return;
    if (settings.principalMail === false) return;

    const webLink = `/principal-desk/communication-hub/messages/${input.messageId}`;
    const title = 'New Email';
    const body = `${input.from}: ${input.subject || '(no subject)'}`;
    const categoryLabel = input.category || 'Mail';

    await this.notifications.createInApp({
      tenantId: input.tenantId,
      userId: input.userId,
      type: 'PRINCIPAL_MAIL',
      title: `New Email · ${categoryLabel}`,
      body,
      link: webLink,
      metadata: {
        messageId: input.messageId,
        category: categoryLabel,
        googleEmail: input.googleEmail ?? null,
        mobilePath: `/(principal)/mail/${input.messageId}`,
      },
    });

    if (!this.fcm.isConfigured()) {
      this.logger.warn(
        'FCM not configured — in-app new-mail alert created, push skipped',
      );
      return;
    }

    const devices = await this.prisma.mobileDevice.findMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        status: 'ACTIVE',
        pushToken: { not: null },
      },
      select: { pushToken: true, platform: true },
      take: 20,
    });
    const tokens = devices
      .map((d) => d.pushToken)
      .filter((t): t is string => Boolean(t));
    if (!tokens.length) {
      this.logger.warn(
        `No active push tokens for principal user ${input.userId} — in-app only`,
      );
      return;
    }

    try {
      const result = await this.fcm.sendToTokens(tokens, {
        title,
        body: `${categoryLabel}: ${input.subject || '(no subject)'}`,
        data: {
          type: 'PRINCIPAL_MAIL',
          link: webLink,
          messageId: input.messageId,
          category: categoryLabel,
          mobilePath: `/(principal)/mail/${input.messageId}`,
        },
      });
      if (!result.ok) {
        this.logger.warn(
          `FCM new-mail send incomplete: ${result.error ?? 'unknown'}`,
        );
      } else {
        this.logger.log(
          `New-mail push sent (${result.successCount ?? tokens.length}) for ${input.messageId}`,
        );
      }
    } catch (err) {
      this.logger.warn(`FCM send failed: ${(err as Error).message}`);
    }
  }
}
