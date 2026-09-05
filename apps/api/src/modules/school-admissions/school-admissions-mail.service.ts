import { existsSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  schoolCredentialsEmailHtml,
  schoolOtpEmailHtml,
  schoolSubmissionEmailHtml,
} from './school-admission-emails';

function schoolLogoPath(): string | undefined {
  const candidates = [
    join(__dirname, 'assets', 'tps-logo.png'),
    join(process.cwd(), 'src/modules/school-admissions/assets/tps-logo.png'),
    join(process.cwd(), 'dist/modules/school-admissions/assets/tps-logo.png'),
  ];
  return candidates.find((path) => existsSync(path));
}

@Injectable()
export class SchoolAdmissionsMailService {
  private readonly logger = new Logger(SchoolAdmissionsMailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(input: {
    to: string;
    schoolName: string;
    childName: string;
    otp: string;
    minutes: number;
  }) {
    const subject = `${input.schoolName} — email verification OTP`;
    return this.send({
      to: input.to,
      subject,
      html: schoolOtpEmailHtml(input),
    });
  }

  async sendCredentials(input: {
    to: string;
    schoolName: string;
    childName: string;
    username: string;
    password: string;
    loginUrl: string;
  }) {
    const subject = `${input.schoolName} — K.G. 2027 admission login details`;
    return this.send({
      to: input.to,
      subject,
      html: schoolCredentialsEmailHtml(input),
    });
  }

  async sendSubmissionPdf(input: {
    to: string;
    schoolName: string;
    childName: string;
    applicationNumber: string;
    submissionDate: string;
    pdfBuffer: Buffer;
    pdfFilename: string;
  }) {
    const subject = `K.G. Admission 2027 – Application Submitted | ${input.applicationNumber}`;
    return this.send({
      to: input.to,
      subject,
      html: schoolSubmissionEmailHtml({
        schoolName: input.schoolName,
        childName: input.childName,
        applicationNumber: input.applicationNumber,
        submissionDate: input.submissionDate,
      }),
      pdfAttachment: {
        filename: input.pdfFilename,
        content: input.pdfBuffer,
      },
    });
  }

  private async send(input: {
    to: string;
    subject: string;
    html: string;
    pdfAttachment?: { filename: string; content: Buffer };
  }) {
    const smtpUser = this.config.get<string>('SCHOOL_SMTP_USER')?.trim();
    const smtpPass = this.config
      .get<string>('SCHOOL_SMTP_PASS')
      ?.replace(/\s+/g, '');
    const smtpHost =
      this.config.get<string>('SCHOOL_SMTP_HOST')?.trim() ||
      'smtp.hostinger.com';
    const smtpPort = Number(this.config.get('SCHOOL_SMTP_PORT') ?? 465);
    const smtpSecureRaw = this.config.get<string>('SCHOOL_SMTP_SECURE');
    const smtpSecure =
      smtpSecureRaw === 'true' ||
      (smtpSecureRaw !== 'false' && smtpPort === 465);

    if (!smtpUser || !smtpPass) {
      this.logger.warn(
        `School SMTP is not configured; email to ${input.to} was not sent`,
      );
      return {
        ok: false,
        error:
          'School email is not configured. Set SCHOOL_SMTP_USER and SCHOOL_SMTP_PASS in the API .env.',
      };
    }

    try {
      const transport = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
      });
      const fromName =
        this.config.get<string>('SCHOOL_SMTP_FROM_NAME')?.trim() ||
        'Tura Public School, Tura';
      const fromAddress =
        this.config.get<string>('SCHOOL_SMTP_FROM')?.trim() ||
        'info@turapublicschool.com';
      const logoPath = schoolLogoPath();
      const attachments: nodemailer.SendMailOptions['attachments'] = [];
      if (logoPath) {
        attachments.push({
          filename: 'tps-logo.png',
          path: logoPath,
          cid: 'tps-logo',
          contentDisposition: 'inline',
        });
      }
      if (input.pdfAttachment) {
        attachments.push({
          filename: input.pdfAttachment.filename,
          content: input.pdfAttachment.content,
          contentType: 'application/pdf',
        });
      }
      const info = await transport.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: input.to,
        replyTo: fromAddress,
        subject: input.subject,
        html: input.html,
        text: input.html.replace(/<[^>]+>/g, ' '),
        attachments: attachments.length ? attachments : undefined,
      });
      return { ok: true, providerRef: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email send failed';
      this.logger.error(message);
      const authFailed =
        /535|BadCredentials|Username and Password not accepted/i.test(message);
      return {
        ok: false,
        error: authFailed
          ? 'The school mailbox login was rejected. Check SCHOOL_SMTP_USER and SCHOOL_SMTP_PASS for Hostinger (smtp.hostinger.com), then restart the API.'
          : 'Could not send the application email. Please try again or contact the school office.',
      };
    }
  }
}
