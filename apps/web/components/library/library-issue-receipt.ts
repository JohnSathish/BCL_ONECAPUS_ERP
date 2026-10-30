import JsBarcode from 'jsbarcode';

export type IssueReceiptWidth = 58 | 80;

export type IssueReceiptBook = {
  accession: string;
  title: string;
  dueAt: string;
};

export type IssueReceiptSlip = {
  width: IssueReceiptWidth;
  receiptNo: string;
  issuedAt: string;
  issuedBy: string;
  memberName: string;
  memberId: string;
  memberType: string;
  department: string;
  collegeName: string;
  address: string;
  logoUrl: string;
  books: IssueReceiptBook[];
  notes?: string;
};

function esc(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function receiptBarcode(value: string) {
  if (typeof document === 'undefined') return `<p class="code">${esc(value)}</p>`;
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, value, {
      format: 'CODE128',
      width: 1.2,
      height: 42,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    });
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    return svg.outerHTML;
  } catch {
    return '';
  }
}

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { day: '—', time: '—' };
  return {
    day: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

function dueLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function issueReceiptDocument(slip: IssueReceiptSlip) {
  const width = slip.width === 58 ? 58 : 80;
  const stamp = when(slip.issuedAt);
  const logo = slip.logoUrl ? `<img class="logo" src="${esc(slip.logoUrl)}" alt="" />` : '';
  const rows = slip.books
    .map(
      (book, index) => `<tr>
        <td class="no">${index + 1}</td>
        <td class="acc">${esc(book.accession || '—')}</td>
        <td class="title">${esc(book.title)}</td>
        <td class="due">${esc(dueLabel(book.dueAt))}</td>
      </tr>`,
    )
    .join('');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Library issue receipt ${esc(slip.receiptNo)}</title>
  <style>
    @page { size: ${width}mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    html, body {
      width: ${width}mm;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${width === 58 ? 9 : 10}px;
      line-height: 1.25;
    }
    .slip { width: 100%; padding: 1mm 1.5mm 2mm; }
    .center { text-align: center; }
    .logo { width: 11mm; height: 11mm; object-fit: contain; }
    h1 { margin: 0.6mm 0 0; font-size: ${width === 58 ? 11 : 12}px; letter-spacing: 0.02em; }
    .sub { margin: 0; font-size: ${width === 58 ? 9 : 10}px; font-weight: 700; letter-spacing: 0.12em; }
    .addr { margin: 0.4mm 0 0; font-size: ${width === 58 ? 8 : 9}px; }
    h2 { margin: 1.4mm 0 0; font-size: ${width === 58 ? 10 : 11}px; letter-spacing: 0.04em; }
    .rule { border: 0; border-top: 0.3mm dashed #000; margin: 1.2mm 0; }
    .row { display: flex; justify-content: space-between; gap: 2mm; margin: 0.4mm 0; }
    .row span { flex: 0 0 auto; }
    .row b { max-width: 62%; font-weight: 700; text-align: right; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; }
    th, td { vertical-align: top; text-align: left; padding: 0.5mm 0.4mm; }
    th { border-bottom: 0.2mm solid #000; font-size: ${width === 58 ? 7 : 8}px; }
    td { font-size: ${width === 58 ? 8 : 9}px; }
    .no { width: 8%; }
    .acc { width: 24%; word-break: break-all; }
    .title { width: 42%; }
    .due { width: 26%; }
    .count { margin: 1mm 0 0; font-weight: 700; }
    ol { margin: 0.6mm 0 0; padding-left: 4mm; }
    li { margin: 0.3mm 0; }
    .bars { width: 70%; margin: 1mm auto 0; }
    .bars svg { width: 100%; height: 12mm; display: block; }
    .code { margin: 0.4mm 0 0; font-weight: 700; letter-spacing: 0.06em; }
    .foot { margin: 1.4mm 0 0; font-style: italic; }
    .note { margin: 0.6mm 0 0; }
    @media print {
      html, body { width: ${width}mm; }
      .slip { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <article class="slip">
    <header class="center">
      ${logo}
      <h1>${esc(slip.collegeName || 'COLLEGE LIBRARY')}</h1>
      <p class="sub">LIBRARY</p>
      ${slip.address ? `<p class="addr">${esc(slip.address)}</p>` : ''}
    </header>
    <h2 class="center">LIBRARY ISSUE RECEIPT</h2>
    <hr class="rule" />
    <div class="row"><span>Member</span><b>${esc(slip.memberName)}</b></div>
    <div class="row"><span>Member ID</span><b>${esc(slip.memberId || '—')}</b></div>
    <div class="row"><span>Type</span><b>${esc(slip.memberType)}</b></div>
    <div class="row"><span>Department</span><b>${esc(slip.department || '—')}</b></div>
    <hr class="rule" />
    <div class="row"><span>Receipt No.</span><b>${esc(slip.receiptNo)}</b></div>
    <div class="row"><span>Issue date</span><b>${esc(stamp.day)}</b></div>
    <div class="row"><span>Issue time</span><b>${esc(stamp.time)}</b></div>
    ${slip.issuedBy ? `<div class="row"><span>Issued by</span><b>${esc(slip.issuedBy)}</b></div>` : ''}
    <hr class="rule" />
    <table>
      <thead>
        <tr><th>No.</th><th>Accession No.</th><th>Book Title</th><th>Due Date</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="count">Books issued: ${slip.books.length}</p>
    ${slip.notes ? `<p class="note">Note: ${esc(slip.notes)}</p>` : ''}
    <hr class="rule" />
    <p><b>Please Note:</b></p>
    <ol>
      <li>Return books on or before the due date.</li>
      <li>Late returns may attract fines as per library rules.</li>
      <li>Keep this receipt for future reference.</li>
    </ol>
    <div class="center">
      <div class="bars">${receiptBarcode(slip.receiptNo)}</div>
      <p class="code">${esc(slip.receiptNo)}</p>
      <p class="foot">Read More · Learn More · Grow More</p>
    </div>
  </article>
  <script>window.addEventListener('load', function () { window.print(); });</script>
</body>
</html>`;
}

export function printIssueReceipt(slip: IssueReceiptSlip) {
  const popup = window.open('', '_blank', 'width=420,height=720');
  if (!popup) return false;
  popup.document.open();
  popup.document.write(issueReceiptDocument(slip));
  popup.document.close();
  return true;
}

export function newIssueReceiptNo() {
  const stamp = new Date();
  const year = String(stamp.getFullYear()).slice(2);
  const month = String(stamp.getMonth() + 1).padStart(2, '0');
  const day = String(stamp.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IR${year}${month}${day}${suffix}`;
}
