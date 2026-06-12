import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class CommunicationEmailService {
  private readonly logger = new Logger(CommunicationEmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
  }): Promise<{
    ok: boolean;
    provider: string;
    providerRef?: string;
    error?: string;
  }> {
    const smtpHost = this.config.get<string>('SMTP_HOST');

    if (!smtpHost) {
      this.logger.log(`[dev-email] to=${input.to} subject="${input.subject}"`);
      return {
        ok: true,
        provider: 'dev-log',
        providerRef: `dev-${Date.now()}`,
      };
    }

    try {
      const transport = nodemailer.createTransport({
        host: smtpHost,
        port: Number(this.config.get('SMTP_PORT', 587)),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: this.config.get('SMTP_USER')
          ? {
              user: this.config.get('SMTP_USER'),
              pass: this.config.get('SMTP_PASS'),
            }
          : undefined,
      });

      const from = this.config.get<string>('SMTP_FROM', 'noreply@demo.edu');
      const info = await transport.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? input.html?.replace(/<[^>]+>/g, ' '),
      });

      return { ok: true, provider: 'smtp', providerRef: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email send failed';
      this.logger.error(message);
      return { ok: false, provider: 'smtp', error: message };
    }
  }
}
