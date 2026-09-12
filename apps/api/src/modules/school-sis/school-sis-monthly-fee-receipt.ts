export function money(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

export type MonthlyFeeReceiptView = {
  schoolName: string;
  schoolAddress: string;
  logoUrl?: string | null;
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
};

function slip(
  view: MonthlyFeeReceiptView,
  copy: "Parent's copy" | 'School copy',
) {
  const instructions = view.instructions.length
    ? view.instructions
    : [
        'Fees are to be paid before the 15th of every month.',
        'Annual Fees and Jan. & Feb. Tuition Fees to be paid at the time of Admission.',
        'Pupils with dues may be barred from sitting for the Examinations.',
        'Fees once paid are not refundable.',
      ];
  return `
  <article class="slip">
    <header>
      ${view.logoUrl ? `<img class="logo" src="${esc(view.logoUrl)}" alt="" />` : ''}
      <p class="month">${esc(monthLabel(view.feeMonth))}</p>
      <h1>${esc(view.schoolName)}</h1>
      <p class="addr">${esc(view.schoolAddress)}</p>
    </header>
    <p class="line"><span>Pupil's Name</span><b>${esc(view.studentName)}</b></p>
    <p class="line"><span>Admission No.</span><b>${esc(view.admissionNumber)}</b></p>
    <p class="line"><span>Class</span><b>${esc(view.className)} ${esc(view.sectionName)}</b></p>
    <table>
      <tr><td>Tuition Fee</td><td>${money(view.tuitionAmount)}</td></tr>
      <tr><td>Late Fee</td><td>${money(view.lateFeeAmount)}</td></tr>
      ${view.otherAmount ? `<tr><td>Other Fee</td><td>${money(view.otherAmount)}</td></tr>` : ''}
      ${view.discountAmount ? `<tr><td>Concession</td><td>− ${money(view.discountAmount)}</td></tr>` : ''}
      ${view.previousBalance ? `<tr><td>Previous Balance</td><td>${money(view.previousBalance)}</td></tr>` : ''}
      <tr class="total"><td>Total Rs.</td><td>${money(view.totalAmount)}</td></tr>
    </table>
    <p class="meta">Fee Book ${esc(view.receiptNumber)} · ${esc(view.academicYear)} · ${esc(view.paymentMode)}${view.reference ? ` · ${esc(view.reference)}` : ''}</p>
    <p class="meta">Date ${esc(view.paidAt)}</p>
    <div class="foot">
      <span>${copy}</span>
      <span>Signature<br/><small>${esc(view.signatoryName || 'Authorized signatory')}</small></span>
    </div>
    <aside class="notes">
      <strong>General instructions</strong>
      <ol>${instructions.map((item) => `<li>${esc(item)}</li>`).join('')}</ol>
    </aside>
  </article>`;
}

export function monthlyFeeReceiptHtml(view: MonthlyFeeReceiptView) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Fee receipt ${esc(view.receiptNumber)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Times New Roman", Georgia, serif; color: #111; background: #fff; }
    .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; min-height: 180mm; }
    .slip { border: 1px solid #111; padding: 14px 16px 12px; position: relative; }
    header { text-align: center; margin-bottom: 8px; }
    .logo { height: 42px; margin-bottom: 4px; }
    h1 { font-size: 18px; margin: 0; }
    .addr, .month { margin: 0; font-size: 13px; }
    .month { font-weight: 700; margin-bottom: 2px; }
    .line { display: flex; justify-content: space-between; border-bottom: 1px dotted #333; margin: 6px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    td { border: 1px solid #111; padding: 6px 8px; }
    td:last-child { text-align: right; width: 38%; }
    tr.total td { font-weight: 700; }
    .meta { font-size: 12px; margin: 8px 0 0; }
    .foot { display: flex; justify-content: space-between; margin-top: 18px; font-size: 13px; }
    .notes { margin-top: 10px; border: 1px solid #111; border-radius: 10px; padding: 6px 10px; font-size: 11px; }
    .notes ol { margin: 4px 0 0; padding-left: 18px; }
    @media print { body { -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="sheet">
    ${slip(view, "Parent's copy")}
    ${slip(view, 'School copy')}
  </div>
</body>
</html>`;
}
