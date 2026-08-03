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
    const settings = (pref?.settings ?? {}) as Record<string, unknown>;
    if (settings.principalMail === false) return;

    const link = `/principal-desk/communication-hub/messages/${input.messageId}`;
    await this.notifications.createInApp({
      tenantId: input.tenantId,
      userId: input.userId,
      type: 'PRINCIPAL_MAIL',
      title: `New Email · ${input.category}`,
      body: `${input.from}: ${input.subject || '(no subject)'}`,
      link,
      metadata: { messageId: input.messageId, category: input.category },
    });

    if (!this.fcm.isConfigured()) return;

    const devices = await this.prisma.mobileDevice.findMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        status: 'ACTIVE',
        pushToken: { not: null },
      },
      select: { pushToken: true },
      take: 20,
    });
    const tokens = devices
      .map((d) => d.pushToken)
      .filter((t): t is string => Boolean(t));
    if (!tokens.length) return;

    try {
      await this.fcm.sendToTokens(tokens, {
        title: 'New Email',
        body: `${input.category}: ${input.subject || '(no subject)'}`,
        data: {
          type: 'PRINCIPAL_MAIL',
          link,
          messageId: input.messageId,
        },
      });
    } catch (err) {
      this.logger.warn(`FCM send failed: ${(err as Error).message}`);
    }
  }
}
