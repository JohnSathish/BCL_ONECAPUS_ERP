import type { BrandedEmailContext } from '../../communication/services/branded-email-layout.service';
import { escapeHtml } from '../../communication/utils/email-template-helpers';
import { buildAdminOtpMessage } from './admin-email-otp.policy';

export function buildAdminOtpEmail(input: {
  ctx: BrandedEmailContext;
  code: string;
  collegeName?: string | null;
  displayName?: string | null;
}) {
  const college =
    input.ctx.institutionName?.trim() &&
    input.ctx.institutionName.trim() !== 'Institution'
      ? input.ctx.institutionName.trim()
      : input.collegeName?.trim() || 'Bosco Connect';
  const product = input.ctx.productName?.trim() || 'Bosco Connect';
  const message = buildAdminOtpMessage({
    code: input.code,
    collegeName: college,
    displayName: input.displayName,
  });
  const who = input.displayName?.trim() || 'Administrator';
  return {
    subject: message.subject,
    text: message.text,
    html: renderHtml({
      ctx: input.ctx,
      college,
      product,
      who,
      code: input.code.trim(),
    }),
    fromName: input.ctx.senderName?.trim() || college,
  };
}

function renderHtml(input: {
  ctx: BrandedEmailContext;
  college: string;
  product: string;
  who: string;
  code: string;
}) {
  const name = escapeHtml(input.college);
  const product = escapeHtml(input.product);
  const who = escapeHtml(input.who);
  const code = escapeHtml(input.code);
  const address = escapeHtml(input.ctx.address || '');
  const website = input.ctx.website?.trim() || '';
  const websiteLabel = escapeHtml(website.replace(/^https?:\/\//, ''));
  const email = escapeHtml(input.ctx.email || '');
  const logo = input.ctx.logoUrl ? escapeHtml(input.ctx.logoUrl) : '';
  const spaced = input.code
    .trim()
    .split('')
    .map((digit) => escapeHtml(digit))
    .join('&nbsp;&nbsp;');

  const contact = [
    website
      ? `<a href="${escapeHtml(website)}" style="color:#dbe7ff;text-decoration:none;">${websiteLabel}</a>`
      : '',
    email
      ? `<a href="mailto:${email}" style="color:#dbe7ff;text-decoration:none;">${email}</a>`
      : '',
  ]
    .filter(Boolean)
    .join(' &nbsp;|&nbsp; ');

  const logoCell = logo
    ? `<img src="${logo}" alt="${name}" width="72" height="72" style="display:block;width:72px;height:72px;border-radius:50%;object-fit:cover;background:#ffffff;border:3px solid #ffffff;" />`
    : `<div style="width:72px;height:72px;border-radius:50%;background:#ffffff;color:#0c2340;font-size:28px;font-weight:700;line-height:72px;text-align:center;font-family:Segoe UI,Arial,sans-serif;">${name.slice(0, 1)}</div>`;

  const assist = email
    ? `<a href="mailto:${email}" style="color:#1e3a8a;font-weight:700;text-decoration:none;">${email}</a>`
    : 'the college IT office';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${product} admin sign-in code</title>
</head>
<body style="margin:0;padding:0;background:#eef3f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${product} admin verification code is ${code}. It expires in 5 minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d7e3f0;">
          <tr>
            <td style="background:#0b3a73;background-image:linear-gradient(90deg,#0b3a73,#1d4ed8);padding:22px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="84" valign="middle">${logoCell}</td>
                  <td valign="middle" style="padding-left:12px;">
                    <div style="font-size:18px;line-height:1.25;font-weight:800;letter-spacing:0.04em;color:#ffffff;text-transform:uppercase;">${name}</div>
                    ${address ? `<div style="margin-top:4px;font-size:12px;line-height:1.4;color:#dbe7ff;">${address}</div>` : ''}
                    ${contact ? `<div style="margin-top:6px;font-size:12px;line-height:1.4;color:#dbe7ff;">${contact}</div>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 8px;background:#eff6ff;border-bottom:1px solid #bfdbfe;">
              <div style="font-size:12px;font-weight:800;letter-spacing:0.12em;color:#1d4ed8;">SIGN-IN VERIFICATION</div>
              <div style="margin-top:4px;font-size:26px;line-height:1.2;font-weight:800;color:#0f172a;">Your admin code</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 6px;font-size:14px;line-height:1.6;color:#334155;">
              <strong style="color:#0f172a;">Hello ${who},</strong><br/>
              Use this code to finish signing in to ${product}. It expires in 5 minutes and can be used once.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 24px 4px;">
              <div style="display:inline-block;background:#f8fafc;border:1px solid #dbe4f0;border-radius:14px;padding:16px 28px;font-size:32px;line-height:1;font-weight:800;letter-spacing:0.18em;color:#0b3a73;font-family:Consolas,Courier New,monospace;">${spaced}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 0;font-size:13px;line-height:1.5;color:#475569;text-align:center;">
              Enter this code on the sign-in screen. Do not share it.
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-radius:12px;">
                <tr>
                  <td style="padding:12px 14px;font-size:13px;line-height:1.5;color:#9a3412;">
                    If you did not try to sign in, ignore this email. The code expires on its own.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-radius:12px;">
                <tr>
                  <td style="padding:12px 14px;font-size:13px;line-height:1.5;color:#312e81;">
                    <strong>Need assistance?</strong><br/>
                    Contact the college IT administration team at ${assist}. Office hours: Mon–Sat, 9:00 AM – 5:00 PM.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 8px;font-size:14px;line-height:1.5;color:#0f172a;">
              Regards,<br/>
              <strong>IT Administration Team</strong><br/>
              <span style="color:#475569;">${name}</span>
            </td>
          </tr>
          <tr>
            <td style="background:#0b3a73;padding:14px 24px;font-size:12px;line-height:1.5;color:#dbe7ff;">
              This is an automated sign-in message. Please do not reply directly to this email.<br/>
              This code is only for your own admin sign-in.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
