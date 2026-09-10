import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class SchoolWebMailService {
  private readonly logger = new Logger(SchoolWebMailService.name);

  constructor(private readonly config: ConfigService) {}

  officeAddress() {
    return (
      this.config.get<string>('SCHOOL_WEB_SMTP_FROM')?.trim() ||
      this.config.get<string>('SCHOOL_WEB_SMTP_USER')?.trim() ||
      'admin@stlukestura.in'
    );
  }

  async notifyEnquiry(input: {
    schoolName: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    subject?: string | null;
    message: string;
  }) {
    const topic = input.subject?.trim() || 'Website enquiry';
    const html = `
      <p>A new message was submitted on the ${this.escape(input.schoolName)} website.</p>
      <p><strong>Name:</strong> ${this.escape(input.name)}<br/>
      <strong>Email:</strong> ${this.escape(input.email || '—')}<br/>
      <strong>Phone:</strong> ${this.escape(input.phone || '—')}<br/>
      <strong>Subject:</strong> ${this.escape(topic)}</p>
      <p>${this.escape(input.message).replace(/\n/g, '<br/>')}</p>
    `;
    return this.send({
      to: this.officeAddress(),
      replyTo: input.email?.trim() || undefined,
      subject: `${input.schoolName} — ${topic}`,
      html,
    });
  }

  private escape(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async send(input: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }) {
    const smtpUser = this.config.get<string>('SCHOOL_WEB_SMTP_USER')?.trim();
    const smtpPass = this.config
      .get<string>('SCHOOL_WEB_SMTP_PASS')
      ?.replace(/\s+/g, '');
    const smtpHost =
      this.config.get<string>('SCHOOL_WEB_SMTP_HOST')?.trim() ||
      'smtp.hostinger.com';
    const smtpPort = Number(this.config.get('SCHOOL_WEB_SMTP_PORT') ?? 465);
    const smtpSecureRaw = this.config.get<string>('SCHOOL_WEB_SMTP_SECURE');
    const smtpSecure =
      smtpSecureRaw === 'true' ||
      (smtpSecureRaw !== 'false' && smtpPort === 465);

    if (!smtpUser || !smtpPass) {
      this.logger.warn(
        `St. Luke’s SMTP is not configured; email to ${input.to} was not sent`,
      );
      return { ok: false as const };
    }

    try {
      const transport = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
      });
      const fromName =
        this.config.get<string>('SCHOOL_WEB_SMTP_FROM_NAME')?.trim() ||
        "St. Luke's Secondary School, Tura";
      const fromAddress =
        this.config.get<string>('SCHOOL_WEB_SMTP_FROM')?.trim() || smtpUser;
      const info = await transport.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: input.to,
        replyTo: input.replyTo || fromAddress,
        subject: input.subject,
        html: input.html,
        text: input.html.replace(/<[^>]+>/g, ' '),
      });
      return { ok: true as const, providerRef: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email send failed';
      this.logger.error(message);
      return { ok: false as const };
    }
  }
}
