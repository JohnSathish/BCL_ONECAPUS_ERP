import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { escapeHtml, sanitizeEmailHtml } from '../utils/email-template-helpers';

export type BrandedEmailContext = {
  institutionName: string;
  tagline: string;
  address: string;
  website: string;
  email: string;
  phone: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  showPoweredBy: boolean;
  customFooterHtml: string | null;
  senderName: string | null;
  replyEmail: string | null;
};

@Injectable()
export class BrandedEmailLayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolveContext(tenantId: string): Promise<BrandedEmailContext> {
    const [branding, settings, domain] = await Promise.all([
      this.prisma.tenantBranding.findUnique({ where: { tenantId } }),
      this.prisma.communicationSettings.findUnique({ where: { tenantId } }),
      this.prisma.tenantDomain.findFirst({
        where: { tenantId, deletedAt: null },
        orderBy: { verified: 'desc' },
      }),
    ]);

    const publicAppUrl =
      this.config.get<string>('PUBLIC_APP_URL') ??
      this.config.get<string>('WEB_APP_URL') ??
      '';
    const website = domain?.host
      ? `https://${domain.host}`
      : publicAppUrl || '';

    const logoRaw =
      settings?.notificationLogoUrl?.trim() ||
      branding?.logoUrl?.trim() ||
      null;
    let logoUrl = logoRaw ? this.toAbsoluteAssetUrl(logoRaw) : null;
    if (!logoUrl) {
      logoUrl = this.defaultLogoUrl();
    }

    const primary =
      branding?.primaryColor?.trim() ||
      branding?.accentColor?.trim() ||
      '#1d4ed8';
    const accent = branding?.accentColor?.trim() || primary;

    return {
      institutionName:
        branding?.displayName?.trim() ||
        branding?.shortName?.trim() ||
        'Institution',
      tagline:
        branding?.portalSubtitle?.trim() ||
        branding?.campusName?.trim() ||
        'Official ERP Communication',
      address: branding?.address?.trim() || '',
      website,
      email: settings?.replyEmail?.trim() || '',
      phone: '',
      logoUrl,
      primaryColor: primary,
      accentColor: accent,
      showPoweredBy: branding?.showPoweredBy ?? true,
      customFooterHtml: settings?.footerTemplate?.trim() || null,
      senderName: settings?.defaultSenderName?.trim() || null,
      replyEmail: settings?.replyEmail?.trim() || null,
    };
  }

  brandingVariables(ctx: BrandedEmailContext): Record<string, string> {
    return {
      institution_name: ctx.institutionName,
      institution_address: ctx.address,
      institution_website: ctx.website,
      institution_email: ctx.email,
      institution_phone: ctx.phone,
      institution_tagline: ctx.tagline,
    };
  }

  wrap(input: {
    title: string;
    bodyHtml: string;
    ctx: BrandedEmailContext;
  }): string {
    const title = escapeHtml(input.title || 'Notification');
    const body = sanitizeEmailHtml(input.bodyHtml || '');
    const name = escapeHtml(input.ctx.institutionName);
    const tagline = escapeHtml(input.ctx.tagline);
    const address = escapeHtml(input.ctx.address);
    const website = escapeHtml(input.ctx.website);
    const email = escapeHtml(input.ctx.email);
    const phone = escapeHtml(input.ctx.phone);
    const primary = escapeHtml(input.ctx.primaryColor);
    const accent = escapeHtml(input.ctx.accentColor);
    const logo = input.ctx.logoUrl ? escapeHtml(input.ctx.logoUrl) : null;
    const customFooter = input.ctx.customFooterHtml
      ? sanitizeEmailHtml(input.ctx.customFooterHtml)
      : '';

    const logoBlock = logo
      ? `<img src="${logo}" alt="${name}" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:12px;object-fit:contain;background:#ffffff;border:0;" />`
      : `<div style="width:64px;height:64px;border-radius:12px;background:rgba(255,255,255,0.2);color:#ffffff;font-size:22px;font-weight:700;line-height:64px;text-align:center;font-family:Segoe UI,Arial,sans-serif;">${name.slice(0, 1)}</div>`;

    const contactBits = [
      address,
      phone ? `Phone: ${phone}` : '',
      email ? `Email: ${email}` : '',
      website
        ? `Website: <a href="${website}" style="color:#94a3b8;text-decoration:underline;">${website.replace(/^https?:\/\//, '')}</a>`
        : '',
    ]
      .filter(Boolean)
      .join('<br/>');

    const poweredBy = input.ctx.showPoweredBy
      ? `<p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;">
          Powered by <a href="https://basecodelabs.com" style="color:#64748b;text-decoration:none;font-weight:600;">BaseCode Labs Pvt. Ltd.</a><br/>
          <a href="https://basecodelabs.com" style="color:#94a3b8;text-decoration:underline;">basecodelabs.com</a>
          · <a href="mailto:contact@basecodelabs.com" style="color:#94a3b8;text-decoration:underline;">contact@basecodelabs.com</a>
        </p>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light dark"/>
  <meta name="supported-color-schemes" content="light dark"/>
  <title>${title}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .email-shell { background:#0f172a !important; }
      .email-card { background:#1e293b !important; }
      .email-body, .email-body p, .email-body td { color:#e2e8f0 !important; }
      .email-footer { background:#0b1220 !important; color:#94a3b8 !important; }
      .email-title { color:#f8fafc !important; }
    }
    @media only screen and (max-width: 620px) {
      .email-container { width:100% !important; }
      .email-pad { padding:20px 16px !important; }
    }
  </style>
</head>
<body class="email-shell" style="margin:0;padding:0;background:#eef2f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef2f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);" bgcolor="#ffffff">
          <tr>
            <td style="background:${primary};padding:22px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="72" valign="middle">${logoBlock}</td>
                  <td valign="middle" style="padding-left:14px;">
                    <div style="font-size:18px;font-weight:700;color:#ffffff;line-height:1.3;">${name}</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:4px;">${tagline}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-card email-pad" style="padding:28px 32px 8px;background:#ffffff;">
              <h1 class="email-title" style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:700;">${title}</h1>
              <div class="email-body" style="font-size:15px;line-height:1.65;color:#334155;">
                ${body}
              </div>
            </td>
          </tr>
          <tr>
            <td class="email-footer email-pad" style="padding:22px 32px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48" valign="top">
                    ${
                      logo
                        ? `<img src="${logo}" alt="${name}" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:8px;object-fit:contain;"/>`
                        : ''
                    }
                  </td>
                  <td valign="top" style="padding-left:10px;font-size:12px;line-height:1.6;color:#64748b;">
                    <strong style="color:#334155;">${name}</strong><br/>
                    ${contactBits || 'Official campus communication'}
                    ${customFooter ? `<div style="margin-top:10px;">${customFooter}</div>` : ''}
                    ${poweredBy}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async wrapForTenant(
    tenantId: string,
    input: { title: string; bodyHtml: string },
  ): Promise<{ html: string; ctx: BrandedEmailContext }> {
    const ctx = await this.resolveContext(tenantId);
    return {
      html: this.wrap({ title: input.title, bodyHtml: input.bodyHtml, ctx }),
      ctx,
    };
  }

  private appWebOrigin(): string {
    return (
      this.config.get<string>('PUBLIC_APP_URL') ??
      this.config.get<string>('WEB_APP_URL') ??
      ''
    ).replace(/\/$/, '');
  }

  private appApiOrigin(): string {
    return (
      this.config.get<string>('PUBLIC_API_URL') ??
      this.config.get<string>('API_PUBLIC_URL') ??
      this.appWebOrigin()
    ).replace(/\/$/, '');
  }

  /** Bundled college crest served from the web app public folder. */
  private defaultLogoUrl(): string | null {
    const web = this.appWebOrigin();
    return web ? `${web}/branding/college-logo.png` : null;
  }

  private toAbsoluteAssetUrl(url: string): string {
    if (/^https?:\/\//i.test(url)) return url;
    const normalized = url.startsWith('/') ? url : `/${url}`;
    if (normalized.startsWith('/branding/')) {
      const web = this.appWebOrigin();
      if (web) return `${web}${normalized}`;
    }
    const base = this.appApiOrigin();
    if (!base) return url;
    return `${base}${normalized}`;
  }

  /** @deprecated Use toAbsoluteAssetUrl */
  private toAbsoluteUrl(url: string): string {
    return this.toAbsoluteAssetUrl(url);
  }
}
