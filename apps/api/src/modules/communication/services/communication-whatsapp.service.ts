import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';

export type WhatsAppSendResult = {
  ok: boolean;
  provider: string;
  providerRef?: string;
  error?: string;
};

@Injectable()
export class CommunicationWhatsAppService {
  private readonly logger = new Logger(CommunicationWhatsAppService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('WHATSAPP_ACCESS_TOKEN') &&
      this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID'),
    );
  }

  listTemplates(tenantId: string) {
    return this.prisma.communicationWhatsAppTemplate.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async send(input: {
    to: string;
    body: string;
    templateName?: string;
  }): Promise<WhatsAppSendResult> {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');

    if (!token || !phoneNumberId) {
      this.logger.log(
        `[dev-whatsapp] to=${input.to} body="${input.body.slice(0, 80)}"`,
      );
      return {
        ok: true,
        provider: 'dev-log',
        providerRef: `dev-wa-${Date.now()}`,
      };
    }

    try {
      const phone = input.to.replace(/\D/g, '');
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: input.body },
          }),
        },
      );
      const data = (await res.json()) as {
        messages?: { id: string }[];
        error?: { message: string };
      };
      if (!res.ok) {
        return {
          ok: false,
          provider: 'meta',
          error: data.error?.message ?? 'WhatsApp send failed',
        };
      }
      return {
        ok: true,
        provider: 'meta',
        providerRef: data.messages?.[0]?.id,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'WhatsApp send failed';
      return { ok: false, provider: 'meta', error: message };
    }
  }
}
