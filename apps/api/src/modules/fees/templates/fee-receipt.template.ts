import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

export const FEE_RECEIPT_TEMPLATE_VERSION = 'v5';

export type ReceiptTemplateFormat = 'full' | 'half' | 'thermal';

export const RECEIPT_TEMPLATE_LABELS: Record<ReceiptTemplateFormat, string> = {
  full: 'Full A4 receipt (detailed)',
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
  collectedBy: string;
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

export function resolveAssetSrc(assetUrl?: string | null): string | null {
  if (!assetUrl) return null;
  if (
    assetUrl.startsWith('http://') ||
    assetUrl.startsWith('https://') ||
    assetUrl.startsWith('data:')
  )
    return assetUrl;
  if (assetUrl.startsWith('/uploads/') || assetUrl.startsWith('/branding/')) {
    const candidates = [
      join(process.cwd(), assetUrl.replace(/^\//, '')),
      join(process.cwd(), '..', 'web', 'public', assetUrl.replace(/^\//, '')),
    ];
    for (const absolute of candidates) {
      if (existsSync(absolute)) return pathToFileURL(absolute).href;
    }
  }
  return null;
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

  let component = 'Fee';
  if (demandType === 'MONTHLY_TUITION') component = 'Monthly Fee';
  else if (/ADMISSION|SESSION|CYCLE/i.test(demandType))
    component = 'Admission Fee';
  else if (lines.some((l) => /tuition|monthly/i.test(l.name)))
    component = 'Monthly Fee';

  const feeHead =
    String(metadata.feeCycleName ?? '') ||
    String(demand.billingPeriod ?? '') ||
    String(demand.demandNo ?? 'Fee');

  const description =
    lines.length > 0
      ? lines.map((l) => l.name).join(' · ')
      : demandType === 'MONTHLY_TUITION'
        ? `Monthly tuition · ${feeHead}`
        : String(metadata.covers ?? metadata.description ?? component);

  return { component, feeHead, description, amount };
}

export function resolveFeeCycleLabel(receipt: Record<string, unknown>) {
  const payment = receipt.payment as
    | { allocations?: Array<{ demand?: Record<string, unknown> }> }
    | undefined;
  const allocations = payment?.allocations ?? [];
  if (allocations.length === 1) {
    const demand = allocations[0].demand;
    const metadata = demand?.metadata as { feeCycleName?: string } | undefined;
    const receiptDemand = receipt.demand as
      | { metadata?: { feeCycleName?: string }; billingPeriod?: string }
      | undefined;
    return (
      metadata?.feeCycleName ??
      demand?.billingPeriod ??
      receiptDemand?.metadata?.feeCycleName ??
      '—'
    );
  }
  if (allocations.length > 1) return 'Multiple fee heads';
  const receiptDemand = receipt.demand as
    | { metadata?: { feeCycleName?: string }; billingPeriod?: string }
    | undefined;
  return (
    receiptDemand?.metadata?.feeCycleName ?? receiptDemand?.billingPeriod ?? '—'
  );
}

export function buildFeeReceiptStorageKey(
  tenantId: string,
  receiptNo: string,
  format: ReceiptTemplateFormat = 'half',
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
      // Half of portrait A4: 210mm wide × 148mm tall (two stack on one A4 when cut)
      return {
        width: '210mm',
        height: '148mm',
        landscape: false,
        preferCSSPageSize: true,
        printBackground: true,
        margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' },
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

function linePeriod(line: FeeReceiptLine, feeCycle: string) {
  if (/^\d{4}-\d{2}$/.test(line.feeHead)) return line.feeHead;
  if (/monthly/i.test(line.component) && feeCycle !== '—') return feeCycle;
  return line.feeHead || '—';
}

export function buildFeeReceiptHtml(
  data: FeeReceiptHtmlInput,
  format: ReceiptTemplateFormat = 'half',
) {
  if (format === 'full') return buildFullFeeReceiptHtml(data);
  if (format === 'thermal') return buildThermalFeeReceiptHtml(data);
  return buildHalfCompactFeeReceiptHtml(data);
}

function buildHalfCompactFeeReceiptHtml(data: FeeReceiptHtmlInput) {
  const b = data.branding;
  const primary = '#0F172A';
  const secondary = '#1E293B';
  const accent = '#2563EB';
  const success = '#16A34A';
  const muted = '#64748B';
  const bg = '#F8FAFC';
  const paidAt = data.paidAt ?? data.date;

  const logoBlock = b.logoSrc
    ? `<img class="logo" src="${b.logoSrc}" alt="" />`
    : `<div class="logo-ph">${b.logoPlaceholder ?? 'DBC<br/>Tura'}</div>`;

  const lineRows = data.lines
    .map(
      (line, index) => `
      <tr>
        <td class="c">${index + 1}</td>
        <td>${escapeHtml(line.component)}</td>
        <td>${escapeHtml(linePeriod(line, data.feeCycle))}</td>
        <td>${escapeHtml(line.description)}</td>
        <td class="amt">${inr(line.amount)}</td>
      </tr>`,
    )
    .join('');

  const statusClass = /success|paid/i.test(data.paymentStatus)
    ? 'status-ok'
    : 'status-warn';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=88x88&data=${encodeURIComponent(data.verifyUrl)}`;
  const verifyHost = data.verifyUrl.replace(/^https?:\/\//, '');

  const affiliation = b.affiliationLine
    ? `(${escapeHtml(b.affiliationLine)})`
    : '';
  const accreditation = [
    b.accreditationLine,
    b.establishedYear ? `ESTD. ${b.establishedYear}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    /* Half of portrait A4 — 210mm × 148mm, not landscape */
    @page { size: 210mm 148mm; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, Roboto, 'Segoe UI', sans-serif;
      font-size: 8px;
      line-height: 1.35;
      color: ${primary};
      background: #fff;
    }
    .receipt { width: 100%; }

    .top {
      display: grid;
      grid-template-columns: 52px 1fr 118px;
      gap: 8px;
      align-items: start;
      padding-bottom: 6px;
      border-bottom: 2px solid ${primary};
      margin-bottom: 6px;
    }
    .logo { width: 48px; height: 48px; object-fit: contain; border-radius: 50%; }
    .logo-ph {
      width: 48px; height: 48px; border-radius: 50%;
      border: 1.5px solid ${secondary};
      display: flex; align-items: center; justify-content: center;
      text-align: center; font-size: 6px; font-weight: 700;
      color: ${secondary}; line-height: 1.15; padding: 4px;
      background: ${bg};
    }
    .college { text-align: center; padding-top: 1px; }
    .college h1 {
      font-size: 13px; font-weight: 800; color: ${primary};
      letter-spacing: 0.3px; text-transform: uppercase; line-height: 1.15;
    }
    .college .addr { font-size: 7px; color: ${muted}; margin-top: 2px; }
    .college .aff { font-size: 6.5px; color: ${muted}; margin-top: 1px; }
    .college .motto { font-size: 6.5px; color: ${muted}; font-style: italic; margin-top: 2px; }

    .rcpt-side { text-align: right; }
    .rcpt-badge {
      background: ${primary}; color: #fff;
      font-size: 7px; font-weight: 800; letter-spacing: 0.4px;
      padding: 3px 6px; text-transform: uppercase;
      display: inline-block; margin-bottom: 4px;
    }
    .rcpt-no-box {
      border: 1.5px solid ${accent};
      border-radius: 3px; overflow: hidden;
      text-align: center; margin-bottom: 3px;
    }
    .rcpt-no-label {
      background: ${secondary}; color: #fff;
      font-size: 6px; font-weight: 700; padding: 2px 4px;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .rcpt-no-value {
      background: #fff; color: ${accent};
      font-size: 8px; font-weight: 800; padding: 4px 5px;
      font-family: Consolas, monospace;
    }
    .rcpt-date { font-size: 7px; color: ${muted}; font-weight: 600; }

    .dual {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 6px;
    }
    .panel {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      background: #fff;
    }
    .panel-head {
      background: ${primary};
      color: #fff;
      font-size: 7px; font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.35px;
      padding: 4px 6px;
    }
    .panel-body { padding: 5px 6px; background: ${bg}; }
    .kv {
      display: grid;
      grid-template-columns: 72px 1fr;
      gap: 2px 6px;
      font-size: 7.5px;
      margin-bottom: 2px;
    }
    .kv .k { color: ${muted}; font-weight: 600; }
    .kv .v { color: ${primary}; font-weight: 600; }
    .status-ok { color: ${success} !important; font-weight: 800 !important; }
    .status-warn { color: #b45309 !important; font-weight: 800 !important; }

    .fee-title {
      font-size: 7px; font-weight: 800; color: ${primary};
      text-transform: uppercase; letter-spacing: 0.35px;
      margin-bottom: 3px;
    }
    table { width: 100%; border-collapse: collapse; font-size: 7.5px; }
    thead th {
      background: ${primary}; color: #fff;
      font-size: 6.5px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.25px;
      padding: 4px 5px; text-align: left;
      border-right: 1px solid rgba(255,255,255,0.12);
    }
    thead th:last-child { border-right: none; text-align: right; }
    tbody td {
      border: 1px solid #e2e8f0;
      padding: 3px 5px;
      vertical-align: top;
      color: ${primary};
    }
    td.c { text-align: center; width: 22px; color: ${muted}; }
    td.amt { text-align: right; font-weight: 700; white-space: nowrap; }
    tr.total td {
      background: ${bg};
      border-top: 2px solid ${primary};
      font-weight: 800; font-size: 8px; color: ${primary};
    }

    .words {
      margin: 5px 0 6px;
      padding: 4px 6px;
      background: ${bg};
      border: 1px dashed #cbd5e1;
      border-radius: 3px;
      font-size: 7.5px;
      color: ${muted};
    }
    .words strong { color: ${primary}; }

    .bottom {
      display: grid;
      grid-template-columns: 1fr 1fr 0.75fr;
      gap: 8px;
      align-items: end;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }
    .qr-wrap { display: flex; gap: 6px; align-items: center; }
    .qr-wrap img { width: 52px; height: 52px; border: 1px solid #e2e8f0; }
    .qr-meta { font-size: 6.5px; color: ${muted}; line-height: 1.4; }
    .qr-meta strong { display: block; color: ${primary}; font-size: 7px; margin-bottom: 2px; }
    .sign-box { text-align: center; }
    .sign-scribble {
      height: 22px; margin-bottom: 2px;
      font-family: 'Segoe Script', cursive;
      font-size: 14px; color: ${accent};
    }
    .sign-line {
      border-top: 1px solid ${secondary};
      padding-top: 3px;
      font-size: 7px; font-weight: 700;
      color: ${primary};
    }
    .thanks {
      text-align: right;
      font-size: 11px; font-weight: 800;
      color: ${accent};
      letter-spacing: 0.5px;
    }
    .thanks small {
      display: block;
      font-size: 6px;
      font-weight: 500;
      color: ${muted};
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <header class="top">
      <div>${logoBlock}</div>
      <div class="college">
        <h1>${escapeHtml(b.collegeName)}</h1>
        ${b.addressLine ? `<p class="addr">${escapeHtml(b.addressLine)}</p>` : ''}
        ${affiliation ? `<p class="aff">${affiliation}${accreditation ? ` · ${escapeHtml(accreditation)}` : ''}</p>` : accreditation ? `<p class="aff">${escapeHtml(accreditation)}</p>` : ''}
        ${b.motto ? `<p class="motto">${escapeHtml(b.motto)}</p>` : ''}
      </div>
      <div class="rcpt-side">
        <div class="rcpt-badge">Official Fee Receipt</div>
        <div class="rcpt-no-box">
          <div class="rcpt-no-label">Receipt No.</div>
          <div class="rcpt-no-value">${escapeHtml(data.receiptNo)}</div>
        </div>
        <div class="rcpt-date">DATE: ${formatReceiptDateCompact(data.date)}</div>
      </div>
    </header>

    <div class="dual">
      <div class="panel">
        <div class="panel-head">Student Details</div>
        <div class="panel-body">
          <div class="kv"><span class="k">Name</span><span class="v">${escapeHtml(data.studentName)}</span></div>
          <div class="kv"><span class="k">Enrollment</span><span class="v">${escapeHtml(data.enrollmentNumber)}</span></div>
          <div class="kv"><span class="k">Programme</span><span class="v">${escapeHtml(data.programme)}</span></div>
          <div class="kv"><span class="k">Semester</span><span class="v">${escapeHtml(data.semester)}</span></div>
          <div class="kv"><span class="k">Fee Cycle</span><span class="v">${escapeHtml(data.feeCycle)}</span></div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">Payment Details</div>
        <div class="panel-body">
          <div class="kv"><span class="k">Mode</span><span class="v">${escapeHtml(data.paymentMode.replace(/_/g, ' '))}</span></div>
          <div class="kv"><span class="k">Transaction</span><span class="v">${escapeHtml(data.transactionRef)}</span></div>
          <div class="kv"><span class="k">Payment Date</span><span class="v">${formatReceiptDateTime(paidAt)}</span></div>
          <div class="kv"><span class="k">Collected By</span><span class="v">${escapeHtml(data.collectedBy)}</span></div>
          <div class="kv"><span class="k">Status</span><span class="v ${statusClass}">${escapeHtml(data.paymentStatus)}</span></div>
        </div>
      </div>
    </div>

    <div class="fee-title">Fee Details</div>
    <table>
      <thead>
        <tr>
          <th>Sl.</th>
          <th>Fee Head</th>
          <th>Period</th>
          <th>Description</th>
          <th>Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows}
        <tr class="total">
          <td colspan="4">Total Paid</td>
          <td class="amt">${inr(data.amount)}</td>
        </tr>
      </tbody>
    </table>

    <p class="words"><strong>In words:</strong> ${amountInWords(data.amount)}</p>

    <footer class="bottom">
      <div class="qr-wrap">
        <img src="${qrUrl}" alt="Verify" />
        <div class="qr-meta">
          <strong>Verify Receipt</strong>
          Scan QR or visit<br/>${escapeHtml(verifyHost)}
        </div>
      </div>
      <div class="sign-box">
        <div class="sign-scribble">Authorized</div>
        <div class="sign-line">Authorized Signatory</div>
      </div>
      <div class="thanks">
        THANK YOU!
        <small>Computer-generated receipt</small>
      </div>
    </footer>
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
  const primary = b.primaryColor || '#1e3a5f';
  const accent = b.accentColor || '#c8102e';
  const paidAt = data.paidAt ?? data.date;
  const paidAtText = paidAt.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateText = data.date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const logoBlock = b.logoSrc
    ? `<img class="logo" src="${b.logoSrc}" alt="" />`
    : `<div class="logo-placeholder">${b.logoPlaceholder ?? 'College<br/>Logo'}</div>`;

  const watermark = b.logoSrc
    ? `<img class="watermark" src="${b.logoSrc}" alt="" />`
    : `<div class="watermark-text">${escapeHtml(b.collegeName.split(' ').slice(0, 2).join(' '))}</div>`;

  const lineRows = data.lines
    .map(
      (line, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(line.component)}</td>
        <td>${escapeHtml(line.feeHead)}</td>
        <td>${escapeHtml(line.description)}</td>
        <td class="amt">${inr(line.amount)}</td>
      </tr>`,
    )
    .join('');

  const statusClass = /success|paid/i.test(data.paymentStatus)
    ? 'status-ok'
    : 'status-pending';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(data.verifyUrl)}`;

  const footerContact = [
    b.addressLine ? `📍 ${b.addressLine}` : null,
    b.phone ? `📞 ${b.phone}` : null,
    b.email ? `✉ ${b.email}` : null,
    b.website ? `🌐 ${b.website}` : null,
  ]
    .filter(Boolean)
    .join(' &nbsp;|&nbsp; ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #1f2937;
      font-size: 11px;
      line-height: 1.45;
    }
    .sheet {
      position: relative;
      min-height: 260mm;
      padding: 0 2px;
      overflow: hidden;
    }
    .watermark, .watermark-text {
      position: absolute;
      left: 50%;
      top: 48%;
      transform: translate(-50%, -50%);
      opacity: 0.05;
      z-index: 0;
      pointer-events: none;
    }
    .watermark { width: 320px; height: 320px; object-fit: contain; }
    .watermark-text {
      font-size: 56px;
      font-weight: 800;
      color: ${primary};
      text-align: center;
      white-space: nowrap;
    }
    .content { position: relative; z-index: 1; }

    .header {
      display: grid;
      grid-template-columns: 88px 1fr 190px;
      gap: 14px;
      align-items: start;
      padding-bottom: 12px;
      border-bottom: 3px solid ${primary};
      margin-bottom: 14px;
    }
    .logo { width: 76px; height: 76px; object-fit: contain; }
    .logo-placeholder {
      width: 76px;
      height: 76px;
      border: 2px solid ${primary};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 9px;
      font-weight: 700;
      color: ${primary};
      line-height: 1.2;
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
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }
    .inst-line { margin: 2px 0 0; font-size: 10px; color: #475569; }
    .inst-motto { margin: 4px 0 0; font-size: 9px; color: #64748b; font-style: italic; }

    .receipt-box { text-align: right; }
    .receipt-title {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.6px;
      color: ${primary};
      text-transform: uppercase;
    }
    .receipt-no-wrap {
      border: 2px solid ${primary};
      border-radius: 4px;
      overflow: hidden;
      background: ${primary};
    }
    .receipt-no-label {
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.5px;
      padding: 4px 8px;
      text-transform: uppercase;
    }
    .receipt-no-value {
      background: #fff;
      color: ${accent};
      font-size: 12px;
      font-weight: 800;
      padding: 8px 10px;
      font-family: Consolas, monospace;
    }
    .receipt-date { margin-top: 8px; font-size: 10px; color: #334155; }

    .panels {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    .panel {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      background: #fff;
    }
    .panel-head {
      background: ${primary};
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      padding: 7px 10px;
    }
    .panel-body { padding: 10px 12px; }
    .field { margin: 0 0 6px; font-size: 10.5px; }
    .field strong { color: #334155; font-weight: 700; }
    .field span { color: #111827; }

    .table-wrap {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 10px;
      background: #fff;
    }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: ${primary};
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 8px 8px;
      text-align: left;
      border-right: 1px solid rgba(255,255,255,0.15);
    }
    thead th:last-child { border-right: none; text-align: right; }
    tbody td {
      border-top: 1px solid #e2e8f0;
      border-right: 1px solid #f1f5f9;
      padding: 8px;
      font-size: 10.5px;
      vertical-align: top;
    }
    tbody td:last-child { border-right: none; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    td.center { text-align: center; width: 34px; }
    td.amt { text-align: right; font-weight: 700; white-space: nowrap; }
    .total-row td {
      background: #eff6ff !important;
      border-top: 2px solid ${primary};
      font-weight: 800;
      font-size: 12px;
      color: ${primary};
    }
    .words {
      margin: 0 0 14px;
      padding: 8px 10px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      font-size: 10.5px;
      color: #334155;
    }

    .footer-panels {
      display: grid;
      grid-template-columns: 1.1fr 1fr 0.9fr;
      gap: 10px;
      margin-top: 8px;
      margin-bottom: 14px;
    }
    .note-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      background: #fff;
      min-height: 108px;
    }
    .note-title { margin: 0 0 6px; font-size: 10px; font-weight: 800; color: ${primary}; text-transform: uppercase; }
    .note-body { margin: 0; font-size: 9.5px; color: #475569; line-height: 1.5; }
    .sign-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      text-align: center;
      background: #fff;
      min-height: 108px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sign-line {
      margin-top: 28px;
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      font-size: 10px;
      font-weight: 700;
      color: ${primary};
    }
    .qr img { width: 72px; height: 72px; }
    .qr p { margin: 4px 0 0; font-size: 9px; color: #64748b; }

    .bottom-bar {
      background: ${primary};
      color: #fff;
      border-radius: 4px;
      padding: 9px 12px;
      font-size: 9px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .bottom-bar a { color: #dbeafe; text-decoration: none; }
    .status-ok { color: #047857; font-weight: 800; }
    .status-pending { color: #b45309; font-weight: 800; }
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
          ${b.addressLine ? `<p class="inst-line">${escapeHtml(b.addressLine)}</p>` : ''}
          ${b.affiliationLine ? `<p class="inst-line">${escapeHtml(b.affiliationLine)}</p>` : ''}
          ${b.accreditationLine ? `<p class="inst-line">${escapeHtml(b.accreditationLine)}</p>` : ''}
          ${b.establishedYear ? `<p class="inst-line">ESTD. ${escapeHtml(b.establishedYear)}</p>` : ''}
          ${b.motto ? `<p class="inst-motto">${escapeHtml(b.motto)}</p>` : ''}
        </div>
        <div class="receipt-box">
          <p class="receipt-title">Official Fee Receipt</p>
          <div class="receipt-no-wrap">
            <div class="receipt-no-label">Receipt No.</div>
            <div class="receipt-no-value">${escapeHtml(data.receiptNo)}</div>
          </div>
          <p class="receipt-date"><strong>Date:</strong> ${dateText}</p>
        </div>
      </div>

      <div class="panels">
        <div class="panel">
          <div class="panel-head">Student Details</div>
          <div class="panel-body">
            <p class="field"><strong>Student Name:</strong> <span>${escapeHtml(data.studentName)}</span></p>
            <p class="field"><strong>Enrollment No.:</strong> <span>${escapeHtml(data.enrollmentNumber)}</span></p>
            <p class="field"><strong>Application No.:</strong> <span>${escapeHtml(data.applicationNo)}</span></p>
            <p class="field"><strong>Programme:</strong> <span>${escapeHtml(data.programme)}</span></p>
            <p class="field"><strong>Semester:</strong> <span>${escapeHtml(data.semester)}</span></p>
            <p class="field"><strong>Fee Cycle:</strong> <span>${escapeHtml(data.feeCycle)}</span></p>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head">Payment Details</div>
          <div class="panel-body">
            <p class="field"><strong>Payment Mode:</strong> <span>${escapeHtml(data.paymentMode.replace(/_/g, ' '))}</span></p>
            <p class="field"><strong>Transaction Ref.:</strong> <span>${escapeHtml(data.transactionRef)}</span></p>
            <p class="field"><strong>Payment Date/Time:</strong> <span>${paidAtText}</span></p>
            <p class="field"><strong>Collected By:</strong> <span>${escapeHtml(data.collectedBy)}</span></p>
            <p class="field"><strong>Payment Status:</strong> <span class="${statusClass}">${escapeHtml(data.paymentStatus)}</span></p>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sl. No.</th>
              <th>Fee Component</th>
              <th>Fee Head</th>
              <th>Description</th>
              <th>Amount (₹)</th>
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

      <p class="words"><strong>Amount in words:</strong> (${amountInWords(data.amount)})</p>

      <div class="footer-panels">
        <div class="note-box">
          <p class="note-title">Thank you!</p>
          <p class="note-body">
            Thank you for your payment. Please retain this receipt for your records.
            ${b.motto ? `<br/><em>${escapeHtml(b.motto)}</em>` : ''}
          </p>
        </div>
        <div class="note-box">
          <p class="note-title">Important</p>
          <p class="note-body">
            This is a computer-generated official fee receipt. It does not require a physical signature.
            For verification, scan the QR code or visit the verify link on the college portal.
          </p>
        </div>
        <div class="sign-box">
          <div class="qr">
            <img src="${qrUrl}" alt="Verify receipt" />
            <p>Scan to Verify</p>
          </div>
          <div class="sign-line">Authorized Signatory</div>
        </div>
      </div>

      <div class="bottom-bar">
        <span>${footerContact || escapeHtml(b.collegeName)}</span>
        <span>Verify: <a href="${escapeHtml(data.verifyUrl)}">${escapeHtml(data.verifyUrl)}</a></span>
      </div>
    </div>
  </div>
</body>
</html>`;
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
    (isDbc ? 'Affiliated to North Eastern Hill University, Shillong' : null);
  const accreditationLine =
    badges.find((b) => /naac/i.test(b)) ?? (isDbc ? 'NAAC Accredited' : null);

  const logoUrl = (branding?.logoUrl as string | null) ?? null;
  const logoSrc = resolveAssetSrc(logoUrl);

  return {
    collegeName: displayName.toUpperCase(),
    addressLine: (branding?.address as string | null) ?? null,
    affiliationLine,
    accreditationLine,
    motto: isDbc ? 'Wisdom · Love · Service' : null,
    establishedYear: isDbc ? '1970' : null,
    logoSrc,
    logoPlaceholder: isDbc
      ? 'Don Bosco<br/>College<br/>Tura'
      : displayName.split(' ').slice(0, 3).join('<br/>'),
    primaryColor: (branding?.primaryColor as string | null) ?? '#1e3a5f',
    accentColor: (branding?.accentColor as string | null) ?? '#c8102e',
    phone: isDbc ? '+91 98562 12345 / +91 94025 67890' : null,
    email: isDbc ? 'accounts@donboscocollege.ac.in' : null,
    website: isDbc ? 'https://erp.donboscocollege.ac.in' : null,
  } satisfies FeeReceiptBranding;
}
