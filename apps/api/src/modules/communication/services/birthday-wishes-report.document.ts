import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import puppeteer from 'puppeteer';
import { resolvePublicUploadFsPath } from '../../../common/uploads/upload-paths';

export type BirthdayReportRow = {
  recipientName: string | null;
  category: string;
  channel: string | null;
  status: string | null;
  sentAt: string | null;
  sentBy: string | null;
  failureReason?: string | null;
};

const IST = 'Asia/Kolkata';

export function formatReportIst(
  value: string | Date | null | undefined,
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const period = pick('dayPeriod').toUpperCase();
  return `${pick('day')} ${pick('month')} ${pick('year')}, ${pick('hour')}:${pick('minute')}:${pick('second')} ${period}`;
}

export function normalizeReportStatus(
  status: string | null | undefined,
): string {
  const value = (status ?? '').trim().toUpperCase();
  if (!value) return 'UNKNOWN';
  if (value.includes('FAIL')) return 'FAILED';
  if (value.includes('DELIVER')) return 'DELIVERED';
  if (value.includes('SENT') || value === 'SUCCESS' || value === 'OK')
    return 'SENT';
  return value;
}

function channelKey(channel: string | null | undefined) {
  return (channel ?? '').trim().toUpperCase();
}

function isStudent(row: BirthdayReportRow) {
  return row.category.toLowerCase() === 'student';
}

function isStaff(row: BirthdayReportRow) {
  const category = row.category.toLowerCase();
  return category === 'staff' || category === 'faculty';
}

export function summarizeBirthdayReport(rows: BirthdayReportRow[]) {
  const people = new Set<string>();
  const students = new Set<string>();
  const staff = new Set<string>();
  let emailSent = 0;
  let pushSent = 0;
  let pushFailed = 0;
  let inAppDelivered = 0;
  let successful = 0;
  let failed = 0;
  for (const row of rows) {
    const name = (row.recipientName ?? 'Unknown').trim();
    people.add(`${row.category}:${name}`);
    if (isStudent(row)) students.add(name);
    if (isStaff(row)) staff.add(name);
    const status = normalizeReportStatus(row.status);
    const channel = channelKey(row.channel);
    if (status === 'FAILED') failed += 1;
    else if (status === 'SENT' || status === 'DELIVERED') successful += 1;
    if (channel === 'EMAIL' && status === 'SENT') emailSent += 1;
    if (channel === 'PUSH' && status === 'SENT') pushSent += 1;
    if (channel === 'PUSH' && status === 'FAILED') pushFailed += 1;
    if (channel === 'IN_APP' && (status === 'DELIVERED' || status === 'SENT')) {
      inAppDelivered += 1;
    }
  }
  const modes = new Set(
    rows.map((row) => {
      const sentBy = (row.sentBy ?? '').trim().toLowerCase();
      if (sentBy.includes('manual')) return 'Manual';
      return 'Automatic';
    }),
  );
  const sendingMode =
    modes.size === 0 ? '—' : modes.size === 1 ? [...modes][0] : 'Mixed';
  return {
    recipients: people.size,
    records: rows.length,
    students: students.size,
    staff: staff.size,
    emailSent,
    pushSent,
    pushFailed,
    inAppDelivered,
    successful,
    failed,
    sendingMode,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function channelLabel(channel: string | null | undefined) {
  const key = channelKey(channel);
  if (key === 'IN_APP') return 'In-App';
  if (key === 'EMAIL') return 'Email';
  if (key === 'PUSH') return 'Push';
  if (key === 'WHATSAPP') return 'WhatsApp';
  return key || '—';
}

function channelTone(channel: string | null | undefined) {
  const key = channelKey(channel);
  if (key === 'EMAIL') return 'email';
  if (key === 'PUSH') return 'push';
  if (key === 'IN_APP') return 'inapp';
  if (key === 'WHATSAPP') return 'whatsapp';
  return 'muted';
}

function statusTone(status: string) {
  if (status === 'FAILED') return 'failed';
  if (status === 'DELIVERED') return 'delivered';
  if (status === 'SENT') return 'sent';
  return 'muted';
}

function breakdown(summary: ReturnType<typeof summarizeBirthdayReport>) {
  const people = `${summary.students} student${summary.students === 1 ? '' : 's'} and ${summary.staff} staff member${summary.staff === 1 ? '' : 's'}`;
  const channels = [
    summary.emailSent ? `${summary.emailSent} email SENT` : null,
    summary.pushSent ? `${summary.pushSent} push SENT` : null,
    summary.pushFailed ? `${summary.pushFailed} push FAILED` : null,
    summary.inAppDelivered
      ? `${summary.inAppDelivered} in-app DELIVERED`
      : null,
  ].filter(Boolean);
  const outcome = `${summary.successful} notification${summary.successful === 1 ? '' : 's'} succeeded and ${summary.failed} failed.`;
  const detail = channels.length ? ` ${channels.join(', ')}.` : '';
  const review = summary.failed
    ? ' Failed notifications should be reviewed.'
    : '';
  return `Recipient breakdown: ${people}. ${outcome}${detail}${review}`;
}

function sectionTable(title: string, rows: BirthdayReportRow[]) {
  const body = rows.length
    ? rows
        .map((row, index) => {
          const status = normalizeReportStatus(row.status);
          const reason = row.failureReason?.trim();
          return `<tr>
            <td class="num">${index + 1}</td>
            <td>
              <div class="name">${escapeHtml(row.recipientName?.trim() || '—')}</div>
              ${reason && status === 'FAILED' ? `<div class="reason">${escapeHtml(reason)}</div>` : ''}
            </td>
            <td><span class="badge ${channelTone(row.channel)}">${escapeHtml(channelLabel(row.channel))}</span></td>
            <td><span class="badge ${statusTone(status)}">${escapeHtml(status)}</span></td>
            <td>${escapeHtml(row.sentBy?.trim() || '—')}</td>
            <td class="when">${escapeHtml(formatReportIst(row.sentAt))}</td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="6" class="empty">No ${escapeHtml(title.toLowerCase())} were recorded for this report.</td></tr>`;
  return `<section>
    <h2>${escapeHtml(title)} <span>${rows.length} record${rows.length === 1 ? '' : 's'}</span></h2>
    <table>
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Recipient</th>
          <th>Channel</th>
          <th>Status</th>
          <th>Sent via</th>
          <th>Date &amp; time (IST)</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </section>`;
}

export function buildBirthdayWishesReportHtml(input: {
  collegeName: string;
  logoDataUri: string | null;
  rows: BirthdayReportRow[];
  generatedAt: Date;
}): string {
  const summary = summarizeBirthdayReport(input.rows);
  const generated = formatReportIst(input.generatedAt);
  const college = escapeHtml(
    input.collegeName.trim() || 'Don Bosco College, Tura',
  );
  const students = input.rows.filter(isStudent);
  const staff = input.rows.filter(isStaff);
  const other = input.rows.filter((row) => !isStudent(row) && !isStaff(row));
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; }
    h1 { margin: 0; font-size: 22px; color: #0f2744; letter-spacing: -0.02em; }
    .kicker { margin: 0 0 4px; color: #9f1239; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
    .accent { height: 4px; width: 148px; margin: 8px 0 12px; border-radius: 99px; background: linear-gradient(90deg, #9f1239, #eab308 55%, #0f2744); }
    .meta { margin: 0 0 14px; color: #475569; }
    .cards { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 0 0 10px; }
    .card { border: 1px solid #e2e8f0; border-radius: 10px; text-align: center; padding: 10px 4px 8px; background: #fff; }
    .card strong { display: block; font-size: 22px; line-height: 1; color: #0f2744; }
    .card span { display: block; margin-top: 6px; color: #64748b; font-size: 9px; line-height: 1.3; }
    .card.fail { background: #fff1f2; border-color: #fecdd3; }
    .card.fail strong { color: #be123c; }
    .card.ok strong { color: #047857; }
    .note { margin: 0 0 18px; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; color: #334155; line-height: 1.45; }
    section { margin: 0 0 18px; }
    h2 { margin: 0 0 8px; color: #0f2744; font-size: 14px; page-break-after: avoid; }
    h2 span { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 999px; background: #fff7ed; color: #9a3412; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    th { background: #0f2744; color: #fff; text-align: left; padding: 7px 8px; font-size: 10px; font-weight: 600; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .num { width: 28px; text-align: right; color: #64748b; }
    th.num { text-align: right; }
    .name { font-weight: 600; }
    .reason { margin-top: 2px; color: #be123c; font-size: 9px; }
    .when { white-space: nowrap; }
    .empty { text-align: center; color: #64748b; padding: 14px 8px; }
    .badge { display: inline-block; min-width: 68px; border-radius: 999px; padding: 2px 8px; font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-align: center; }
    .email { background: #dbeafe; color: #1d4ed8; }
    .push { background: #ede9fe; color: #6d28d9; }
    .inapp { background: #ffedd5; color: #c2410c; }
    .whatsapp { background: #dcfce7; color: #15803d; }
    .sent { background: #dcfce7; color: #166534; }
    .delivered { background: #ccfbf1; color: #0f766e; }
    .failed { background: #ffe4e6; color: #be123c; }
    .muted { background: #e2e8f0; color: #334155; }
  </style>
</head>
<body>
  <p class="kicker">Birthday wishes</p>
  <h1>Birthday Wishes Delivery Report</h1>
  <div class="accent"></div>
  <p class="meta">Report date: ${escapeHtml(generated)} &nbsp;|&nbsp; Sending mode: ${escapeHtml(summary.sendingMode)} &nbsp;|&nbsp; Time zone: IST (UTC+05:30)</p>
  <div class="cards">
    <div class="card"><strong>${summary.recipients}</strong><span>Recipients</span></div>
    <div class="card"><strong>${summary.records}</strong><span>Total channel records</span></div>
    <div class="card"><strong>${summary.emailSent}</strong><span>Email sent</span></div>
    <div class="card"><strong>${summary.pushSent}</strong><span>Push sent</span></div>
    <div class="card fail"><strong>${summary.pushFailed}</strong><span>Push failed</span></div>
    <div class="card ok"><strong>${summary.inAppDelivered}</strong><span>In-app delivered</span></div>
  </div>
  <p class="note">${escapeHtml(breakdown(summary))}</p>
  ${sectionTable('Student birthdays', students)}
  ${sectionTable('Staff birthdays', staff)}
  ${other.length ? sectionTable('Other recipients', other) : ''}
</body>
</html>`;
}

function logoCandidates(logoUrl: string | null) {
  const paths: string[] = [];
  if (logoUrl) {
    const uploads = logoUrl.match(/\/uploads\/[^?#]+/);
    if (uploads) paths.push(resolvePublicUploadFsPath(uploads[0]));
  }
  const roots = [
    process.cwd(),
    join(process.cwd(), '..'),
    join(process.cwd(), '../..'),
  ];
  for (const root of roots) {
    paths.push(join(root, 'apps/web/public/branding/college-logo.png'));
    paths.push(join(root, 'web/public/branding/college-logo.png'));
    paths.push(join(root, 'apps/college-web/public/images/college-logo.png'));
  }
  return paths;
}

async function logoDataUri(logoUrl: string | null) {
  for (const path of logoCandidates(logoUrl)) {
    if (!existsSync(path)) continue;
    const bytes = await readFile(path);
    const lower = path.toLowerCase();
    const mime =
      lower.endsWith('.jpg') || lower.endsWith('.jpeg')
        ? 'image/jpeg'
        : lower.endsWith('.webp')
          ? 'image/webp'
          : lower.endsWith('.gif')
            ? 'image/gif'
            : 'image/png';
    return `data:${mime};base64,${bytes.toString('base64')}`;
  }
  return null;
}

function letterhead(collegeName: string, logoDataUri: string | null) {
  const college = escapeHtml(
    (collegeName.trim() || 'Don Bosco College, Tura').toUpperCase(),
  );
  const mark = logoDataUri
    ? `<img src="${logoDataUri}" alt="" style="width:42px;height:42px;object-fit:contain;background:#fff;border-radius:8px;" />`
    : `<div style="width:42px;height:42px;border-radius:21px;background:#0f2744;color:#fff;font-size:13px;font-weight:700;line-height:42px;text-align:center;">DB</div>`;
  return `<div style="width:100%;padding:0 12mm;font-family:'Segoe UI',Arial,sans-serif;color:#0f2744;-webkit-print-color-adjust:exact;">
    <div style="display:flex;justify-content:center;align-items:center;gap:10px;border-bottom:3px solid #0f2744;padding-bottom:6px;">
      ${mark}
      <div style="text-align:center;">
        <div style="font-size:15px;font-weight:800;letter-spacing:0.06em;">${college}</div>
        <div style="margin-top:2px;font-size:9px;font-weight:700;letter-spacing:0.14em;color:#9f1239;">COMMUNICATION CENTRE | BIRTHDAY WISHES</div>
      </div>
    </div>
  </div>`;
}

function footer(collegeName: string, generatedAt: Date) {
  const college = escapeHtml(collegeName.trim() || 'Don Bosco College, Tura');
  const generated = escapeHtml(formatReportIst(generatedAt));
  return `<div style="width:100%;padding:0 12mm;font-size:8px;font-family:'Segoe UI',Arial,sans-serif;color:#64748b;display:flex;justify-content:space-between;">
    <span>${college} · Communication Centre</span>
    <span>Generated ${generated} IST</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
}

export async function renderBirthdayWishesPdf(input: {
  collegeName: string;
  logoUrl: string | null;
  rows: BirthdayReportRow[];
  generatedAt?: Date;
}): Promise<Buffer> {
  const generatedAt = input.generatedAt ?? new Date();
  const logo = await logoDataUri(input.logoUrl);
  const html = buildBirthdayWishesReportHtml({
    collegeName: input.collegeName,
    logoDataUri: logo,
    rows: input.rows,
    generatedAt,
  });
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: letterhead(input.collegeName, logo),
      footerTemplate: footer(input.collegeName, generatedAt),
      margin: { top: '24mm', right: '12mm', bottom: '16mm', left: '12mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
