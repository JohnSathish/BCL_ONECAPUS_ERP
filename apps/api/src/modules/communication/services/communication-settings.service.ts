import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import type { JwtUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class CommunicationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const row = await this.prisma.communicationSettings.findUnique({
      where: { tenantId },
    });
    return (
      row ?? {
        tenantId,
        defaultSenderName: null,
        replyEmail: null,
        smsSenderId: null,
        whatsappBusinessNumber: null,
        notificationLogoUrl: null,
        footerTemplate: null,
        smtpConfig: {},
        smsConfig: {},
        whatsappConfig: {},
      }
    );
  }

  upsert(user: JwtUser, data: Record<string, unknown>) {
    return this.prisma.communicationSettings.upsert({
      where: { tenantId: user.tid },
      create: {
        tenantId: user.tid,
        defaultSenderName: data.defaultSenderName as string | undefined,
        replyEmail: data.replyEmail as string | undefined,
        smsSenderId: data.smsSenderId as string | undefined,
        whatsappBusinessNumber: data.whatsappBusinessNumber as
          | string
          | undefined,
        notificationLogoUrl: data.notificationLogoUrl as string | undefined,
        footerTemplate: data.footerTemplate as string | undefined,
        smtpConfig: (data.smtpConfig ?? {}) as object,
        smsConfig: (data.smsConfig ?? {}) as object,
        whatsappConfig: (data.whatsappConfig ?? {}) as object,
      },
      update: {
        defaultSenderName: data.defaultSenderName as string | undefined,
        replyEmail: data.replyEmail as string | undefined,
        smsSenderId: data.smsSenderId as string | undefined,
        whatsappBusinessNumber: data.whatsappBusinessNumber as
          | string
          | undefined,
        notificationLogoUrl: data.notificationLogoUrl as string | undefined,
        footerTemplate: data.footerTemplate as string | undefined,
        smtpConfig: data.smtpConfig as object | undefined,
        smsConfig: data.smsConfig as object | undefined,
        whatsappConfig: data.whatsappConfig as object | undefined,
      },
    });
  }
}
