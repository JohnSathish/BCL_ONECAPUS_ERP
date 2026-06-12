/**
 * Don Bosco College, Tura — unified official certificate HTML layouts.
 * Variables use {{snake_case}} placeholders resolved at issue time.
 */

const BASE_STYLES = `
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; background: #fff; }
  .dbc-cert {
    position: relative; width: 100%; min-height: 277mm; padding: 14mm 16mm;
    border: 3px double #1e3a5f; outline: 1px solid #c8102e; outline-offset: 4px;
    background: #fff; overflow: hidden;
  }
  .dbc-watermark {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 72px; font-weight: 700; color: rgba(30,58,95,0.04); letter-spacing: 8px;
    transform: rotate(-28deg); pointer-events: none; user-select: none; z-index: 0;
  }
  .dbc-inner { position: relative; z-index: 1; }
  .dbc-header { display: grid; grid-template-columns: 88px 1fr; gap: 14px; align-items: start; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 12px; }
  .dbc-logo { width: 80px; height: 80px; object-fit: contain; }
  .dbc-logo-placeholder { width: 80px; height: 80px; border: 1px solid #cbd5e1; border-radius: 50%; display:flex; align-items:center; justify-content:center; font-size:10px; color:#64748b; text-align:center; padding:4px; }
  .dbc-institution { text-align: center; }
  .dbc-institution h1 {
    margin: 0; font-size: 23px; font-weight: 800; letter-spacing: 1.2px;
    color: #1e3a5f; text-transform: uppercase;
    font-family: 'Times New Roman', Georgia, 'Palatino Linotype', serif;
  }
  .dbc-institution h1 strong { font-weight: 800; }
  .dbc-institution .naac { margin: 4px 0 0; font-size: 11px; font-weight: 600; color: #c8102e; }
  .dbc-institution .meta-line { margin: 2px 0; font-size: 10px; color: #475569; line-height: 1.4; }
  .dbc-top-row { display: flex; justify-content: space-between; gap: 12px; margin: 10px 0 16px; font-size: 11px; }
  .dbc-meta-block { text-align: right; line-height: 1.55; }
  .dbc-meta-block strong { color: #1e3a5f; }
  .dbc-title { text-align: center; margin: 18px 0 20px; font-size: 20px; font-weight: 700; letter-spacing: 3px; text-decoration: underline; text-underline-offset: 6px; color: #1e3a5f; }
  .dbc-student-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 0 0 18px; padding: 12px 14px; background: rgba(30,58,95,0.04); border: 1px solid rgba(30,58,95,0.12); border-radius: 4px; font-size: 12px; }
  .dbc-student-grid .field { display: flex; gap: 6px; }
  .dbc-student-grid .label { min-width: 130px; font-weight: 600; color: #334155; }
  .dbc-student-grid .value { flex: 1; border-bottom: 1px dotted #94a3b8; padding-bottom: 1px; }
  .dbc-student-grid .full { grid-column: 1 / -1; }
  .dbc-body { font-size: 13px; line-height: 1.75; text-align: justify; margin: 0 0 20px; }
  .dbc-body p { margin: 0 0 12px; }
  .dbc-remarks { min-height: 48px; border: 1px dashed #94a3b8; padding: 10px 12px; margin: 16px 0; font-size: 12px; }
  .dbc-remarks-label { font-weight: 700; font-size: 11px; color: #1e3a5f; margin-bottom: 6px; }
  .dbc-footer { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; align-items: end; margin-top: 28px; padding-top: 12px; border-top: 1px solid #cbd5e1; }
  .dbc-seal { text-align: center; font-size: 10px; color: #64748b; }
  .dbc-seal-img { width: 72px; height: 72px; object-fit: contain; margin: 0 auto 4px; display: block; opacity: 0.85; }
  .dbc-verify { text-align: center; font-size: 9px; color: #475569; }
  .dbc-verify img { width: 72px; height: 72px; display: block; margin: 0 auto 4px; }
  .dbc-signature { text-align: right; font-size: 11px; }
  .dbc-signature .line { margin-top: 48px; border-top: 1px solid #1e3a5f; padding-top: 4px; font-weight: 700; }
  .dbc-signature .designation { font-weight: 400; color: #64748b; font-size: 10px; }
  .dbc-sig-img { max-height: 52px; max-width: 160px; object-fit: contain; display: block; margin: 0 auto 6px; }
  .dbc-digital { font-size: 9px; color: #059669; margin-top: 4px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dbc-cert { border-width: 2px; min-height: auto; }
  }
`;

function shell(
  title: string,
  studentGrid: string,
  body: string,
  showRemarks = false,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><style>${BASE_STYLES}</style></head>
<body>
<div class="dbc-cert">
  <div class="dbc-watermark">DON BOSCO COLLEGE</div>
  <div class="dbc-inner">
    <header class="dbc-header">
      <div>{{logo_block}}</div>
      <div class="dbc-institution">
        <h1><strong>{{college_name_upper}}</strong></h1>
        <p class="naac">{{naac_info}}</p>
        <p class="meta-line">{{college_address}} · PIN 794002 · Meghalaya, India</p>
        <p class="meta-line">Tel: {{college_phone}} · Email: {{college_email}} · {{college_website}}</p>
      </div>
    </header>
    <div class="dbc-top-row">
      <div>
        <div><strong>Memo No:</strong> {{memo_no}}</div>
        <div><strong>Session:</strong> {{academic_session}}</div>
      </div>
      <div class="dbc-meta-block">
        <div><strong>Certificate No:</strong> {{certificate_number}}</div>
        <div><strong>Issue Date:</strong> {{date_of_issue}}</div>
        <div><strong>Verification ID:</strong> {{verification_id}}</div>
        <div><strong>Document ID:</strong> {{document_id}}</div>
      </div>
    </div>
    <h2 class="dbc-title">${title}</h2>
    ${studentGrid}
    ${body}
    ${showRemarks ? `<div class="dbc-remarks"><div class="dbc-remarks-label">Remarks</div>{{remarks}}</div>` : ''}
    <footer class="dbc-footer">
      <div class="dbc-seal">
        {{seal_block}}
        <div>Official Seal</div>
      </div>
      <div class="dbc-verify">
        {{qr_code}}
        <div>{{verification_url}}</div>
      </div>
      <div class="dbc-signature">
        {{principal_signature_block}}
      </div>
    </footer>
  </div>
</div>
</body>
</html>`;
}

const STUDENT_GRID_CHARACTER = `
<div class="dbc-student-grid">
  <div class="field full"><span class="label">Student Name</span><span class="value">{{student_name}}</span></div>
  <div class="field"><span class="label">Roll Number</span><span class="value">{{roll_number}}</span></div>
  <div class="field"><span class="label">Registration No.</span><span class="value">{{registration_number}}</span></div>
  <div class="field"><span class="label">Programme</span><span class="value">{{programme}}</span></div>
  <div class="field"><span class="label">Major / Honours</span><span class="value">{{major_subject}}</span></div>
  <div class="field"><span class="label">Academic Session</span><span class="value">{{academic_session}}</span></div>
  <div class="field"><span class="label">Examination Year</span><span class="value">{{examination_year}}</span></div>
</div>`;

const STUDENT_GRID_PROVISIONAL = `
<div class="dbc-student-grid">
  <div class="field full"><span class="label">Student Name</span><span class="value">{{student_name}}</span></div>
  <div class="field"><span class="label">Roll Number</span><span class="value">{{roll_number}}</span></div>
  <div class="field"><span class="label">Registration No.</span><span class="value">{{registration_number}}</span></div>
  <div class="field"><span class="label">Degree</span><span class="value">{{programme}}</span></div>
  <div class="field"><span class="label">Major / Honours</span><span class="value">{{major_subject}}</span></div>
  <div class="field"><span class="label">Examination</span><span class="value">{{examination_month_year}}</span></div>
  <div class="field"><span class="label">Result</span><span class="value">{{division}} · {{marks}}%</span></div>
  <div class="field"><span class="label">CGPA</span><span class="value">{{cgpa}}</span></div>
</div>`;

const TC_STYLES = `
  @page { size: A4 portrait; margin: 7mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: auto; }
  body { font-family: 'Times New Roman', Georgia, 'Palatino Linotype', serif; color: #111; background: #fff; }
  .dbc-tc {
    position: relative; width: 100%; padding: 7mm 9mm 6mm;
    border: 2px solid #111; background: #fff; overflow: hidden;
  }
  .dbc-tc-watermark {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    opacity: 0.03; pointer-events: none; user-select: none; z-index: 0;
  }
  .dbc-tc-watermark .emblem {
    width: 220px; height: 220px; border: 2px solid #111; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; text-align: center;
    font-size: 10px; font-weight: 700; letter-spacing: 1px; line-height: 1.35; padding: 16px;
  }
  .dbc-tc-inner { position: relative; z-index: 1; }
  .dbc-tc-header {
    display: grid; grid-template-columns: 68px 1fr; gap: 10px; align-items: center;
    padding-bottom: 6px; margin-bottom: 0;
  }
  .dbc-tc-header .dbc-logo,
  .dbc-tc-header .dbc-logo-placeholder { width: 64px; height: 64px; }
  .dbc-tc-seal .dbc-seal-img,
  .dbc-tc-seal .dbc-seal-img[style] { width: 54px !important; height: 54px !important; }
  .dbc-tc-logo-placeholder {
    width: 64px; height: 64px; border: 1px solid #666; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 8px;
    color: #444; text-align: center; padding: 4px; line-height: 1.25;
  }
  .dbc-tc-institution { text-align: center; }
  .dbc-tc-institution h1 {
    margin: 0; font-size: 18px; letter-spacing: 1px; font-weight: 800;
    text-transform: uppercase; color: #111; line-height: 1.15;
    font-family: 'Times New Roman', Georgia, 'Palatino Linotype', serif;
  }
  .dbc-tc-institution h1 strong { font-weight: 800; }
  .dbc-tc-institution .affiliation { margin: 1px 0 0; font-size: 9.5px; font-style: italic; color: #333; line-height: 1.25; }
  .dbc-tc-institution .location { margin: 1px 0 0; font-size: 9.5px; color: #333; line-height: 1.25; }
  .dbc-tc-institution .naac { margin: 1px 0 0; font-size: 9px; font-weight: 600; color: #222; line-height: 1.25; }
  .dbc-tc-institution .contact { margin: 1px 0 0; font-size: 8.5px; color: #444; line-height: 1.25; }
  .dbc-tc-divider { border: none; border-top: 1px solid #111; margin: 6px 0 8px; }
  .dbc-tc-divider-ornament {
    text-align: center; margin: -6px 0 6px; font-size: 9px; color: #666; letter-spacing: 5px;
  }
  .dbc-tc-title {
    text-align: center; margin: 0 0 4px; font-size: 16px; font-weight: 700;
    letter-spacing: 3px; color: #111; text-transform: uppercase; line-height: 1.2;
  }
  .dbc-tc-meta {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
    margin: 0 0 8px; font-size: 10px; line-height: 1.35;
  }
  .dbc-tc-meta strong { font-weight: 700; }
  .dbc-tc-meta-right { text-align: right; }
  .dbc-tc-section-title {
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
    color: #111; margin: 0 0 3px; padding-bottom: 2px; border-bottom: 1px solid #ccc;
  }
  .dbc-tc-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 3px 14px;
    margin: 0 0 8px; padding: 6px 8px; border: 1px solid #bbb; font-size: 10px; line-height: 1.3;
  }
  .dbc-tc-grid .field { display: flex; gap: 6px; min-height: 14px; align-items: baseline; }
  .dbc-tc-grid .label { min-width: 108px; font-weight: 600; color: #222; flex-shrink: 0; }
  .dbc-tc-grid .value { flex: 1; border-bottom: 1px dotted #888; padding-bottom: 0; color: #111; }
  .dbc-tc-grid .full { grid-column: 1 / -1; }
  .dbc-tc-body { font-size: 10.5px; line-height: 1.45; text-align: justify; margin: 0 0 8px; }
  .dbc-tc-body p { margin: 0 0 4px; }
  .dbc-tc-body p:last-child { margin-bottom: 0; }
  .dbc-tc-admin { width: 100%; border-collapse: collapse; margin: 0 0 8px; font-size: 10px; }
  .dbc-tc-admin th, .dbc-tc-admin td { border: 1px solid #888; padding: 4px 7px; text-align: left; line-height: 1.3; }
  .dbc-tc-admin th { width: 26%; font-weight: 700; background: #f5f5f5; color: #111; }
  .dbc-tc-remarks {
    min-height: 26px; border: 1px solid #888; padding: 4px 7px; margin: 0 0 8px; font-size: 10px; line-height: 1.35;
  }
  .dbc-tc-remarks-label { font-weight: 700; font-size: 9.5px; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.4px; }
  .dbc-tc-verify-bar {
    text-align: center; font-size: 8.5px; color: #333; margin: 0 0 6px;
    padding: 3px 6px; border: 1px dashed #999; background: #fafafa; line-height: 1.3;
  }
  .dbc-tc-footer {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; align-items: end;
    margin-top: 4px; padding-top: 6px; border-top: 1px solid #888;
  }
  .dbc-tc-seal { text-align: center; font-size: 8.5px; color: #444; line-height: 1.2; }
  .dbc-tc-seal-img { width: 54px; height: 54px; object-fit: contain; margin: 0 auto 2px; display: block; }
  .dbc-tc-verify { text-align: center; font-size: 8px; color: #444; line-height: 1.2; }
  .dbc-tc-verify img { width: 52px !important; height: 52px !important; display: block; margin: 0 auto 2px; }
  .dbc-tc-signature { text-align: center; font-size: 10px; }
  .dbc-tc-signature .line { margin-top: 28px; border-top: 1px solid #111; padding-top: 3px; font-weight: 700; min-width: 120px; display: inline-block; }
  .dbc-tc-signature .designation { font-weight: 400; color: #444; font-size: 9px; }
  .dbc-tc-signature .dbc-digital { font-size: 8px; color: #333; margin-top: 2px; }
  .dbc-tc-signature .dbc-sig-img { max-height: 44px; max-width: 140px; margin: 0 auto 4px; display: block; }
  .dbc-tc-signature-right { text-align: right; }
  .dbc-tc-signature-right .line { display: block; margin-left: auto; margin-right: 0; }
  .dbc-tc-timestamp { text-align: center; font-size: 8px; color: #666; margin-top: 4px; line-height: 1.25; }
  @media print {
    html, body { height: auto !important; overflow: visible !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dbc-tc {
      border-width: 1.5px; padding: 6mm 8mm 5mm;
      page-break-inside: avoid; page-break-after: avoid; break-inside: avoid;
    }
    .dbc-tc-footer, .dbc-tc-verify-bar, .dbc-tc-remarks { page-break-inside: avoid; break-inside: avoid; }
    .dbc-tc-admin th { background: #eee !important; }
  }
`;

const TRANSFER_CERTIFICATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Transfer Certificate — {{student_name}}</title><style>${TC_STYLES}</style></head>
<body>
<div class="dbc-tc">
  <div class="dbc-tc-watermark"><div class="emblem">DON BOSCO<br/>COLLEGE<br/>TURA</div></div>
  <div class="dbc-tc-inner">
    <header class="dbc-tc-header">
      <div>{{logo_block}}</div>
      <div class="dbc-tc-institution">
        <h1><strong>{{college_name_upper}}</strong></h1>
        <p class="affiliation">{{university_affiliation}}</p>
        <p class="location">{{college_address}}</p>
        <p class="naac">{{naac_info}}</p>
        <p class="contact">{{college_contact_line}}</p>
      </div>
    </header>
    <hr class="dbc-tc-divider"/>
    <h2 class="dbc-tc-title">Transfer Certificate</h2>
    <div class="dbc-tc-divider-ornament">— ◆ —</div>
    <div class="dbc-tc-meta">
      <div>
        <div><strong>Certificate No:</strong> {{certificate_number}}</div>
        <div><strong>Verification ID:</strong> {{verification_id}}</div>
      </div>
      <div class="dbc-tc-meta-right">
        <div><strong>Issue Date:</strong> {{date_of_issue}}</div>
      </div>
    </div>
    <p class="dbc-tc-section-title">Student Particulars</p>
    <div class="dbc-tc-grid">
      <div class="field full"><span class="label">Student Name</span><span class="value">{{student_name}}</span></div>
      <div class="field"><span class="label">Father's Name</span><span class="value">{{father_name}}</span></div>
      <div class="field"><span class="label">Mother's Name</span><span class="value">{{mother_name}}</span></div>
      <div class="field full"><span class="label">Permanent Address</span><span class="value">{{permanent_address}}</span></div>
      <div class="field"><span class="label">Date of Birth</span><span class="value">{{date_of_birth}}</span></div>
      <div class="field"><span class="label">Admission Number</span><span class="value">{{admission_number}}</span></div>
      <div class="field"><span class="label">Roll Number</span><span class="value">{{roll_number}}</span></div>
      <div class="field"><span class="label">Registration Number</span><span class="value">{{registration_number}}</span></div>
      <div class="field"><span class="label">Programme</span><span class="value">{{programme}}</span></div>
      <div class="field"><span class="label">Major / Honours</span><span class="value">{{major_subject}}</span></div>
      <div class="field"><span class="label">Session</span><span class="value">{{academic_session}}</span></div>
      <div class="field"><span class="label">Academic Status</span><span class="value">{{academic_status}}</span></div>
      <div class="field"><span class="label">Date of Admission</span><span class="value">{{date_of_admission}}</span></div>
      <div class="field"><span class="label">Date of Leaving</span><span class="value">{{date_of_leaving}}</span></div>
      <div class="field full"><span class="label">Last Semester Completed</span><span class="value">{{last_semester_completed}}</span></div>
    </div>
    <div class="dbc-tc-body">
      <p>This is to certify that <strong>{{student_title}} {{student_name}}</strong>, {{son_daughter}} of <strong>{{parent_name}}</strong>, was a bonafide student of {{college_name_upper}} from <strong>{{date_of_admission}}</strong> to <strong>{{date_of_leaving}}</strong>. The student pursued the programme <strong>{{degree_phrase}}</strong>, completed studies up to <strong>{{last_semester_completed}}</strong>, and during the period of study the student's conduct and academic engagement were found to be satisfactory.</p>
    </div>
    <table class="dbc-tc-admin">
      <tr><th>Conduct</th><td>{{conduct}}</td></tr>
      <tr><th>Attendance &amp; Industry</th><td>{{attendance}} — {{industry}}</td></tr>
      <tr><th>Fee Clearance</th><td>{{fee_clearance}}</td></tr>
      <tr><th>Reason for Leaving</th><td>{{reason_for_leaving}}</td></tr>
    </table>
    <div class="dbc-tc-remarks">
      <div class="dbc-tc-remarks-label">Remarks</div>
      {{remarks}}
    </div>
    <footer class="dbc-tc-footer">
      <div class="dbc-tc-seal">
        {{seal_block}}
        <div>Official Seal</div>
      </div>
      <div class="dbc-tc-verify">
        {{qr_code}}
        <div>{{verification_portal}}</div>
      </div>
      <div class="dbc-tc-signature dbc-tc-signature-right">
        {{principal_signature_block}}
      </div>
    </footer>
    <p class="dbc-tc-timestamp">System-generated on {{issued_timestamp}} · Certificate ID: {{verification_id}}</p>
  </div>
</div>
</body>
</html>`;

const BODY_CHARACTER = `
<div class="dbc-body">
  <p>This is to certify that <strong>{{student_name}}</strong>, bearing Roll Number <strong>{{roll_number}}</strong> and Registration Number <strong>{{registration_number}}</strong>, was a bonafide student of {{college_name}} during the academic session <strong>{{academic_session}}</strong>.</p>
  <p>The student successfully completed the <strong>{{degree_phrase}}</strong> under {{university_name}} in the year <strong>{{examination_year}}</strong>, and appeared for the final examination with Roll Number included in the list of successful candidates in <strong>{{division}}</strong>.</p>
  <p>During the period of study, the student's conduct, character, and discipline were found to be <strong>{{conduct}}</strong>. I wish the student every success in life.</p>
  <p>This certificate is issued upon request for official purposes.</p>
</div>`;

const BODY_PROVISIONAL = `
<div class="dbc-body">
  <p>This is to certify that <strong>{{student_name}}</strong>, bearing Roll Number <strong>{{roll_number}}</strong> and Registration Number <strong>{{registration_number}}</strong>, has successfully completed the requirements for the Degree of <strong>{{degree_phrase}}</strong> under {{university_name}}.</p>
  <p>The candidate appeared in the examination held in <strong>{{examination_month_year}}</strong> and passed with <strong>{{division}}</strong> ({{marks}}%). To the best of my knowledge and belief, the student bears a good moral character.</p>
  <p>This provisional certificate is issued pending the award of the original degree certificate by the university.</p>
</div>`;

export const DBC_OFFICIAL_TEMPLATES = {
  CHARACTER: {
    code: 'DBC_CHARACTER_V1',
    name: 'DBC Official — Character Certificate',
    html: shell(
      'CHARACTER CERTIFICATE',
      STUDENT_GRID_CHARACTER,
      BODY_CHARACTER,
    ),
  },
  PROVISIONAL: {
    code: 'DBC_PROVISIONAL_V1',
    name: 'DBC Official — Provisional Certificate',
    html: shell(
      'PROVISIONAL CERTIFICATE',
      STUDENT_GRID_PROVISIONAL,
      BODY_PROVISIONAL,
    ),
  },
  TRANSFER: {
    code: 'DBC_TRANSFER_V1',
    name: 'DBC Official — Transfer Certificate (Modern)',
    html: TRANSFER_CERTIFICATE_HTML,
  },
} as const;

export type DbcOfficialTemplateCode = keyof typeof DBC_OFFICIAL_TEMPLATES;

export function getDbcOfficialTemplate(
  categoryCode: string,
): (typeof DBC_OFFICIAL_TEMPLATES)[DbcOfficialTemplateCode] | null {
  const key = categoryCode.toUpperCase() as DbcOfficialTemplateCode;
  return DBC_OFFICIAL_TEMPLATES[key] ?? null;
}

export const DBC_OFFICIAL_VARIABLE_KEYS = [
  'student_name',
  'student_title',
  'son_daughter',
  'parent_name',
  'permanent_address',
  'registration_number',
  'admission_number',
  'roll_number',
  'enrollment_number',
  'programme',
  'degree_phrase',
  'department',
  'major_subject',
  'minor_subject',
  'semester',
  'batch',
  'shift',
  'stream',
  'academic_year',
  'academic_session',
  'academic_status',
  'last_semester_completed',
  'date_of_issue',
  'date_of_admission',
  'date_of_leaving',
  'date_of_birth',
  'examination_year',
  'examination_month_year',
  'completion_date',
  'cgpa',
  'grade',
  'marks',
  'division',
  'conduct',
  'attendance',
  'industry',
  'fee_status',
  'fee_clearance',
  'father_name',
  'mother_name',
  'last_class_attended',
  'reason_for_leaving',
  'remarks',
  'certificate_number',
  'memo_no',
  'verification_id',
  'document_id',
  'verification_url',
  'verification_portal',
  'issued_timestamp',
  'principal_name',
  'registrar_name',
  'registrar_block',
  'principal_signature_block',
  'college_name',
  'college_name_upper',
  'university_name',
  'university_affiliation',
  'naac_info',
  'college_address',
  'college_pin',
  'college_phone',
  'college_email',
  'college_website',
  'college_contact_line',
  'logo_block',
  'seal_block',
  'qr_code',
  'student_photo',
  'subjects',
];
