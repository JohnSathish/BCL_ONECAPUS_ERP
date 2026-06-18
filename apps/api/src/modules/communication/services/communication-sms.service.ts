import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SmsSendResult = {
  ok: boolean;
  provider: string;
  providerRef?: string;
  error?: string;
};

@Injectable()
export class CommunicationSmsService {
  private readonly logger = new Logger(CommunicationSmsService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      this.config.get<string>('SMS_ENABLED') === 'true' &&
      Boolean(this.config.get<string>('SMS_BASE_URL')) &&
      Boolean(this.config.get<string>('SMS_USERNAME')) &&
      Boolean(this.config.get<string>('SMS_PASSWORD'))
    );
  }

  /** Replace DLT `{#var#}` placeholders in order. */
  fillDltTemplate(template: string, variables: string[]): string {
    let i = 0;
    return template.replace(/\{#var#\}/g, () => variables[i++] ?? '');
  }

  async sendAdmissionRegistration(input: {
    mobile: string;
    applicationNumber: string;
    loginUrl: string;
    username: string;
    password: string;
  }): Promise<SmsSendResult> {
    const template =
      this.config.get<string>('SMS_ADMISSIONS_TEMPLATE') ??
      'Dear Applicant, Your Registration for Admission at Don Bosco College Tura is Successful. Your Application No is {#var#} You can login using the Link {#var#} with Username {#var#} and Password {#var#}. Thank You. Management-DBTURA';

    const loginUrl =
      input.loginUrl ||
      this.config.get<string>('SMS_ADMISSIONS_LOGIN_URL') ||
      this.config.get<string>('ADMISSIONS_PORTAL_ORIGIN') ||
      '';

    const message = this.fillDltTemplate(template, [
      input.applicationNumber,
      loginUrl,
      input.username,
      input.password,
    ]);

    return this.send({
      to: input.mobile,
      message,
      templateId: this.config.get<string>('SMS_DLT_TEMPLATE_ID'),
      ctaId: this.config.get<string>('SMS_DLT_CTA_ID'),
    });
  }

  async send(input: {
    to: string;
    message: string;
    templateId?: string;
    ctaId?: string;
  }): Promise<SmsSendResult> {
    if (!this.isConfigured()) {
      this.logger.log(
        `[dev-sms] to=${input.to} msg="${input.message.slice(0, 80)}…"`,
      );
      return {
        ok: true,
        provider: 'dev-log',
        providerRef: `dev-sms-${Date.now()}`,
      };
    }

    const mobile = this.normalizeMobile(input.to);
    if (!mobile) {
      return { ok: false, provider: 'sms', error: 'Invalid mobile number' };
    }

    const baseUrl = this.config.get<string>('SMS_BASE_URL')!.replace(/\/$/, '');
    const params = new URLSearchParams({
      uname: this.config.get<string>('SMS_USERNAME')!,
      pass: this.config.get<string>('SMS_PASSWORD')!,
      send: this.config.get<string>('SMS_SENDER', 'DBTURA'),
      dest: mobile,
      msg: input.message,
      priority: this.config.get<string>('SMS_PRIORITY', '1'),
    });

    const templateId =
      input.templateId ?? this.config.get<string>('SMS_DLT_TEMPLATE_ID');
    if (templateId) params.set('tempid', templateId);

    const ctaId = input.ctaId ?? this.config.get<string>('SMS_DLT_CTA_ID');
    if (ctaId) params.set('ctaid', ctaId);

    const url = `${baseUrl}?${params.toString()}`;

    try {
      const res = await fetch(url, { method: 'GET' });
      const body = (await res.text()).trim();

      if (!res.ok) {
        this.logger.error(`SMS HTTP ${res.status}: ${body}`);
        return {
          ok: false,
          provider: 'sms',
          error: body || `HTTP ${res.status}`,
        };
      }

      const lower = body.toLowerCase();
      if (
        lower.includes('error') ||
        lower.includes('fail') ||
        lower.includes('invalid')
      ) {
        this.logger.error(`SMS provider error: ${body}`);
        return { ok: false, provider: 'sms', error: body };
      }

      return { ok: true, provider: 'sms', providerRef: body.slice(0, 120) };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SMS send failed';
      this.logger.error(message);
      return { ok: false, provider: 'sms', error: message };
    }
  }

  private normalizeMobile(raw: string): string | null {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return null;
  }
}
