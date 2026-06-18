import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommunicationEmailService } from '../communication/services/communication-email.service';
import type { DemoRequestDto } from './dto/demo-request.dto';

@Injectable()
export class DemoRequestService {
  constructor(
    private readonly email: CommunicationEmailService,
    private readonly config: ConfigService,
  ) {}

  async submit(dto: DemoRequestDto) {
    const recipients = this.config
      .get<string>('DEMO_REQUEST_NOTIFY_TO')
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [
      'contact@basecodelabs.com',
      'johnsathish16@gmail.com',
    ];

    const subject = `OneCampus ERP demo request — ${dto.institution}`;
    const text = [
      'New demo / contact request from the OneCampus landing page',
      '',
      `Name: ${dto.fullName}`,
      `Institution: ${dto.institution}`,
      `Email: ${dto.email}`,
      `Phone: ${dto.phone}`,
      dto.city ? `City: ${dto.city}` : null,
      dto.message ? `Message:\n${dto.message}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <h2>OneCampus ERP — demo request</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
        <tr><td style="padding:6px 12px;font-weight:600">Name</td><td style="padding:6px 12px">${escapeHtml(dto.fullName)}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:600">Institution</td><td style="padding:6px 12px">${escapeHtml(dto.institution)}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:600">Email</td><td style="padding:6px 12px"><a href="mailto:${escapeHtml(dto.email)}">${escapeHtml(dto.email)}</a></td></tr>
        <tr><td style="padding:6px 12px;font-weight:600">Phone</td><td style="padding:6px 12px"><a href="tel:${escapeHtml(dto.phone)}">${escapeHtml(dto.phone)}</a></td></tr>
        ${dto.city ? `<tr><td style="padding:6px 12px;font-weight:600">City</td><td style="padding:6px 12px">${escapeHtml(dto.city)}</td></tr>` : ''}
      </table>
      ${dto.message ? `<p style="margin-top:16px"><strong>Message</strong></p><p style="white-space:pre-wrap">${escapeHtml(dto.message)}</p>` : ''}
    `;

    const results = await Promise.all(
      recipients.map((to) => this.email.send({ to, subject, html, text })),
    );

    const sent = results.some((r) => r.ok);
    return {
      accepted: true,
      notified: sent,
      deliveryMode: results[0]?.provider ?? 'unknown',
    };
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
