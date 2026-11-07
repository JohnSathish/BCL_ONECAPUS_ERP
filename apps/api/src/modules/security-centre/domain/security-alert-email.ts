import type { BrandedEmailContext } from '../../communication/services/branded-email-layout.service';
import { escapeHtml } from '../../communication/utils/email-template-helpers';
import { maskSecurityIdentifier } from './redact-security-payload';
import type { ThreatFinding } from './threat-rules';

export type SecurityAlertEmailFacts = {
  detectedAt: Date;
  ipAddress?: string | null;
  account?: string | null;
  lockExpiresAt?: Date | null;
  securityCentreUrl?: string | null;
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#b91c1c',
  HIGH: '#c2410c',
  MEDIUM: '#ea580c',
  LOW: '#0369a1',
};

export function buildSecurityAlertEmail(input: {
  ctx: BrandedEmailContext;
  finding: ThreatFinding;
  facts: SecurityAlertEmailFacts;
}): { subject: string; text: string; html: string } {
  const college = input.ctx.institutionName || 'the college';
  const severity = input.finding.severity.toUpperCase();
  const severityLabel = severity.charAt(0) + severity.slice(1).toLowerCase();
  const locked = input.finding.ruleCode === 'ACCOUNT_LOCKOUT';
  const status = locked ? 'Temporarily Locked' : 'Open';
  const detected = formatWhen(input.facts.detectedAt);
  const expiry = input.facts.lockExpiresAt
    ? formatWhen(input.facts.lockExpiresAt)
    : null;
  const account = maskSecurityIdentifier(input.facts.account);
  const ip = maskIp(input.facts.ipAddress);
  const guidance = guidanceFor(input.finding.ruleCode, input.finding.summary);
  const subject = `[${severity}] ${input.finding.title}`;
  const reviewUrl = input.facts.securityCentreUrl?.trim() || '';

  const text = [
    `${college} — Security alert`,
    input.finding.title,
    `Severity: ${severityLabel}`,
    '',
    'Dear Administrator,',
    '',
    guidance.intro.replaceAll('{college}', college),
    '',
    `Institution: ${college}`,
    `Alert type: ${input.finding.title}`,
    `Severity: ${severityLabel}`,
    `Status: ${status}`,
    `Trigger: ${guidance.trigger}`,
    `Detection time: ${detected}`,
    `Account: ${account}`,
    `IP address: ${ip}`,
    expiry ? `Lock expiry: ${expiry}` : '',
    '',
    guidance.why,
    '',
    ...guidance.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'This notice does not include passwords, access tokens, or student records.',
    'Please do not reply directly to this email.',
  ]
    .filter((line) => line !== '')
    .join('\n');

  const rows: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: 'Institution', value: college },
    { label: 'Alert type', value: input.finding.title },
    { label: 'Severity', value: severityLabel, highlight: true },
    { label: 'Status', value: status },
    { label: 'Trigger', value: guidance.trigger },
    { label: 'Detection time', value: detected },
    { label: 'Account', value: account },
    { label: 'IP address', value: ip },
  ];
  if (expiry)
    rows.push({ label: 'Lock expiry', value: expiry, highlight: true });

  const html = renderHtml({
    ctx: input.ctx,
    title: input.finding.title,
    severityLabel,
    severityColor: SEVERITY_COLOR[severity] ?? '#ea580c',
    intro: guidance.intro.replaceAll('{college}', college),
    why: guidance.why,
    steps: guidance.steps,
    rows,
    statusLocked: locked,
    reviewUrl,
  });

  return { subject, text, html };
}

function guidanceFor(ruleCode: string, summary: string) {
  if (ruleCode === 'ACCOUNT_LOCKOUT') {
    return {
      intro:
        'We detected multiple unsuccessful sign-in attempts on a {college} account. As a precaution, sign-in for that account is temporarily paused.',
      trigger: 'Multiple failed sign-in attempts',
      why: 'The account was temporarily locked because too many unsuccessful sign-in attempts were recorded in a short period. This blocks password guessing. The lock expires on its own.',
      steps: [
        'Wait until the temporary lock expires automatically.',
        'Do not keep trying to sign in during the lock period.',
        'After the lock ends, use Forgot Password if the password is forgotten.',
        'Review the account in Security Centre before clearing the lock.',
        'If these attempts are not recognised, contact the account holder and the IT team.',
      ],
    };
  }
  return {
    intro: `Security Centre recorded an alert for {college}. ${summary}`,
    trigger: summary,
    why: summary,
    steps: [
      'Open Security Centre and review the alert.',
      'Confirm the account and address against recent sign-in activity.',
      'Do not share passwords, one-time codes, or this notice outside the administration team.',
      'Acknowledge the alert after the review is recorded.',
    ],
  };
}

function renderHtml(input: {
  ctx: BrandedEmailContext;
  title: string;
  severityLabel: string;
  severityColor: string;
  intro: string;
  why: string;
  steps: string[];
  rows: Array<{ label: string; value: string; highlight?: boolean }>;
  statusLocked: boolean;
  reviewUrl: string;
}) {
  const name = escapeHtml(input.ctx.institutionName || 'College');
  const address = escapeHtml(input.ctx.address || '');
  const website = input.ctx.website?.trim() || '';
  const websiteLabel = escapeHtml(website.replace(/^https?:\/\//, ''));
  const email = escapeHtml(input.ctx.email || '');
  const logo = input.ctx.logoUrl ? escapeHtml(input.ctx.logoUrl) : '';
  const title = escapeHtml(input.title);
  const severity = escapeHtml(input.severityLabel);
  const intro = escapeHtml(input.intro);
  const why = escapeHtml(input.why);

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

  const detailRows = input.rows
    .map((row) => {
      const label = escapeHtml(row.label);
      const value = escapeHtml(row.value);
      const valueCell =
        row.label === 'Severity'
          ? `<span style="display:inline-block;background:${input.severityColor};color:#ffffff;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;">${value}</span>`
          : row.label === 'Status' && input.statusLocked
            ? `<span style="display:inline-block;background:#ffe4e6;color:#be123c;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;">${value}</span>`
            : value;
      const bg = row.label === 'Lock expiry' ? '#fef9c3' : '#ffffff';
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e8eef6;width:42%;font-size:13px;color:#475569;background:#f8fafc;">${label}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e8eef6;font-size:13px;color:#0f172a;font-weight:600;background:${bg};">${valueCell}</td>
      </tr>`;
    })
    .join('');

  const steps = input.steps
    .map(
      (step, index) => `<tr>
        <td width="28" valign="top" style="padding:0 0 8px;">
          <div style="width:22px;height:22px;border-radius:50%;background:#2563eb;color:#ffffff;font-size:12px;font-weight:700;line-height:22px;text-align:center;font-family:Segoe UI,Arial,sans-serif;">${index + 1}</div>
        </td>
        <td valign="top" style="padding:1px 0 8px;font-size:13px;line-height:1.45;color:#1e3a5f;">${escapeHtml(step)}</td>
      </tr>`,
    )
    .join('');

  const review = input.reviewUrl
    ? `<tr><td style="padding:8px 28px 0;">
        <a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;background:#0c4a6e;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;border-radius:8px;padding:10px 16px;">Open Security Centre</a>
      </td></tr>`
    : '';

  const assistEmail = email
    ? `<a href="mailto:${email}" style="color:#312e81;text-decoration:none;font-weight:700;">${email}</a>`
    : 'the college IT office';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#eef3f9;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${title} — ${name}</div>
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
            <td style="padding:18px 24px 8px;background:#fff7ed;border-bottom:1px solid #fed7aa;">
              <div style="font-size:12px;font-weight:800;letter-spacing:0.12em;color:#ea580c;">SECURITY ALERT</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:26px;line-height:1.2;font-weight:800;color:#0f172a;padding-top:4px;">${title}</td>
                  <td width="92" align="right" valign="middle">
                    <div style="display:inline-block;background:${input.severityColor};color:#ffffff;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:800;letter-spacing:0.06em;">${severity}</div>
                    <div style="margin-top:4px;font-size:10px;color:#9a3412;text-align:right;">Security level</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 6px;font-size:14px;line-height:1.6;color:#334155;">
              <strong style="color:#0f172a;">Dear Administrator,</strong><br/>
              ${intro}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top" style="padding-right:10px;">
                    <div style="background:#0b3a73;color:#ffffff;font-size:14px;font-weight:700;border-radius:10px 10px 0 0;padding:10px 12px;">Account security details</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe4f0;border-top:0;border-radius:0 0 10px 10px;">
                      ${detailRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff1f2;border:1px solid #fecdd3;border-radius:12px;">
                <tr>
                  <td style="padding:12px 14px;font-size:13px;line-height:1.5;color:#9f1239;">
                    <strong style="font-size:14px;">Why was this account flagged?</strong><br/>
                    ${why}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;">
                <tr>
                  <td style="padding:12px 14px;">
                    <div style="font-size:14px;font-weight:700;color:#1e3a8a;margin-bottom:8px;">What should you do now?</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${steps}</table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${review}
          <tr>
            <td style="padding:14px 24px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border-radius:12px;">
                <tr>
                  <td style="padding:12px 14px;font-size:12px;line-height:1.45;color:#065f46;">
                    <strong style="color:#047857;">Security recommendations</strong><br/>
                    Never share a password or one-time code. Use a strong unique password. Sign out on shared computers. Report sign-ins you do not recognise.
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
                    Contact the college IT administration team at ${assistEmail}. Office hours: Mon–Sat, 9:00 AM – 5:00 PM.
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
              This is an automated security notification. Please do not reply directly to this email.<br/>
              This notice does not include passwords, access tokens, or student records.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatWhen(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(value);
}

function maskIp(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  if (!raw) return 'Not recorded';
  const parts = raw.split('.');
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part))) {
    return `${parts[0]}.${parts[1]}.XXX.XXX`;
  }
  if (raw.includes(':')) return `${raw.split(':')[0]}:XXXX`;
  return 'Recorded';
}
