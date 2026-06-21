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
    academicYear?: string | null;
    instructions?: string | null;
  };
  student: {
    fullName?: string | null;
    rollNumber?: string | null;
    enrollmentNumber?: string | null;
    admissionNumber?: string | null;
    abcId?: string | null;
    programme?: string | null;
    department?: string | null;
    semesterNo?: number | null;
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
  if (/^\d{2}:\d{2}/.test(s)) {
    const [h, m] = s.slice(0, 5).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  return s.slice(11, 16);
}

const DEFAULT_INSTRUCTIONS = [
  'Report to the examination hall 15 minutes before the scheduled time.',
  'Carry this admit card and valid college ID without fail.',
  'Mobile phones and electronic devices are strictly prohibited.',
  'Use only blue/black ink pen unless otherwise instructed.',
  'Malpractice will lead to cancellation of examination.',
];

export function renderIaAdmitCardHtml(card: IaAdmitCardTemplateInput) {
  const inst = card.institution;
  const wm = esc(card.watermark ?? 'INTERNAL ASSESSMENT');
  const paperRows = card.papers
    .map(
      (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(p.paperCode)}</strong></td>
        <td>${esc(p.paperName)}</td>
        <td>${esc(p.paperType ?? '—')}</td>
        <td>${p.maxMarks ?? '—'}</td>
        <td>${fmtDate(p.examDate)}</td>
        <td>${fmtTime(p.startTime)} – ${fmtTime(p.endTime)}</td>
      </tr>`,
    )
    .join('');

  const instructions = card.session.instructions
    ? card.session.instructions.split(/\n+/).filter(Boolean)
    : DEFAULT_INSTRUCTIONS;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>IA Admit Card — ${esc(card.student.rollNumber)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      font-size: 11px;
      line-height: 1.35;
    }
    .page {
      position: relative;
      min-height: 260mm;
      padding: 8mm;
      border: 2px solid #1e3a8a;
      background: #fff;
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
    }
    .header-main { flex: 1; text-align: center; }
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
    .verify-block { text-align: right; font-size: 9px; }
    .verify-block img { width: 72px; height: 72px; }
    .student-grid {
      margin-top: 10px;
      display: grid;
      grid-template-columns: 1fr 120px;
      gap: 10px;
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
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 10px;
    }
    table.papers th, table.papers td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      text-align: left;
    }
    table.papers th {
      background: #1e3a8a;
      color: #fff;
      font-size: 9px;
      text-transform: uppercase;
    }
    table.papers tr:nth-child(even) td { background: #f8fafc; }
    .footer {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 160px;
      gap: 12px;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
    }
    .footer ol { margin: 4px 0 0 16px; padding: 0; }
    .footer li { margin-bottom: 3px; color: #334155; }
    .auth { text-align: center; }
    .auth .line {
      margin-top: 36px;
      border-top: 1px solid #334155;
      padding-top: 4px;
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
  </style>
</head>
<body>
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
          ${card.session.semesterNo ? `<div>Semester ${card.session.semesterNo}</div>` : ''}
        </div>
        <div class="verify-block">
          <div class="card-no">${esc(card.admitCardNumber)}</div>
          ${card.qrDataUrl ? `<img src="${card.qrDataUrl}" alt="QR" />` : `<div>Verify: ${esc(card.verifyCode)}</div>`}
        </div>
      </div>

      <div class="student-grid">
        <div class="fields">
          <div class="field"><label>Roll Number</label><span>${esc(card.student.rollNumber)}</span></div>
          <div class="field"><label>Admission No</label><span>${esc(card.student.admissionNumber)}</span></div>
          <div class="field"><label>Name</label><span>${esc(card.student.fullName)}</span></div>
          <div class="field"><label>Reg. No</label><span>${esc(card.student.enrollmentNumber)}</span></div>
          <div class="field"><label>Father's Name</label><span>${esc(card.student.fatherName)}</span></div>
          <div class="field"><label>ABC ID</label><span>${esc(card.student.abcId)}</span></div>
          <div class="field"><label>Mother's Name</label><span>${esc(card.student.motherName)}</span></div>
          <div class="field"><label>Programme</label><span>${esc(card.student.programme)}</span></div>
          <div class="field"><label>Department</label><span>${esc(card.student.department)}</span></div>
          <div class="field"><label>Semester</label><span>${card.student.semesterNo ?? '—'}</span></div>
          <div class="field"><label>Gender</label><span>${esc(card.student.gender)}</span></div>
          <div class="field"><label>Date of Birth</label><span>${fmtDate(card.student.dateOfBirth)}</span></div>
        </div>
        <div class="photo-box">
          ${card.student.photoUrl ? `<img src="${esc(card.student.photoUrl)}" alt="Photo" />` : '<div style="width:96px;height:112px;background:#e2e8f0;margin:0 auto;"></div>'}
          <div class="sig-line">${esc(card.student.fullName)}<br/>Student Signature</div>
        </div>
      </div>

      <table class="papers">
        <thead>
          <tr>
            <th>Sl.</th>
            <th>Paper Code</th>
            <th>Paper Title</th>
            <th>Type</th>
            <th>Max</th>
            <th>Date</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${paperRows || '<tr><td colspan="7">No papers scheduled</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        <div>
          <strong>Instructions to Students</strong>
          <ol>${instructions.map((i) => `<li>${esc(i)}</li>`).join('')}</ol>
        </div>
        <div class="auth">
          <div class="line">Controller of Examinations</div>
        </div>
      </div>
      <p class="disclaimer">Note: This is a computer generated admit card. QR verification available at ${esc(card.verifyUrl ?? 'college portal')}.</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderIaAdmitCardsBatchHtml(cards: IaAdmitCardTemplateInput[]) {
  return cards
    .map((c) =>
      renderIaAdmitCardHtml(c)
        .replace('<!DOCTYPE html>', '')
        .replace(/<\/?html[^>]*>/g, '')
        .replace(/<\/?head>[\s\S]*?<\/head>/, '')
        .replace(/<\/?body[^>]*>/g, ''),
    )
    .join('<div style="page-break-after:always"></div>');
}
