import { resolvePdfImageSrcAsync } from '../../../common/uploads/pdf-asset.util';

export const FEE_RECEIPT_TEMPLATE_VERSION = 'v10';

export type ReceiptTemplateFormat = 'full' | 'half' | 'thermal';

export const RECEIPT_TEMPLATE_LABELS: Record<ReceiptTemplateFormat, string> = {
  full: 'Full A4 portrait receipt (official)',
  half: 'Half A4 receipt (compact, 2 per sheet)',
  thermal: 'Thermal printer receipt (80mm)',
};

export function resolveReceiptTemplateFormat(
  metadata?: Record<string, unknown> | null,
): ReceiptTemplateFormat {
  const value = metadata?.receiptTemplate;
  if (value === 'full' || value === 'half' || value === 'thermal') return value;
  return 'half';
}

export type FeeReceiptLine = {
  component: string;
  feeHead: string;
  description: string;
  amount: number;
};

export type FeeReceiptBranding = {
  collegeName: string;
  addressLine: string | null;
  affiliationLine: string | null;
  accreditationLine: string | null;
  motto: string | null;
  establishedYear: string | null;
  logoSrc: string | null;
  logoPlaceholder: string | null;
  primaryColor: string;
  accentColor: string;
  phone: string | null;
  email: string | null;
  website: string | null;
};

export type FeeReceiptHtmlInput = {
  branding: FeeReceiptBranding;
  receiptNo: string;
  date: Date;
  paidAt: Date | null;
  studentName: string;
  enrollmentNumber: string;
  applicationNo: string;
  programme: string;
  semester: string;
  feeCycle: string;
  lines: FeeReceiptLine[];
  amount: number;
  paymentMode: string;
  paymentStatus: string;
  transactionRef: string;
  utrNumber?: string | null;
  collectedBy: string;
  /** Authorized fee collection center (Net Café / CSC) when paid via center portal. */
  collectionCenterName?: string | null;
  operatorName?: string | null;
  verifyUrl: string;
};

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function inr(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatBillingPeriodLabel(period?: string | null): string {
  if (!period?.trim()) return '—';
  const trimmed = period.trim();
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (monthMatch) {
    const monthIndex = Number(monthMatch[2]) - 1;
    if (monthIndex >= 0 && monthIndex <= 11) {
      return new Date(Number(monthMatch[1]), monthIndex, 1).toLocaleDateString(
        'en-IN',
        { month: 'long', year: 'numeric' },
      );
    }
  }
  if (/^CYCLE-/i.test(trimmed)) {
    return trimmed.replace(/^CYCLE-/i, 'Admission Cycle ');
  }
  return trimmed;
}

function billingPeriodSortKey(period: string): string {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(period.trim());
  return monthMatch ? period.trim() : `z-${period}`;
}

function collectFormattedBillingPeriods(
  allocations: Array<{ demand?: Record<string, unknown> }>,
): string[] {
  const rawPeriods = allocations
    .map((allocation) => {
      const demand = allocation.demand;
      const metadata = demand?.metadata as
        | { feeCycleName?: string }
        | undefined;
      return String(
        demand?.billingPeriod ?? metadata?.feeCycleName ?? '',
      ).trim();
    })
    .filter(Boolean);
  const unique = [...new Set(rawPeriods)].sort((a, b) =>
    billingPeriodSortKey(a).localeCompare(billingPeriodSortKey(b)),
  );
  return unique
    .map((period) => formatBillingPeriodLabel(period))
    .filter((label) => label !== '—');
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`.trim();
}

function threeDigits(n: number): string {
  if (n >= 100) {
    return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ''}`.trim();
  }
  return twoDigits(n);
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const hundred = rupees % 1000;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = parts.join(' ').trim();
  words = words ? `${words} Rupees` : 'Zero Rupees';
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
}

export function resolveReceiptLines(
  receipt: Record<string, unknown>,
): FeeReceiptLine[] {
  const fromAllocations: FeeReceiptLine[] = [];
  const payment = receipt.payment as Record<string, unknown> | undefined;

  for (const allocation of (payment?.allocations as Array<
    Record<string, unknown>
  >) ?? []) {
    const demand = allocation.demand as Record<string, unknown> | undefined;
    if (!demand) continue;
    fromAllocations.push(
      mapDemandAllocation(demand, Number(allocation.amount)),
    );
  }
  if (fromAllocations.length) return fromAllocations;

  const demand = receipt.demand as
    | { lines?: Array<{ name: string; amount: unknown }> }
    | undefined;
  if (demand?.lines?.length) {
    return demand.lines.map((line) => ({
      component: 'Fee',
      feeHead: line.name,
      description: line.name,
      amount: Number(line.amount),
    }));
  }

  return [
    {
      component: 'Fee Payment',
      feeHead: 'General',
      description: 'Fee payment received',
      amount: Number(receipt.amount),
    },
  ];
}

function mapDemandAllocation(
  demand: Record<string, unknown>,
  amount: number,
): FeeReceiptLine {
  const metadata =
    (demand.metadata as Record<string, unknown> | undefined) ?? {};
  const demandType = String(demand.demandType ?? 'GENERAL');
  const lines = (demand.lines as Array<{ name: string }> | undefined) ?? [];
  const billingPeriod = String(demand.billingPeriod ?? '').trim();
  const periodLabel = formatBillingPeriodLabel(
    billingPeriod || String(metadata.feeCycleName ?? ''),
  );

  let component = 'Fee';
  if (demandType === 'MONTHLY_TUITION') component = 'Monthly Fee';
  else if (/ADMISSION|SESSION|CYCLE/i.test(demandType))
    component = 'Admission Fee';
  else if (lines.some((l) => /tuition|monthly/i.test(l.name)))
    component = 'Monthly Fee';

  const feeHead =
    periodLabel !== '—'
      ? periodLabel
      : String(metadata.feeCycleName ?? '') ||
        billingPeriod ||
        String(demand.demandNo ?? 'Fee');

  const lineNames =
    lines.length > 0 ? lines.map((l) => l.name).join(' · ') : '';
  let description = lineNames;
  if (demandType === 'MONTHLY_TUITION' && periodLabel !== '—') {
    description = lineNames
      ? `${lineNames} · ${periodLabel}`
      : `Monthly tuition · ${periodLabel}`;
  } else if (!description) {
    description = String(metadata.covers ?? metadata.description ?? component);
  }

  return { component, feeHead, description, amount };
}

export function resolveFeeCycleLabel(receipt: Record<string, unknown>) {
  const allocations =
    (
      receipt.payment as
        | { allocations?: Array<{ demand?: Record<string, unknown> }> }
        | undefined
    )?.allocations ?? [];
  if (allocations.length) {
    const periods = collectFormattedBillingPeriods(allocations);
    if (periods.length) return periods.join(', ');
  }

  const receiptDemand = receipt.demand as
    | { metadata?: { feeCycleName?: string }; billingPeriod?: string }
    | undefined;
  const fallback = formatBillingPeriodLabel(
    receiptDemand?.billingPeriod ?? receiptDemand?.metadata?.feeCycleName ?? '',
  );
  return fallback !== '—' ? fallback : '—';
}

export function buildFeeReceiptStorageKey(
  tenantId: string,
  receiptNo: string,
  format: ReceiptTemplateFormat = 'full',
) {
  return `fee-receipts/${tenantId}/${receiptNo.replace(/\//g, '_')}_${FEE_RECEIPT_TEMPLATE_VERSION}_${format}.pdf`;
}

export function receiptPdfOptions(format: ReceiptTemplateFormat) {
  switch (format) {
    case 'full':
      return {
        format: 'A4' as const,
        landscape: false,
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
      };
    case 'half':
      // Half content is wrapped onto A4 (top 148mm + cut line) so printers don't scale up
      return {
        format: 'A4' as const,
        landscape: false,
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      };
    case 'thermal':
      return {
        width: '80mm',
        height: '200mm',
        landscape: false,
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: '2mm', right: '2mm', bottom: '2mm', left: '2mm' },
      };
  }
}

function formatReceiptDate(date: Date) {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatReceiptDateTime(date: Date) {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function feeHeadLabel(line: FeeReceiptLine) {
  if (line.component && line.feeHead && line.component !== line.feeHead) {
    return `${line.component} — ${line.feeHead}`;
  }
  return line.feeHead || line.component;
}

function formatReceiptDateCompact(date: Date) {
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' }).toUpperCase();
  return `${day} ${month} ${date.getFullYear()}`;
}

function linePeriod(line: FeeReceiptLine) {
  if (line.feeHead && line.feeHead !== '—') return line.feeHead;
  return '—';
}

export function buildFeeReceiptHtml(
  data: FeeReceiptHtmlInput,
  format: ReceiptTemplateFormat = 'half',
) {
  if (format === 'half') return buildHalfCompactFeeReceiptHtml(data);
  if (format === 'thermal') return buildThermalFeeReceiptHtml(data);
  return buildFullFeeReceiptHtml(data);
}

/** Extract `<style>` blocks and body inner HTML from a receipt document. */
export function extractFeeReceiptStyleAndBody(html: string): {
  style: string;
  body: string;
} {
  const styleBlocks = [
    ...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi),
  ].map((m) => m[1] ?? '');
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return { style: styleBlocks.join('\n'), body };
}

const A4_HALF_SHEET_LAYOUT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .a4-page {
    width: 210mm;
    height: 297mm;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
  .receipt-sheet {
    flex: 0 0 148mm;
    height: 148mm;
    max-height: 148mm;
    overflow: hidden;
    padding: 4mm 5mm;
    box-sizing: border-box;
  }
  .receipt-sheet-empty {
    flex: 1 1 auto;
    min-height: 0;
  }
  .cut-line {
    border-top: 1px dashed #94a3b8;
    margin: 0;
    flex-shrink: 0;
    position: relative;
    height: 0;
  }
  .cut-line::after {
    content: '✂ cut here';
    position: absolute;
    right: 8mm;
    top: -7px;
    font-size: 7px;
    color: #94a3b8;
    background: #fff;
    padding: 0 4px;
  }
`;

/** Place a half receipt in the top 148mm of an A4 page with a cut guide. */
export function wrapHalfReceiptOnA4(html: string): string {
  const { style, body } = extractFeeReceiptStyleAndBody(html);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    ${A4_HALF_SHEET_LAYOUT_CSS}
    ${style}
  </style>
</head>
<body>
  <div class="a4-page">
    <div class="receipt-sheet">${body}</div>
    <div class="cut-line"></div>
    <div class="receipt-sheet-empty"></div>
  </div>
</body>
</html>`;
}

/** Build merged A4 document for bulk print (1 or 2 receipts per page). */
export function buildBulkFeeReceiptA4Html(
  receiptHtmlList: string[],
  layout: 'single' | 'two_per_page' = 'two_per_page',
): string {
  const styles: string[] = [];
  const sheets: string[] = [];
  for (const html of receiptHtmlList) {
    const { style, body } = extractFeeReceiptStyleAndBody(html);
    if (style) styles.push(style);
    sheets.push(`<div class="receipt-sheet">${body}</div>`);
  }
  const perPage = layout === 'two_per_page' ? 2 : 1;
  const pages: string[] = [];
  for (let i = 0; i < sheets.length; i += perPage) {
    const chunk = sheets.slice(i, i + perPage);
    if (chunk.length === 1 && layout === 'two_per_page') {
      pages.push(
        `<div class="a4-page">${chunk[0]}<div class="cut-line"></div><div class="receipt-sheet-empty"></div></div>`,
      );
    } else if (chunk.length === 1) {
      pages.push(
        `<div class="a4-page">${chunk[0]}<div class="receipt-sheet-empty"></div></div>`,
      );
    } else {
      pages.push(
        `<div class="a4-page">${chunk[0]}<div class="cut-line"></div>${chunk[1]}</div>`,
      );
    }
  }
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    ${A4_HALF_SHEET_LAYOUT_CSS}
    ${styles.join('\n')}
  </style>
</head>
<body>${pages.join('')}</body>
</html>`;
}

function buildHalfCompactFeeReceiptHtml(data: FeeReceiptHtmlInput) {
  const b = data.branding;
  const primary = b.primaryColor || '#0b2e59';
  const muted = '#64748B';
  const bg = '#F8FAFC';
  const paidAt = data.paidAt ?? data.date;
  const paidAtText = formatReceiptDateTime(paidAt);
  const dateText = formatReceiptDateCompact(data.date).toUpperCase();
  const statusOk = /success|paid/i.test(data.paymentStatus);
  const academicYear = academicYearFromDate(data.date);

  const logoBlock = b.logoSrc
    ? `<img class="logo" src="${b.logoSrc}" alt="" />`
    : `<div class="logo-ph">${b.logoPlaceholder ?? 'DBC<br/>Tura'}</div>`;

  const lineRows = data.lines
    .map(
      (line, index) => `
      <tr>
        <td class="c">${index + 1}</td>
        <td>${escapeHtml(line.component || feeHeadLabel(line))}</td>
        <td>${escapeHtml(line.feeHead || linePeriod(line))}</td>
        <td>${escapeHtml(line.description || '—')}</td>
        <td class="amt">${inr(line.amount)}</td>
      </tr>`,
    )
    .join('');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(data.verifyUrl)}`;
  const verifyShort = data.verifyUrl
    .replace(/^https?:\/\//, '')
    .replace(/\?.*$/, '');

  const phone = b.phone ?? '+91 9402152496';
  const email = b.email ?? 'accounts@donboscocollege.ac.in';
  const website = (b.website ?? 'https://donboscocollege.ac.in').replace(
    /^https?:\/\//,
    '',
  );
  const address = b.addressLine ?? 'Tura, West Garo Hills, Meghalaya - 794002';
  const affiliation = [b.affiliationLine, b.accreditationLine]
    .filter(Boolean)
    .join(' | ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    /* Content sized for one half of A4 portrait (210mm × 148mm slot) */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Inter, Arial, sans-serif;
      font-size: 7.5px;
      line-height: 1.25;
      color: #1a2332;
      background: #fff;
    }
    .receipt { width: 100%; height: 100%; }

    .header {
      display: grid;
      grid-template-columns: 42px 1fr 112px;
      gap: 6px;
      align-items: start;
      padding-bottom: 4px;
      border-bottom: 2px solid ${primary};
      margin-bottom: 4px;
    }
    .logo { width: 40px; height: 40px; object-fit: contain; border-radius: 50%; }
    .logo-ph {
      width: 40px; height: 40px; border-radius: 50%;
      border: 1.5px solid ${primary};
      display: flex; align-items: center; justify-content: center;
      text-align: center; font-size: 5.5px; font-weight: 700;
      color: ${primary}; line-height: 1.1; padding: 3px;
      background: ${bg};
    }
    .institution { text-align: center; padding-top: 0; }
    .inst-name {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12px;
      font-weight: 700;
      color: ${primary};
      letter-spacing: 0.2px;
      text-transform: uppercase;
      line-height: 1.15;
    }
    .inst-line { margin: 1px 0 0; font-size: 6.5px; color: #475569; line-height: 1.2; }
    .inst-motto {
      margin: 2px 0 0;
      font-size: 7px;
      font-weight: 700;
      color: ${primary};
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .receipt-badge {
      display: block;
      width: 100%;
      background: ${primary};
      color: #fff;
      font-size: 6.5px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 3px 4px;
      text-align: center;
      border-radius: 3px 3px 0 0;
    }
    .receipt-no-wrap {
      border: 1.5px solid ${primary};
      border-top: 0;
      border-radius: 0 0 3px 3px;
      overflow: hidden;
      background: #fff;
      text-align: center;
      margin-bottom: 2px;
    }
    .receipt-no-label {
      font-size: 5.5px;
      font-weight: 700;
      color: ${muted};
      text-transform: uppercase;
      padding: 2px 4px 0;
    }
    .receipt-no-value {
      font-size: 7.5px;
      font-weight: 800;
      color: ${primary};
      padding: 1px 4px 3px;
      font-family: Consolas, monospace;
      word-break: break-all;
    }
    .receipt-date {
      margin: 0;
      font-size: 6.5px;
      font-weight: 700;
      color: ${primary};
      text-align: center;
    }

    .panels {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      margin-bottom: 4px;
    }
    .panel {
      border: 1px solid #d7e0ea;
      border-radius: 3px;
      overflow: hidden;
      background: #fff;
    }
    .panel-head {
      background: ${primary};
      color: #fff;
      font-size: 6.5px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 3px 5px;
    }
    .panel-body { padding: 3px 5px; background: ${bg}; }
    .field {
      display: grid;
      grid-template-columns: 68px 1fr;
      gap: 2px 4px;
      margin: 0 0 1px;
      font-size: 7px;
      line-height: 1.2;
    }
    .field strong { color: ${muted}; font-weight: 600; }
    .field span { color: #0f172a; font-weight: 700; word-break: break-word; }
    .status-pill {
      display: inline-block;
      padding: 0 6px;
      border-radius: 999px;
      font-size: 6px;
      font-weight: 800;
      line-height: 1.5;
    }
    .status-ok { background: #e8f7ef; color: #0f7a45; }
    .status-pending { background: #fff7ed; color: #b45309; }

    .table-title {
      background: ${primary};
      color: #fff;
      font-size: 6.5px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 3px 5px;
      border-radius: 3px 3px 0 0;
    }
    table { width: 100%; border-collapse: collapse; font-size: 7px; }
    thead th {
      background: #e8eef6;
      color: ${primary};
      font-size: 6px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      text-align: left;
      padding: 2px 4px;
      border: 1px solid #d7e0ea;
    }
    thead th:last-child { text-align: right; }
    tbody td {
      border: 1px solid #d7e0ea;
      padding: 2px 4px;
      vertical-align: top;
    }
    td.c { text-align: center; width: 18px; color: ${muted}; }
    td.amt { text-align: right; font-weight: 700; white-space: nowrap; }
    tr.total-row td {
      background: #eef3f9;
      font-weight: 800;
      color: ${primary};
      border-top: 1.5px solid ${primary};
    }

    .words {
      margin: 3px 0;
      padding: 2px 5px;
      background: ${bg};
      border: 1px dashed #cbd5e1;
      border-radius: 3px;
      font-size: 7px;
      color: #475569;
    }
    .words strong { color: ${primary}; }

    .footer-panels {
      display: grid;
      grid-template-columns: 1.1fr 1fr 1.1fr;
      gap: 5px;
      margin-bottom: 3px;
    }
    .box {
      border: 1px solid #d7e0ea;
      border-radius: 3px;
      padding: 4px 5px;
      background: #fff;
      min-height: 52px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .box h4 {
      margin: 0 0 2px;
      font-size: 6.5px;
      font-weight: 800;
      color: ${primary};
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .box p { margin: 0; font-size: 6px; color: ${muted}; line-height: 1.3; }
    .qr { text-align: center; }
    .qr img { width: 40px; height: 40px; }
    .sign-script {
      margin: 4px 0 2px;
      font-family: 'Segoe Script', 'Brush Script MT', cursive;
      font-size: 14px;
      color: ${primary};
      line-height: 1;
      text-align: center;
    }
    .sign-line {
      border-top: 1px solid #94a3b8;
      padding-top: 2px;
      text-align: center;
      font-size: 6.5px;
      font-weight: 800;
      color: ${primary};
    }
    .thanks { text-align: center; justify-content: center; align-items: center; }
    .thanks-check {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #e8f7ef;
      color: #0f7a45;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 800;
      margin: 0 auto 3px;
    }

    .contact-bar {
      background: #e8eef6;
      color: ${primary};
      border-radius: 3px;
      padding: 2px 5px;
      font-size: 6px;
      font-weight: 600;
      display: flex;
      flex-wrap: wrap;
      gap: 2px 10px;
      margin-bottom: 2px;
    }
    .keep {
      text-align: center;
      font-size: 6px;
      color: ${muted};
      border-top: 1px dashed #cbd5e1;
      padding-top: 2px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div>${logoBlock}</div>
      <div class="institution">
        <h1 class="inst-name">${escapeHtml(b.collegeName)}</h1>
        <p class="inst-line">${escapeHtml(address)}</p>
        ${affiliation ? `<p class="inst-line">${escapeHtml(affiliation)}</p>` : ''}
        ${b.motto ? `<p class="inst-motto">${escapeHtml(b.motto)}</p>` : ''}
      </div>
      <div>
        <div class="receipt-badge">Official Fee Receipt</div>
        <div class="receipt-no-wrap">
          <div class="receipt-no-label">Receipt No.</div>
          <div class="receipt-no-value">${escapeHtml(data.receiptNo)}</div>
        </div>
        <p class="receipt-date">DATE: ${escapeHtml(dateText)}</p>
      </div>
    </div>

    <div class="panels">
      <div class="panel">
        <div class="panel-head">Student Details</div>
        <div class="panel-body">
          <p class="field"><strong>Name</strong><span>${escapeHtml(data.studentName)}</span></p>
          <p class="field"><strong>Roll Number</strong><span>${escapeHtml(data.enrollmentNumber || data.applicationNo || '—')}</span></p>
          <p class="field"><strong>Programme</strong><span>${escapeHtml(data.programme || '—')}</span></p>
          <p class="field"><strong>Semester</strong><span>${escapeHtml(data.semester || '—')}</span></p>
          <p class="field"><strong>Fee Period</strong><span>${escapeHtml(data.feeCycle || '—')}</span></p>
          <p class="field"><strong>Academic Year</strong><span>${escapeHtml(academicYear)}</span></p>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">Payment Details</div>
        <div class="panel-body">
          <p class="field"><strong>Mode</strong><span>${escapeHtml(data.paymentMode.replace(/_/g, ' '))}</span></p>
          <p class="field"><strong>Transaction ID</strong><span>${escapeHtml(data.transactionRef)}</span></p>
          ${data.utrNumber ? `<p class="field"><strong>UTR No.</strong><span>${escapeHtml(data.utrNumber)}</span></p>` : ''}
          <p class="field"><strong>Payment Date</strong><span>${escapeHtml(paidAtText)}</span></p>
          <p class="field"><strong>Collected By</strong><span>${escapeHtml(data.collectedBy || 'Accounts Office')}</span></p>
          ${
            data.operatorName
              ? `<p class="field"><strong>Operator</strong><span>${escapeHtml(data.operatorName)}</span></p>`
              : ''
          }
          ${
            data.collectionCenterName
              ? `<p class="field"><strong>Net Café</strong><span>${escapeHtml(data.collectionCenterName)}</span></p>`
              : ''
          }
          <p class="field"><strong>Status</strong><span class="status-pill ${statusOk ? 'status-ok' : 'status-pending'}">${escapeHtml(data.paymentStatus)}</span></p>
        </div>
      </div>
    </div>

    <div class="table-title">Fee Details</div>
    <table>
      <thead>
        <tr>
          <th style="width:22px">Sl.</th>
          <th>Fee Head</th>
          <th>Period / Semester</th>
          <th>Description</th>
          <th style="width:70px">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
        <tr class="total-row">
          <td colspan="4">TOTAL PAID</td>
          <td class="amt">${inr(data.amount)}</td>
        </tr>
      </tbody>
    </table>

    <p class="words"><strong>In Words:</strong> ${escapeHtml(amountInWords(data.amount))}</p>

    <div class="footer-panels">
      <div class="box qr">
        <h4>Verify Receipt</h4>
        <div>
          <img src="${qrUrl}" alt="Verify receipt QR" />
          <p style="margin-top:2px">${escapeHtml(verifyShort)}</p>
          <p>${escapeHtml(data.receiptNo)}</p>
        </div>
      </div>
      <div class="box">
        <h4>Authorized Signatory</h4>
        <div>
          <div class="sign-script">Authorized</div>
          <div class="sign-line">College Accounts Office</div>
        </div>
      </div>
      <div class="box thanks">
        <div>
          <div class="thanks-check">✓</div>
          <h4>Thank You!</h4>
          <p>Computer generated — no physical signature required.</p>
        </div>
      </div>
    </div>

    <div class="contact-bar">
      <span>${escapeHtml(phone)}</span>
      <span>${escapeHtml(email)}</span>
      <span>${escapeHtml(website)}</span>
      <span>${escapeHtml(address)}</span>
    </div>
    <p class="keep">— Keep this receipt for your records —</p>
  </div>
</body>
</html>`;
}

function buildThermalFeeReceiptHtml(data: FeeReceiptHtmlInput) {
  const b = data.branding;
  const primary = '#0F172A';
  const accent = '#2563EB';
  const paidAt = data.paidAt ?? data.date;

  const logoBlock = b.logoSrc
    ? `<img class="logo" src="${b.logoSrc}" alt="" />`
    : `<div class="logo-ph">Logo</div>`;

  const lineRows = data.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(feeHeadLabel(line))}</td><td class="amt">${inr(line.amount)}</td></tr>`,
    )
    .join('');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=48x48&data=${encodeURIComponent(data.verifyUrl)}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,Arial,sans-serif;font-size:7px;color:#0F172A}
  .logo{width:28px;height:28px;object-fit:contain}
  .logo-ph{width:28px;height:28px;border:1px solid #1E293B;border-radius:50%;font-size:5px;display:flex;align-items:center;justify-content:center}
  h1{font-size:8px;text-transform:uppercase}
  table{width:100%;border-collapse:collapse;margin-top:3px}
  th{background:#0F172A;color:#fff;padding:2px;font-size:6px}
  td{border-top:1px solid #e2e8f0;padding:2px}
  td.amt{text-align:right;font-weight:700}
  .row{display:flex;justify-content:space-between;margin:1px 0}
</style></head><body>
  <div style="display:flex;gap:4px;align-items:center;border-bottom:1px solid #0F172A;padding-bottom:3px">
    ${logoBlock}<div><h1>${escapeHtml(b.collegeName)}</h1><div>${escapeHtml(data.receiptNo)}</div></div>
  </div>
  <div class="row"><span>Name</span><span>${escapeHtml(data.studentName)}</span></div>
  <div class="row"><span>Amount</span><span>${inr(data.amount)}</span></div>
  <table><thead><tr><th>Fee</th><th>Amt</th></tr></thead><tbody>${lineRows}</tbody></table>
  <div style="margin-top:4px;display:flex;justify-content:space-between"><img src="${qrUrl}" width="40" height="40"/><span>${formatReceiptDateCompact(data.date)}</span></div>
</body></html>`;
}

function buildFullFeeReceiptHtml(data: FeeReceiptHtmlInput) {
  const b = data.branding;
  const primary = b.primaryColor || '#0b2e59';
  const paidAt = data.paidAt ?? data.date;
  const paidAtText = formatReceiptDateTime(paidAt);
  const dateText = formatReceiptDateCompact(data.date).toUpperCase();
  const statusOk = /success|paid/i.test(data.paymentStatus);

  const logoBlock = b.logoSrc
    ? `<img class="logo" src="${b.logoSrc}" alt="" />`
    : `<div class="logo-ph">${b.logoPlaceholder ?? 'College<br/>Logo'}</div>`;

  const watermark = b.logoSrc
    ? `<img class="watermark" src="${b.logoSrc}" alt="" />`
    : '';

  const lineRows = data.lines
    .map(
      (line, index) => `
      <tr>
        <td class="c">${index + 1}</td>
        <td>${escapeHtml(line.component || feeHeadLabel(line))}</td>
        <td>${escapeHtml(line.feeHead || '—')}</td>
        <td>${escapeHtml(line.description || '—')}</td>
        <td class="amt">${inr(line.amount)}</td>
      </tr>`,
    )
    .join('');

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(data.verifyUrl)}`;
  const verifyShort = data.verifyUrl
    .replace(/^https?:\/\//, '')
    .replace(/\?.*$/, '');

  const phone = b.phone ?? '+91 9402152496';
  const email = b.email ?? 'accounts@donboscocollege.ac.in';
  const website = (b.website ?? 'https://donboscocollege.ac.in').replace(
    /^https?:\/\//,
    '',
  );
  const address = b.addressLine ?? 'Tura, West Garo Hills, Meghalaya - 794002';
  const academicYear = academicYearFromDate(data.date);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', Inter, Arial, sans-serif;
      color: #1a2332;
      font-size: 11px;
      line-height: 1.4;
      background: #fff;
    }
    .sheet {
      position: relative;
      min-height: 277mm;
      overflow: hidden;
    }
    .watermark {
      position: absolute;
      left: 50%;
      top: 46%;
      transform: translate(-50%, -50%);
      width: 280px;
      height: 280px;
      object-fit: contain;
      opacity: 0.05;
      z-index: 0;
      pointer-events: none;
    }
    .content { position: relative; z-index: 1; }
    .header {
      display: grid;
      grid-template-columns: 84px 1fr 168px;
      gap: 12px;
      align-items: start;
      padding-bottom: 12px;
      border-bottom: 3px solid ${primary};
      margin-bottom: 14px;
    }
    .logo {
      width: 78px;
      height: 78px;
      object-fit: contain;
      border-radius: 50%;
    }
    .logo-ph {
      width: 78px;
      height: 78px;
      border-radius: 50%;
      border: 2px solid ${primary};
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      color: ${primary};
      line-height: 1.15;
      padding: 6px;
      background: #f8fafc;
    }
    .institution { text-align: center; padding-top: 2px; }
    .inst-name {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 22px;
      font-weight: 700;
      color: ${primary};
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .inst-line { margin: 3px 0 0; font-size: 10.5px; color: #475569; }
    .inst-motto {
      margin: 8px 0 0;
      font-size: 12px;
      font-weight: 700;
      color: ${primary};
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .receipt-badge {
      display: inline-block;
      width: 100%;
      background: ${primary};
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 7px 8px;
      text-align: center;
      border-radius: 4px 4px 0 0;
    }
    .receipt-no-wrap {
      border: 2px solid ${primary};
      border-top: 0;
      border-radius: 0 0 4px 4px;
      overflow: hidden;
      background: #fff;
      text-align: center;
      margin-bottom: 6px;
    }
    .receipt-no-label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      padding: 5px 6px 0;
    }
    .receipt-no-value {
      font-size: 12px;
      font-weight: 800;
      color: ${primary};
      padding: 2px 6px 7px;
      font-family: Consolas, monospace;
    }
    .receipt-date {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      color: ${primary};
      text-align: center;
    }
    .panels {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .panel {
      border: 1px solid #d7e0ea;
      border-radius: 6px;
      overflow: hidden;
      background: #fff;
    }
    .panel-head {
      background: ${primary};
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 8px 10px;
    }
    .panel-body { padding: 10px 12px; background: #f8fafc; }
    .field {
      display: grid;
      grid-template-columns: 110px 1fr;
      gap: 6px;
      margin: 0 0 6px;
      font-size: 11px;
    }
    .field:last-child { margin-bottom: 0; }
    .field strong { color: #64748b; font-weight: 600; }
    .field span { color: #0f172a; font-weight: 700; word-break: break-word; }
    .status-pill {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 800;
    }
    .status-ok { background: #e8f7ef; color: #0f7a45; }
    .status-pending { background: #fff7ed; color: #b45309; }
    .table-title {
      background: ${primary};
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 8px 10px;
      border-radius: 6px 6px 0 0;
    }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead th {
      background: #e8eef6;
      color: ${primary};
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      text-align: left;
      padding: 8px;
      border: 1px solid #d7e0ea;
    }
    thead th:last-child { text-align: right; }
    tbody td {
      border: 1px solid #d7e0ea;
      padding: 7px 8px;
      vertical-align: top;
    }
    td.c { text-align: center; width: 36px; color: #64748b; }
    td.amt { text-align: right; font-weight: 700; white-space: nowrap; }
    tr.total-row td {
      background: #eef3f9;
      font-weight: 800;
      color: ${primary};
      border-top: 2px solid ${primary};
    }
    .words {
      margin: 0 0 14px;
      padding: 8px 10px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      font-size: 11px;
    }
    .footer-panels {
      display: grid;
      grid-template-columns: 1.1fr 1fr 1.1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .box {
      border: 1px solid #d7e0ea;
      border-radius: 6px;
      padding: 12px;
      background: #fff;
      min-height: 128px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .box h4 {
      margin: 0 0 8px;
      font-size: 11px;
      font-weight: 800;
      color: ${primary};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .box p { margin: 0; font-size: 10px; color: #64748b; line-height: 1.45; }
    .qr { text-align: center; }
    .qr img { width: 78px; height: 78px; }
    .sign-script {
      margin: 18px 0 4px;
      font-family: 'Segoe Script', 'Brush Script MT', cursive;
      font-size: 28px;
      color: ${primary};
      line-height: 1;
      text-align: center;
    }
    .sign-line {
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      text-align: center;
      font-size: 10px;
      font-weight: 800;
      color: ${primary};
    }
    .thanks { text-align: center; justify-content: center; }
    .thanks-check {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #e8f7ef;
      color: #0f7a45;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      font-weight: 800;
      margin: 0 auto 8px;
    }
    .bottom-bar {
      background: #e8eef6;
      color: ${primary};
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 10.5px;
      font-weight: 600;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    .notes {
      border: 1px solid #d7e0ea;
      border-radius: 6px;
      padding: 10px 12px;
      background: #f8fafc;
      font-size: 10px;
      color: #475569;
    }
    .notes strong { color: ${primary}; }
    .notes ul { margin: 6px 0 0; padding-left: 16px; }
  </style>
</head>
<body>
  <div class="sheet">
    ${watermark}
    <div class="content">
      <div class="header">
        <div>${logoBlock}</div>
        <div class="institution">
          <h1 class="inst-name">${escapeHtml(b.collegeName)}</h1>
          <p class="inst-line">${escapeHtml(address)}</p>
          ${b.affiliationLine ? `<p class="inst-line">${escapeHtml(b.affiliationLine)}</p>` : ''}
          ${b.accreditationLine ? `<p class="inst-line">${escapeHtml(b.accreditationLine)}</p>` : ''}
          ${b.motto ? `<p class="inst-motto">${escapeHtml(b.motto)}</p>` : ''}
        </div>
        <div class="receipt-box">
          <div class="receipt-badge">Official Fee Receipt</div>
          <div class="receipt-no-wrap">
            <div class="receipt-no-label">Receipt No.</div>
            <div class="receipt-no-value">${escapeHtml(data.receiptNo)}</div>
          </div>
          <p class="receipt-date">DATE: ${escapeHtml(dateText)}</p>
        </div>
      </div>

      <div class="panels">
        <div class="panel">
          <div class="panel-head">Student Details</div>
          <div class="panel-body">
            <p class="field"><strong>Name</strong><span>${escapeHtml(data.studentName)}</span></p>
            <p class="field"><strong>Roll Number</strong><span>${escapeHtml(data.enrollmentNumber || data.applicationNo || '—')}</span></p>
            <p class="field"><strong>Programme</strong><span>${escapeHtml(data.programme || '—')}</span></p>
            <p class="field"><strong>Semester</strong><span>${escapeHtml(data.semester || '—')}</span></p>
            <p class="field"><strong>Fee Period</strong><span>${escapeHtml(data.feeCycle || '—')}</span></p>
            <p class="field"><strong>Academic Year</strong><span>${escapeHtml(academicYear)}</span></p>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head">Payment Details</div>
          <div class="panel-body">
            <p class="field"><strong>Mode</strong><span>${escapeHtml(data.paymentMode.replace(/_/g, ' '))}</span></p>
            <p class="field"><strong>Transaction ID</strong><span>${escapeHtml(data.transactionRef)}</span></p>
            ${data.utrNumber ? `<p class="field"><strong>UTR No.</strong><span>${escapeHtml(data.utrNumber)}</span></p>` : ''}
            <p class="field"><strong>Payment Date</strong><span>${escapeHtml(paidAtText)}</span></p>
            <p class="field"><strong>Collected By</strong><span>${escapeHtml(data.collectedBy || 'Accounts Office')}</span></p>
            ${
              data.collectionCenterName
                ? `<p class="field"><strong>Collection Center</strong><span>${escapeHtml(data.collectionCenterName)}</span></p>`
                : ''
            }
            <p class="field"><strong>Status</strong><span class="status-pill ${statusOk ? 'status-ok' : 'status-pending'}">${escapeHtml(data.paymentStatus)}</span></p>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-title">Fee Details</div>
        <table>
          <thead>
            <tr>
              <th style="width:40px">Sl.</th>
              <th>Fee Head</th>
              <th>Period / Semester</th>
              <th>Description</th>
              <th style="width:110px">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${lineRows}
            <tr class="total-row">
              <td colspan="4">TOTAL PAID</td>
              <td class="amt">${inr(data.amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="words"><strong>In Words:</strong> ${escapeHtml(amountInWords(data.amount))}</p>

      <div class="footer-panels">
        <div class="box qr">
          <h4>Verify Receipt</h4>
          <div>
            <img src="${qrUrl}" alt="Verify receipt QR" />
            <p style="margin-top:6px">${escapeHtml(verifyShort)}</p>
            <p>${escapeHtml(data.receiptNo)}</p>
          </div>
        </div>
        <div class="box">
          <h4>Authorized Signatory</h4>
          <div>
            <div class="sign-script">Authorized</div>
            <div class="sign-line">College Accounts Office</div>
          </div>
        </div>
        <div class="box thanks">
          <div>
            <div class="thanks-check">✓</div>
            <h4>Thank You!</h4>
            <p>This is a computer generated receipt and does not require any physical signature.</p>
          </div>
        </div>
      </div>

      <div class="bottom-bar">
        <span>${escapeHtml(phone)}</span>
        <span>${escapeHtml(email)}</span>
        <span>${escapeHtml(website)}</span>
        <span>${escapeHtml(address)}</span>
      </div>

      <div class="notes">
        <strong>Important</strong>
        <ul>
          <li>Please keep this receipt for your academic and fee records.</li>
          <li>This receipt is valid for verification via QR code or receipt number on the college payment portal.</li>
          <li>For discrepancies, contact the Accounts Office during working hours (Mon–Fri, 9:00 AM – 4:30 PM).</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function academicYearFromDate(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based; academic year typically starts in July
  if (month >= 6) return `${year} – ${year + 1}`;
  return `${year - 1} – ${year}`;
}

export async function resolveFeeReceiptBranding(
  db: Record<string, any>,
  tenantId: string,
) {
  const [tenant, branding] = await Promise.all([
    db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
    db.tenantBranding.findUnique({
      where: { tenantId },
      select: {
        displayName: true,
        address: true,
        badges: true,
        logoUrl: true,
        primaryColor: true,
        accentColor: true,
        portalSubtitle: true,
      },
    }),
  ]);

  const badges = Array.isArray(branding?.badges)
    ? (branding!.badges as string[])
    : [];
  const displayName = String(
    branding?.displayName ?? tenant?.name ?? 'College',
  );
  const isDbc = /don bosco/i.test(displayName);

  const affiliationLine =
    badges.find((b) => /affiliated|nehu/i.test(b)) ??
    (isDbc
      ? 'Affiliated to North Eastern Hill University (NEHU), Shillong'
      : null);
  const accreditationLine =
    badges.find((b) => /2\(f\)|12\(B\)|ugc|naac/i.test(b)) ??
    (isDbc ? 'Recognized under 2(f) & 12(B) of UGC Act' : null);

  const logoUrl = (branding?.logoUrl as string | null) ?? null;
  const logoSrc = await resolvePdfImageSrcAsync(logoUrl);

  return {
    collegeName: displayName.toUpperCase(),
    addressLine:
      (branding?.address as string | null) ??
      (isDbc ? 'Tura, West Garo Hills, Meghalaya - 794002' : null),
    affiliationLine,
    accreditationLine,
    motto: isDbc ? 'In Pursuit of Excellence' : null,
    establishedYear: isDbc ? '1987' : null,
    logoSrc,
    logoPlaceholder: isDbc
      ? 'Don Bosco<br/>College<br/>Tura'
      : displayName.split(' ').slice(0, 3).join('<br/>'),
    primaryColor: (branding?.primaryColor as string | null) ?? '#0b2e59',
    accentColor: (branding?.accentColor as string | null) ?? '#c79a2b',
    phone: isDbc ? '+91 9402152496' : null,
    email: isDbc ? 'accounts@donboscocollege.ac.in' : null,
    website: isDbc ? 'https://donboscocollege.ac.in' : null,
  } satisfies FeeReceiptBranding;
}
