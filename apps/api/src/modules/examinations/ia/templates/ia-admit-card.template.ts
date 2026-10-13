export type IaAdmitCardTemplateInput = {
  institution: {
    name: string;
    displayName?: string | null;
    address?: string | null;
    logoUrl?: string | null;
    affiliation?: string | null;
    contact?: string | null;
  };
  session: {
    name: string;
    examType?: string;
    semesterNo?: number | null;
    semesterLabel?: string | null;
    academicYear?: string | null;
    instructions?: string | null;
    shiftName?: string | null;
  };
  student: {
    fullName?: string | null;
    rollNumber?: string | null;
    enrollmentNumber?: string | null;
    admissionNumber?: string | null;
    universityRollNumber?: string | null;
    abcId?: string | null;
    programme?: string | null;
    department?: string | null;
    semesterNo?: number | null;
    semesterLabel?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    fatherName?: string | null;
    motherName?: string | null;
    photoUrl?: string | null;
  };
  papers: Array<{
    paperCode: string;
    paperName: string;
    paperType?: string | null;
    maxMarks?: number | null;
    examDate: string;
    startTime: string;
    endTime: string;
  }>;
  admitCardNumber: string;
  verifyCode: string;
  qrDataUrl?: string | null;
  verifyUrl?: string | null;
  generatedAt?: string;
  watermark?: string;
};

function esc(value?: string | null) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('en-GB').replace(/\//g, '-');
}

function fmtTime(value?: string | null) {
  if (!value) return '—';
  const s = String(value);
  const plainTime = s.match(/^(\d{1,2}):(\d{2})/);
  if (plainTime && !/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const h = Number(plainTime[1]);
    const m = Number(plainTime[2]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  return '—';
}

function qrImg(card: IaAdmitCardTemplateInput) {
  const src =
    card.qrDataUrl ??
    (card.verifyUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(card.verifyUrl)}`
      : null);
  if (src) {
    return `<img src="${esc(src)}" alt="QR" width="72" height="72" />`;
  }
  return `<div>Verify: ${esc(card.verifyCode)}</div>`;
}

const DEFAULT_INSTRUCTIONS = [
  'Report to the examination hall 15 minutes before the scheduled time.',
  'Carry this admit card and valid college ID without fail.',
  'Mobile phones and electronic devices are strictly prohibited.',
  'Use only blue/black ink pen unless otherwise instructed.',
  'Malpractice will lead to cancellation of examination.',
];

const IA_ADMIT_CARD_STYLES = `
  @page { size: A4 portrait; margin: 6mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: auto;
    overflow: visible;
    background: #fff;
  }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #0f172a;
    font-size: 11px;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    position: relative;
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 4mm 3.5mm;
    border: 2px solid #1e3a8a;
    background: #fff;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .page + .page {
    page-break-before: always;
    break-before: page;
  }
  .watermark {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 72px;
    font-weight: 700;
    color: rgba(30, 58, 138, 0.04);
    transform: rotate(-28deg);
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }
  .content { position: relative; z-index: 1; }
  .header {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 10px;
  }
  .logo {
    width: 64px;
    height: 64px;
    object-fit: contain;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #f8fafc;
    flex-shrink: 0;
  }
  .header-main { flex: 1; text-align: center; min-width: 0; }
  .header-main h1 {
    margin: 0;
    font-size: 18px;
    color: #1e3a8a;
    text-transform: uppercase;
  }
  .header-main p { margin: 2px 0; color: #475569; font-size: 10px; }
  .badge {
    background: #1e3a8a;
    color: #fff;
    padding: 8px 10px;
    border-radius: 6px;
    font-size: 9px;
    font-weight: 700;
    text-align: center;
    line-height: 1.3;
    min-width: 110px;
    flex-shrink: 0;
  }
  .exam-bar {
    margin-top: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    padding: 8px 10px;
    border-radius: 6px;
  }
  .exam-bar strong { color: #1e3a8a; font-size: 12px; }
  .verify-block { text-align: right; font-size: 9px; flex-shrink: 0; }
  .verify-block img { width: 72px; height: 72px; display: block; margin-left: auto; }
  .student-grid {
    margin-top: 10px;
    display: grid;
    grid-template-columns: 1fr 120px;
    gap: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 12px;
  }
  .field label {
    display: block;
    font-size: 8px;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.04em;
  }
  .field span { font-weight: 600; font-size: 11px; }
  .photo-box {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px;
    text-align: center;
    background: #f8fafc;
  }
  .photo-box img {
    width: 96px;
    height: 112px;
    object-fit: cover;
    border: 1px solid #94a3b8;
    background: #e2e8f0;
    display: block;
    margin: 0 auto;
  }
  .sig-line {
    margin-top: 8px;
    border-top: 1px solid #64748b;
    padding-top: 4px;
    font-size: 9px;
    font-style: italic;
  }
  table.papers {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin-top: 10px;
    font-size: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table.papers col.sl { width: 8mm; }
  table.papers col.code { width: 22mm; }
  table.papers col.type { width: 16mm; }
  table.papers col.max { width: 12mm; }
  table.papers col.when { width: 28mm; }
  table.papers col.invigilator { width: 36mm; }
  table.papers th.when,
  table.papers td.when { white-space: nowrap; }
  table.papers th, table.papers td {
    border: 1px solid #cbd5e1;
    padding: 3px 4px;
    text-align: left;
    line-height: 1.2;
  }
  table.papers th {
    background: #1e3a8a;
    color: #fff;
    font-size: 9px;
    text-transform: uppercase;
  }
  table.papers tr:nth-child(even) td { background: #f8fafc; }
  table.papers th.invigilator,
  table.papers td.invigilator {
    width: 36mm;
  }
  table.papers td.invigilator {
    height: 6mm;
  }
  .footer {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr 58mm;
    gap: 12px;
    align-items: end;
    border-top: 1px solid #cbd5e1;
    padding-top: 8px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .footer ol { margin: 4px 0 0 16px; padding: 0; }
  .footer li { margin-bottom: 3px; color: #334155; }
  .auth { text-align: center; }
  .auth .sign-blank { height: 22mm; }
  .auth .line {
    border-top: 1px solid #334155;
    padding-top: 3px;
    font-size: 9px;
    font-weight: 600;
  }
  .disclaimer {
    margin-top: 8px;
    text-align: center;
    font-size: 8px;
    color: #64748b;
  }
  .card-no {
    font-family: monospace;
    font-size: 10px;
    color: #1e3a8a;
    font-weight: 700;
  }
  .sheet {
    position: relative;
    width: 210mm;
    height: 296mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .half-slot {
    height: 148mm;
    padding: 2.5mm 5mm 2mm;
    box-sizing: border-box;
    overflow: hidden;
  }
  .sheet .page {
    width: 100%;
    max-width: none;
    height: 100%;
    margin: 0;
    padding: 3mm 3.5mm;
    page-break-before: auto;
    break-before: auto;
    overflow: hidden;
  }
  .sheet .page + .page { page-break-before: auto; break-before: auto; }
  .sheet .watermark { font-size: 40px; }
  .sheet .header { gap: 8px; padding-bottom: 4px; }
  .sheet .logo { width: 40px; height: 40px; }
  .sheet .header-main h1 { font-size: 13px; }
  .sheet .header-main p { font-size: 8px; margin: 0; }
  .sheet .badge { min-width: 78px; padding: 4px 6px; font-size: 7px; }
  .sheet .exam-bar { margin-top: 4px; padding: 4px 6px; }
  .sheet .exam-bar strong { font-size: 10px; }
  .sheet .verify-block img { width: 46px; height: 46px; }
  .sheet .student-grid { margin-top: 4px; gap: 6px; grid-template-columns: 1fr 76px; }
  .sheet .fields { gap: 2px 8px; }
  .sheet .field label { font-size: 7px; }
  .sheet .field span { font-size: 9px; }
  .sheet .photo-box { padding: 3px; }
  .sheet .photo-box img { width: 58px; height: 68px; }
  .sheet .sig-line { margin-top: 3px; font-size: 7px; }
  .sheet table.papers { margin-top: 3px; font-size: 8px; }
  .sheet table.papers th, .sheet table.papers td { padding: 0 2px; line-height: 1.15; }
  .sheet table.papers th { font-size: 7px; }
  .sheet table.papers td.invigilator { height: 4mm; }
  .sheet table.papers col.code { width: 18mm; }
  .sheet table.papers col.when { width: 22mm; }
  .sheet table.papers col.invigilator { width: 22mm; }
  .sheet table.papers th.invigilator,
  .sheet table.papers td.invigilator { width: 22mm; }
  .sheet .footer { margin-top: 2px; padding-top: 2px; gap: 4px; grid-template-columns: 1fr 46mm; }
  .sheet .footer li { margin-bottom: 0; font-size: 7.5px; line-height: 1.2; }
  .sheet .auth .sign-blank { height: 12mm; }
  .sheet .auth .line { font-size: 8px; }
  .sheet .disclaimer { display: none; }
  .cut-line {
    position: absolute;
    top: 148mm;
    left: 8mm;
    right: 8mm;
    border-top: 0.35mm dashed #64748b;
    z-index: 3;
  }
  .cut-line span {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translate(-50%, -50%);
    background: #fff;
    padding: 0 3mm;
    font-size: 8px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #64748b;
  }
`;

export function renderIaAdmitCardPage(card: IaAdmitCardTemplateInput) {
  const inst = card.institution;
  const wm = esc(card.watermark ?? 'INTERNAL ASSESSMENT');
  const paperRows = card.papers
    .map(
      (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(p.paperCode)}</strong></td>
        <td class="title">${esc(p.paperName)}</td>
        <td>${esc(p.paperType ?? '—')}</td>
        <td>${p.maxMarks ?? '—'}</td>
        <td class="when">${fmtDate(p.examDate)}</td>
        <td class="when">${fmtTime(p.startTime)} – ${fmtTime(p.endTime)}</td>
        <td class="invigilator">&nbsp;</td>
      </tr>`,
    )
    .join('');

  const instructions = card.session.instructions
    ? card.session.instructions.split(/\n+/).filter(Boolean)
    : DEFAULT_INSTRUCTIONS;
  const semesterText =
    card.student.semesterLabel ||
    card.session.semesterLabel ||
    (card.student.semesterNo != null ? String(card.student.semesterNo) : '');

  return `
  <div class="page">
    <div class="watermark">${wm}</div>
    <div class="content">
      <header class="header">
        ${inst.logoUrl ? `<img class="logo" src="${esc(inst.logoUrl)}" alt="Logo" />` : '<div class="logo"></div>'}
        <div class="header-main">
          <h1>${esc(inst.displayName ?? inst.name)}</h1>
          ${inst.affiliation ? `<p>${esc(inst.affiliation)}</p>` : ''}
          ${inst.address ? `<p>${esc(inst.address)}</p>` : ''}
          ${inst.contact ? `<p>${esc(inst.contact)}</p>` : ''}
        </div>
        <div class="badge">INTERNAL<br/>ASSESSMENT<br/>ADMIT CARD</div>
      </header>

      <div class="exam-bar">
        <div>
          <strong>${esc(card.session.name)}</strong>
          <div>Academic Session: ${esc(card.session.academicYear ?? '—')}</div>
          ${semesterText ? `<div>Semester ${esc(semesterText)}</div>` : ''}
        </div>
        <div class="verify-block">
          <div class="card-no">${esc(card.admitCardNumber)}</div>
          ${qrImg(card)}
        </div>
      </div>

      <div class="student-grid">
        <div class="fields">
          <div class="field"><label>Roll Number</label><span>${esc(card.student.rollNumber)}</span></div>
          <div class="field"><label>NEHU Roll No.</label><span>${esc(card.student.universityRollNumber || card.student.admissionNumber)}</span></div>
          <div class="field"><label>Name</label><span>${esc(card.student.fullName)}</span></div>
          <div class="field"><label>Reg. No</label><span>${esc(card.student.enrollmentNumber)}</span></div>
          <div class="field"><label>ABC ID</label><span>${esc(card.student.abcId)}</span></div>
          <div class="field"><label>Programme</label><span>${esc(card.student.programme)}</span></div>
          <div class="field"><label>Department</label><span>${esc(card.student.department)}</span></div>
          <div class="field"><label>Semester</label><span>${semesterText ? esc(semesterText) : '—'}</span></div>
          <div class="field"><label>Gender</label><span>${esc(card.student.gender)}</span></div>
          <div class="field"><label>Date of Birth</label><span>${fmtDate(card.student.dateOfBirth)}</span></div>
        </div>
        <div class="photo-box">
          ${card.student.photoUrl ? `<img src="${esc(card.student.photoUrl)}" alt="Photo" />` : '<div style="width:96px;height:112px;background:#e2e8f0;margin:0 auto;"></div>'}
          <div class="sig-line">${esc(card.student.fullName)}<br/>Student Signature</div>
        </div>
      </div>

      <table class="papers">
        <colgroup>
          <col class="sl" />
          <col class="code" />
          <col class="title" />
          <col class="type" />
          <col class="max" />
          <col class="when" />
          <col class="when" />
          <col class="invigilator" />
        </colgroup>
        <thead>
          <tr>
            <th>Sl.</th>
            <th>Paper Code</th>
            <th class="title">Paper Title</th>
            <th>Type</th>
            <th>Max</th>
            <th class="when">Date</th>
            <th class="when">Time</th>
            <th class="invigilator">Signature of Invigilator</th>
          </tr>
        </thead>
        <tbody>
          ${paperRows || '<tr><td colspan="8">No papers scheduled</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <div>
          <strong>Instructions to Students</strong>
          <ol>${instructions.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>
        </div>
        <div class="auth">
          <div class="sign-blank"></div>
          <div class="line">Principal's Signature</div>
        </div>
      </div>
      <p class="disclaimer">Note: This is a computer generated admit card. QR verification available at ${esc(card.verifyUrl ?? 'college portal')}.</p>
    </div>
  </div>`;
}

export function renderIaAdmitCardsDocumentHtml(
  cards: IaAdmitCardTemplateInput[],
  layout: 'single' | 'pair' = 'single',
) {
  const titleRoll = esc(cards[0]?.student.rollNumber ?? 'batch');
  const styles =
    layout === 'pair'
      ? IA_ADMIT_CARD_STYLES.replace(
          '@page { size: A4 portrait; margin: 6mm; }',
          '@page { size: A4 portrait; margin: 0; }',
        )
      : IA_ADMIT_CARD_STYLES;
  const pages =
    layout === 'pair'
      ? pairSheets(cards)
      : cards.map((card) => renderIaAdmitCardPage(card)).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>IA Admit Card — ${titleRoll}</title>
  <style>${styles}</style>
</head>
<body>
${pages}
</body>
</html>`;
}

function pairSheets(cards: IaAdmitCardTemplateInput[]) {
  const sheets: string[] = [];
  for (let index = 0; index < cards.length; index += 2) {
    const top = renderIaAdmitCardPage(cards[index]);
    const bottom = cards[index + 1]
      ? renderIaAdmitCardPage(cards[index + 1])
      : '';
    sheets.push(`<section class="sheet">
      <div class="half-slot">${top}</div>
      <div class="cut-line"><span>Cut here</span></div>
      <div class="half-slot">${bottom}</div>
    </section>`);
  }
  return sheets.join('\n');
}

/** Single-card document — used by PDF renderer and browser print. */
export function renderIaAdmitCardHtml(card: IaAdmitCardTemplateInput) {
  return renderIaAdmitCardsDocumentHtml([card]);
}

/** @deprecated Use renderIaAdmitCardsDocumentHtml */
export function renderIaAdmitCardsBatchHtml(cards: IaAdmitCardTemplateInput[]) {
  return renderIaAdmitCardsDocumentHtml(cards);
}
