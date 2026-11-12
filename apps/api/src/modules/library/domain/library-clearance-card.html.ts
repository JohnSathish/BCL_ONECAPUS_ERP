import {
  CLEARANCE_DECLARATION,
  accountLabel,
  booksLabel,
  duesLabel,
  type ChecklistDecision,
} from './library-clearance.logic';

export type ClearanceCardPrintModel = {
  collegeName: string;
  affiliation: string;
  place: string;
  logoDataUri: string | null;
  cardNumber: string;
  examinationName: string;
  academicYear: string;
  semesterLabel: string;
  studentName: string;
  rollNumber: string;
  registrationNumber: string;
  programme: string;
  department: string;
  academicSession: string;
  mobileNumber: string;
  booksReturned: ChecklistDecision['booksReturned'];
  duesStatus: ChecklistDecision['duesStatus'];
  lostDamagedStatus: ChecklistDecision['lostDamagedStatus'];
  accountStatus: ChecklistDecision['accountStatus'];
  status: ChecklistDecision['status'];
  remarks: string;
  librarianName: string;
  clearedOnLabel: string;
  qrDataUri: string;
};

function esc(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function line(label: string, value: string) {
  return `<div class="row"><span class="k">${esc(label)}</span><span class="c">:</span><span class="v">${esc(value || '—')}</span></div>`;
}

function check(index: number, label: string, value: string, ok: boolean) {
  return `<div class="check"><span>${index}. ${esc(label)}</span><span class="ans">: ${esc(value)}${ok ? ' ✓' : ''}</span></div>`;
}

function ticket(card: ClearanceCardPrintModel) {
  const cleared = card.status === 'CLEARED';
  const logo = card.logoDataUri
    ? `<img class="logo" src="${card.logoDataUri}" alt="" />`
    : '<div class="logo logo-fallback">DBC</div>';
  const status = cleared
    ? '<div class="status ok"><span class="badge">✓</span> LIBRARY CLEARANCE: CLEARED</div>'
    : '<div class="status wait">LIBRARY CLEARANCE: PENDING</div>';
  const statement = cleared
    ? `<p class="decl">${esc(CLEARANCE_DECLARATION)}</p>`
    : '<p class="decl pending">Library clearance is pending. This card does not certify that borrowed books have been returned or that library dues have been settled.</p>';
  const remarks = card.remarks
    ? `<p class="remarks"><strong>Remarks:</strong> ${esc(card.remarks)}</p>`
    : '';
  const librarian = card.librarianName
    ? `<p class="who">${esc(card.librarianName)}</p>`
    : '';
  return `<article class="ticket">
    <header class="college">${logo}<div class="titles"><h1>${esc(card.collegeName)}</h1>${card.affiliation ? `<p class="affil">(${esc(card.affiliation)})</p>` : ''}${card.place ? `<p class="addr">${esc(card.place)}</p>` : ''}</div><span class="balance"></span></header>
    <div class="lib"><svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true"><path d="M17 4.2C14.2 2.5 10.6 1.5 7 1.5H2.5v16.2H7c3.2 0 6.2.7 10 2.3 3.8-1.6 6.8-2.3 10-2.3h4.5V1.5H27c-3.6 0-7.2 1-10 2.7z" fill="none" stroke="#111" stroke-width="1.4"/><path d="M17 4.2v16" stroke="#111" stroke-width="1.4"/></svg><strong>LIBRARY</strong></div>
    <div class="banner">LIBRARY CLEARANCE CARD</div>
    <div class="block">
      ${line('Examination', card.examinationName)}
      ${line('Academic Year', card.academicYear)}
      ${line('Semester', card.semesterLabel)}
    </div>
    <div class="rule"></div>
    <div class="block">
      ${line('Name', card.studentName)}
      ${line('Roll No.', card.rollNumber)}
      ${line('Reg. No.', card.registrationNumber)}
      ${line('Programme', card.programme)}
      ${line('Department', card.department)}
      ${line('Semester', card.semesterLabel)}
      ${line('Academic Session', card.academicSession)}
      ${line('Mobile No.', card.mobileNumber)}
    </div>
    <h2>LIBRARY VERIFICATION</h2>
    <div class="checks">
      ${check(1, 'All borrowed books returned', booksLabel(card.booksReturned), card.booksReturned === 'YES')}
      ${check(2, 'Outstanding library dues', duesLabel(card.duesStatus), card.duesStatus === 'CLEARED')}
      ${check(3, 'Lost or damaged books', duesLabel(card.lostDamagedStatus), card.lostDamagedStatus === 'CLEARED')}
      ${check(4, 'Library account status', accountLabel(card.accountStatus), card.accountStatus === 'CLEARED')}
    </div>
    ${remarks}
    ${status}
    ${statement}
    <footer>
      <img class="qr" src="${card.qrDataUri}" alt="QR code for ${esc(card.cardNumber)}" />
      <div class="sign">
        <p><span>Cleared On</span><b>${esc(card.clearedOnLabel || '______________')}</b></p>
        <p><span>Librarian's Signature</span><b class="line"></b></p>
        ${librarian}
      </div>
      <div class="seal"><span>Official<br/>Library<br/>Seal</span></div>
    </footer>
    <p class="cardno">Clearance Card No.: ${esc(card.cardNumber)}</p>
  </article>`;
}

export function renderClearanceCardsHtml(input: {
  layout: 'single' | 'pair';
  autoPrint: boolean;
  cards: ClearanceCardPrintModel[];
}) {
  const body = input.cards.map(ticket).join('');
  const print = input.autoPrint
    ? '<script>window.addEventListener("load", function () { window.print(); });</script>'
    : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Library Clearance Card</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; }
  .sheet { width: 210mm; margin: 0 auto; padding: 8mm; }
  .ticket { border: 1.5px solid #111; padding: 12px 16px 10px; margin: 0 auto 8mm; page-break-inside: avoid; break-inside: avoid; background: #fff; }
  .layout-single .ticket { width: 148mm; }
  .layout-pair .ticket { width: 100%; }
  .layout-single .ticket { page-break-after: always; break-after: page; }
  .layout-single .ticket:last-child { page-break-after: auto; break-after: auto; }
  .layout-pair .ticket:nth-child(2n) { page-break-after: always; break-after: page; }
  .layout-pair .ticket:last-child { page-break-after: auto; break-after: auto; }
  .college { display: grid; grid-template-columns: 62px 1fr 62px; align-items: center; gap: 8px; }
  .logo { width: 58px; height: 58px; object-fit: contain; }
  .logo-fallback { display: flex; align-items: center; justify-content: center; border: 1px solid #111; font-size: 11px; font-weight: 700; }
  .titles { text-align: center; }
  h1 { margin: 0; font-size: 16px; letter-spacing: 0.02em; line-height: 1.15; }
  .affil, .addr { margin: 1px 0 0; font-size: 10px; }
  .lib { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 8px 0 6px; }
  .lib strong { font-size: 20px; letter-spacing: 0.14em; }
  .banner, .status { text-align: center; font-weight: 800; letter-spacing: 0.06em; }
  .banner { background: #111; color: #fff; border-radius: 8px; padding: 7px 10px; font-size: 14px; }
  .block { margin-top: 8px; }
  .row, .check { display: grid; grid-template-columns: 168px 12px 1fr; gap: 4px; font-size: 12px; padding: 2px 0; border-bottom: 1px dotted #222; }
  .check { grid-template-columns: 1fr auto; }
  .k { font-weight: 700; }
  .rule { border-top: 1px dashed #111; margin: 8px 0; }
  h2 { text-align: center; font-size: 14px; letter-spacing: 0.04em; margin: 10px 0 4px; }
  .status { margin-top: 12px; border-radius: 12px; padding: 8px 12px; font-size: 14px; }
  .status.ok { background: #111; color: #fff; }
  .status.wait { border: 1.5px solid #111; }
  .badge { display: inline-flex; width: 16px; height: 16px; border-radius: 50%; background: #fff; color: #111; align-items: center; justify-content: center; font-size: 12px; margin-right: 6px; }
  .decl { font-family: "Times New Roman", Times, serif; font-style: italic; text-align: center; font-size: 12px; margin: 10px 8px; line-height: 1.35; }
  .decl.pending { font-style: normal; font-family: Arial, Helvetica, sans-serif; }
  .remarks { font-size: 11px; margin: 8px 0 0; }
  footer { display: grid; grid-template-columns: 78px 1fr 78px; gap: 10px; align-items: end; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #111; }
  .qr { width: 74px; height: 74px; }
  .sign p { margin: 0 0 8px; font-size: 12px; display: flex; gap: 8px; align-items: flex-end; }
  .sign span { font-weight: 700; white-space: nowrap; }
  .sign b { font-weight: 600; }
  .line { flex: 1; border-bottom: 1px solid #111; min-width: 90px; height: 16px; }
  .who { font-size: 10px; color: #222; }
  .seal { width: 74px; height: 74px; border: 1.5px dashed #111; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 8px; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.2; }
  .cardno { text-align: center; font-weight: 800; font-size: 12px; border-top: 1px dashed #111; border-bottom: 1px dashed #111; margin: 8px 0 0; padding: 6px 0; }
  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    .sheet { width: auto; padding: 0; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body class="layout-${input.layout}"><main class="sheet">${body}</main>${print}</body></html>`;
}
