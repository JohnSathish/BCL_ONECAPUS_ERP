import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function money(n: number) {
  return Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function monthLabel(feeMonth: string) {
  const [y, m] = feeMonth.split('-').map(Number);
  if (!y || !m) return feeMonth;
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function esc(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function schoolLogoDataUri() {
  const candidates = [
    join(process.cwd(), 'apps/web/public/school-sis/st-lukes-logo.png'),
    join(process.cwd(), '../web/public/school-sis/st-lukes-logo.png'),
    join(process.cwd(), '../../apps/web/public/school-sis/st-lukes-logo.png'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const buf = readFileSync(file);
    return `data:image/png;base64,${buf.toString('base64')}`;
  }
  return null;
}

export type MonthlyFeeReceiptView = {
  schoolName: string;
  schoolAddress: string;
  logoUrl?: string | null;
  motto?: string | null;
  signatoryName?: string | null;
  instructions: string[];
  receiptNumber: string;
  paidAt: string;
  academicYear: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  sectionName: string;
  feeMonth: string;
  tuitionAmount: number;
  lateFeeAmount: number;
  otherAmount: number;
  discountAmount: number;
  previousBalance: number;
  totalAmount: number;
  paymentMode: string;
  reference?: string | null;
  gatewayName?: string | null;
  gatewayPaymentId?: string | null;
  monthsCovered?: string[];
  otherLabel?: string;
};

const DEFAULT_INSTRUCTIONS = [
  'Fees are to be paid before the 15th of every month.',
  'Annual Fees and Jan. & Feb. Tuition Fees to be paid at the time of Admission.',
  'Pupils with dues may be barred from sitting for the Examinations.',
  'Fees once paid are not refundable.',
];

function slip(
  view: MonthlyFeeReceiptView,
  copy: "Parent's Copy" | 'School Copy',
  logoSrc: string | null,
) {
  const instructions = view.instructions.length
    ? view.instructions
    : DEFAULT_INSTRUCTIONS;
  const months = view.monthsCovered?.length
    ? view.monthsCovered.join(', ')
    : monthLabel(view.feeMonth);
  const classLabel = `${view.className} ${view.sectionName}`.trim();
  const motto = view.motto || 'Knowledge · Service · Light';
  const rows = [
    ['Tuition Fee', money(view.tuitionAmount)],
    ...(view.otherAmount || view.otherLabel === 'Computer Fee'
      ? [[view.otherLabel || 'Computer Fee', money(view.otherAmount)]]
      : []),
    ['Late Fee', money(view.lateFeeAmount)],
    ...(view.discountAmount
      ? [['Concession', `− ${money(view.discountAmount)}`]]
      : []),
    ...(view.previousBalance
      ? [['Previous Balance', money(view.previousBalance)]]
      : []),
  ];
  return `
  <article class="slip">
    <header>
      <div class="brand">
        ${logoSrc ? `<img class="crest" src="${esc(logoSrc)}" alt="" />` : '<div class="crest-fallback">SLS</div>'}
        <div>
          <h1>${esc(view.schoolName)}</h1>
          <p class="addr">${esc(view.schoolAddress)}</p>
          <p class="motto">${esc(motto)}</p>
        </div>
      </div>
      <div class="banner">
        <span>FEE RECEIPT</span>
        <span class="banner-right">
          <b>${esc(months)}</b>
          <small>Academic Year: ${esc(view.academicYear)}</small>
        </span>
      </div>
    </header>
    <section class="pupil">
      <p><span>Pupil's Name</span><b>${esc(view.studentName)}</b></p>
      <p><span>Admission No.</span><b>${esc(view.admissionNumber)}</b></p>
      <p><span>Class &amp; Section</span><b>${esc(classLabel)}</b></p>
    </section>
    <table>
      <thead>
        <tr><th>Particulars</th><th>Amount (Rs.)</th></tr>
      </thead>
      <tbody>
        ${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
        <tr class="total"><td>Total Amount</td><td>${money(view.totalAmount)}</td></tr>
      </tbody>
    </table>
    <section class="meta">
      <p><span>Receipt No.</span><b>${esc(view.receiptNumber)}</b></p>
      <p><span>Payment Mode</span><b>${esc(view.paymentMode)}${view.reference ? ` · ${esc(view.reference)}` : ''}</b></p>
      ${view.gatewayName ? `<p><span>Gateway</span><b>${esc(view.gatewayName)}</b></p>` : ''}
      ${view.gatewayPaymentId ? `<p><span>Gateway Txn</span><b>${esc(view.gatewayPaymentId)}</b></p>` : ''}
      <p><span>Date &amp; Time</span><b>${esc(view.paidAt)}</b></p>
    </section>
    <aside class="notes">
      <strong>General Instructions</strong>
      <ol>${instructions.map((item, i) => `<li><b>${i + 1}.</b> ${esc(item)}</li>`).join('')}</ol>
    </aside>
    <footer>
      <span class="pill">${copy}</span>
      <span class="sign">
        Signature
        <small>${esc(view.signatoryName || 'Authorized Signatory')}</small>
      </span>
    </footer>
    <p class="thanks">Thank you for your support</p>
  </article>`;
}

export function monthlyFeeReceiptHtml(view: MonthlyFeeReceiptView) {
  const logoSrc = view.logoUrl?.startsWith('data:')
    ? view.logoUrl
    : view.logoUrl && view.logoUrl.startsWith('http')
      ? view.logoUrl
      : schoolLogoDataUri() || view.logoUrl || null;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Fee receipt ${esc(view.receiptNumber)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", Calibri, Arial, sans-serif; color: #1a365d; background: #eef2f7; }
    .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .slip { background: #fff; border: 1.5px solid #1a365d; border-radius: 10px; padding: 14px 16px 10px; min-height: 178mm; display: flex; flex-direction: column; }
    .brand { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
    .crest { width: 52px; height: 52px; object-fit: contain; }
    .crest-fallback { width: 52px; height: 52px; border-radius: 50%; background: #1a365d; color: #c5a572; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    h1 { margin: 0; font-size: 16px; color: #1a365d; }
    .addr { margin: 2px 0 0; font-size: 11px; color: #334155; }
    .motto { margin: 2px 0 0; font-size: 10px; font-style: italic; color: #1a365d; }
    .banner { display: flex; justify-content: space-between; align-items: center; background: #1a365d; color: #fff; border-radius: 6px; padding: 8px 12px; }
    .banner > span:first-child { font-size: 15px; font-weight: 800; letter-spacing: 0.06em; }
    .banner-right { text-align: right; line-height: 1.2; }
    .banner-right b { display: block; font-size: 13px; }
    .banner-right small { font-size: 10px; opacity: 0.9; }
    .pupil { background: #e8eef6; border-radius: 6px; padding: 8px 10px; margin: 10px 0; font-size: 12px; }
    .pupil p { display: flex; justify-content: space-between; gap: 8px; margin: 3px 0; }
    .pupil span { color: #475569; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; background: #1a365d; color: #fff; padding: 6px 8px; }
    th:last-child, td:last-child { text-align: right; }
    td { padding: 6px 8px; border-bottom: 1px solid #dbe4f0; }
    tr.total td { background: #1a365d; color: #fff; font-weight: 700; border: 0; }
    .meta { margin: 10px 0 8px; font-size: 12px; }
    .meta p { display: flex; justify-content: space-between; margin: 3px 0; }
    .notes { border: 1px solid #1a365d; border-radius: 8px; padding: 8px 10px; font-size: 10.5px; color: #1e293b; }
    .notes ol { margin: 4px 0 0; padding-left: 0; list-style: none; }
    .notes li { margin: 2px 0; }
    footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; padding-top: 14px; }
    .pill { background: #1a365d; color: #fff; border-radius: 999px; padding: 6px 12px; font-size: 11px; font-weight: 700; }
    .sign { text-align: right; font-size: 11px; color: #1a365d; }
    .sign small { display: block; color: #64748b; }
    .thanks { margin: 8px 0 0; font-size: 10px; color: #64748b; font-style: italic; }
    @media print { body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="sheet">
    ${slip(view, "Parent's Copy", logoSrc)}
    ${slip(view, 'School Copy', logoSrc)}
  </div>
</body>
</html>`;
}
