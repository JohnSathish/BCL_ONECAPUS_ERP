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
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: auto; }
  body {
    font-family: 'Times New Roman', Georgia, 'Palatino Linotype', serif;
    color: #2d3436; background: #fff;
  }
  .dbc-tc {
    position: relative; width: 100%;
    padding: 4mm 5mm 3mm;
    border: 2px double #1e3a5f;
    outline: 1px solid #c5a572; outline-offset: 2px;
    background: #fff; overflow: hidden;
  }
  .dbc-tc-watermark {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    opacity: 0.08; pointer-events: none; user-select: none; z-index: 0;
  }
  .dbc-tc-watermark .emblem {
    width: 140px; height: 140px; border: 1.5px solid #1e3a5f; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; text-align: center;
    font-size: 9px; font-weight: 700; letter-spacing: 1px; line-height: 1.3;
    padding: 12px; color: #1e3a5f;
  }
  .dbc-tc-inner { position: relative; z-index: 1; }
  .dbc-tc-header {
    display: grid; grid-template-columns: 54px 1fr 54px; gap: 8px; align-items: center;
  }
  .dbc-tc-header .dbc-logo,
  .dbc-tc-header .dbc-logo-placeholder { width: 50px; height: 50px; }
  .dbc-tc-logo-placeholder {
    width: 50px; height: 50px; border: 1px solid #94a3b8; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 7px;
    color: #64748b; text-align: center; padding: 2px; line-height: 1.2;
  }
  .dbc-tc-institution { text-align: center; }
  .dbc-tc-institution h1 {
    margin: 0; font-size: 16px; letter-spacing: 1px; font-weight: 800;
    text-transform: uppercase; color: #1e3a5f; line-height: 1.1;
  }
  .dbc-tc-institution h1 strong { font-weight: 800; }
  .dbc-tc-institution .sub {
    margin: 1px 0 0; font-size: 8.5px; color: #475569; line-height: 1.25;
  }
  .dbc-tc-institution .sub.accent { font-weight: 600; color: #1e3a5f; }
  .dbc-tc-meta-qr { text-align: center; }
  .dbc-tc-meta-qr img { width: 48px !important; height: 48px !important; display: block; margin: 0 auto 1px; }
  .dbc-tc-meta-qr .caption { font-size: 7px; color: #64748b; }
  .dbc-tc-divider {
    border: none; border-top: 1.5px solid #c5a572; margin: 4px 0 3px;
  }
  .dbc-tc-title-row {
    display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
    margin: 0 0 4px;
  }
  .dbc-tc-title {
    margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 2.5px;
    color: #1e3a5f; text-transform: uppercase; line-height: 1.15; white-space: nowrap;
  }
  .dbc-tc-meta-inline {
    display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 2px 14px;
    font-size: 8.5px; line-height: 1.3; color: #2d3436;
  }
  .dbc-tc-meta-inline strong { color: #1e3a5f; }
  .dbc-tc-cols {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 0 0 4px;
  }
  .dbc-tc-panel {
    border: 1px solid #cbd5e1; padding: 3px 6px; background: rgba(30,58,95,0.02);
  }
  .dbc-tc-section-title {
    font-size: 8.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;
    color: #1e3a5f; margin: 0 0 2px; padding-bottom: 1px;
    border-bottom: 1px solid #c5a572;
  }
  .dbc-tc-grid { display: grid; gap: 1px 0; font-size: 9px; line-height: 1.25; }
  .dbc-tc-grid .field { display: flex; gap: 5px; align-items: baseline; }
  .dbc-tc-grid .label { min-width: 96px; font-weight: 600; color: #334155; flex-shrink: 0; }
  .dbc-tc-grid .value {
    flex: 1; border-bottom: 1px dotted #94a3b8; color: #1a1a1a; min-width: 0;
  }
  .dbc-tc-body {
    font-size: 9px; line-height: 1.35; text-align: justify; margin: 0 0 4px; color: #2d3436;
  }
  .dbc-tc-body p { margin: 0 0 3px; }
  .dbc-tc-body p:last-child { margin-bottom: 0; }
  .dbc-tc-summary-wrap { margin: 0 0 3px; }
  .dbc-tc-admin {
    width: 100%; border-collapse: collapse; font-size: 8.5px;
  }
  .dbc-tc-admin th, .dbc-tc-admin td {
    border: 1px solid #cbd5e1; padding: 2px 5px; text-align: left; line-height: 1.25;
  }
  .dbc-tc-admin th {
    width: 18%; font-weight: 700; background: #f1f5f9; color: #1e3a5f;
  }
  .dbc-tc-remarks {
    border: 1px solid #cbd5e1; padding: 2px 6px 3px;
    margin: 0 0 3px; font-size: 8.5px; line-height: 1.25; min-height: 18px;
  }
  .dbc-tc-remarks-label {
    display: inline; font-weight: 700; font-size: 8px;
    text-transform: uppercase; letter-spacing: 0.4px; color: #1e3a5f; margin-right: 6px;
  }
  .dbc-tc-footer {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; align-items: end;
    margin-top: 2px; padding-top: 4px; border-top: 1.5px solid #c5a572;
  }
  .dbc-tc-seal-slot { text-align: center; margin-bottom: 2px; }
  .dbc-tc-seal-slot .dbc-seal-img,
  .dbc-tc-seal-slot .dbc-seal-img[style] { width: 36px !important; height: 36px !important; }
  .dbc-tc-signature { text-align: center; font-size: 9px; color: #2d3436; }
  .dbc-tc-footer .dbc-signature { text-align: center; font-size: 9px; color: #2d3436; }
  .dbc-tc-signature .line,
  .dbc-tc-footer .dbc-signature .line {
    margin-top: 16px; border-top: 1px solid #1e3a5f; padding-top: 2px;
    font-weight: 700; min-width: 110px; display: inline-block; color: #1e3a5f;
  }
  .dbc-tc-signature .designation,
  .dbc-tc-footer .dbc-signature .designation { font-weight: 400; color: #64748b; font-size: 8px; }
  .dbc-tc-signature .dbc-digital,
  .dbc-tc-footer .dbc-signature .dbc-digital { display: none; }
  .dbc-tc-signature .dbc-sig-img,
  .dbc-tc-footer .dbc-signature .dbc-sig-img {
    max-height: 28px; max-width: 100px; margin: 0 auto 2px; display: block;
  }
  .dbc-tc-bottom-bar {
    display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center;
    margin-top: 3px; padding-top: 2px; border-top: 1px dashed #cbd5e1;
    font-size: 7.5px; color: #64748b; line-height: 1.2;
  }
  .dbc-tc-bottom-bar .center { text-align: center; }
  .dbc-tc-bottom-bar .right { text-align: right; }
  .dbc-tc-bottom-bar strong { color: #1e3a5f; }
  @media print {
    html, body { height: auto !important; overflow: hidden !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dbc-tc {
      border-width: 1.5px; padding: 3.5mm 4.5mm 2.5mm;
      page-break-after: avoid;
    }
    .dbc-tc-admin th { background: #eef2f7 !important; }
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
        <p class="sub">Affiliated to North Eastern Hill University (NEHU)</p>
        <p class="sub accent">Recognised by UGC, New Delhi · {{naac_info}}</p>
        <p class="sub">{{college_address}} · {{college_contact_line}}</p>
      </div>
      <div class="dbc-tc-meta-qr">
        {{qr_code}}
        <div class="caption">Scan to verify</div>
      </div>
    </header>
    <hr class="dbc-tc-divider"/>

    <div class="dbc-tc-title-row">
      <h2 class="dbc-tc-title">TRANSFER CERTIFICATE</h2>
      <div class="dbc-tc-meta-inline">
        <span><strong>No.</strong> {{certificate_number}}</span>
        <span><strong>V-ID</strong> {{verification_id}}</span>
        <span><strong>Date</strong> {{date_of_issue}}</span>
      </div>
    </div>

    <div class="dbc-tc-cols">
      <div class="dbc-tc-panel">
        <p class="dbc-tc-section-title">Personal Details</p>
        <div class="dbc-tc-grid">
          <div class="field"><span class="label">Student Name</span><span class="value">{{student_name}}</span></div>
          <div class="field"><span class="label">Father's Name</span><span class="value">{{father_name}}</span></div>
          <div class="field"><span class="label">Mother's Name</span><span class="value">{{mother_name}}</span></div>
          <div class="field"><span class="label">Date of Birth</span><span class="value">{{date_of_birth}}</span></div>
          <div class="field"><span class="label">Gender / Category</span><span class="value">{{gender}} / {{student_category}}</span></div>
          <div class="field"><span class="label">Roll / Admission</span><span class="value">{{roll_number}} / {{admission_number}}</span></div>
          <div class="field"><span class="label">Address</span><span class="value">{{permanent_address}}</span></div>
        </div>
      </div>
      <div class="dbc-tc-panel">
        <p class="dbc-tc-section-title">Academic Details</p>
        <div class="dbc-tc-grid">
          <div class="field"><span class="label">Programme</span><span class="value">{{programme}}</span></div>
          <div class="field"><span class="label">Major / Honours</span><span class="value">{{major_subject}}</span></div>
          <div class="field"><span class="label">Session</span><span class="value">{{academic_session}}</span></div>
          <div class="field"><span class="label">Registration No.</span><span class="value">{{registration_number}}</span></div>
          <div class="field"><span class="label">Admission / Leaving</span><span class="value">{{date_of_admission}} — {{date_of_leaving}}</span></div>
          <div class="field"><span class="label">Last Semester</span><span class="value">{{last_semester_completed}}</span></div>
          <div class="field"><span class="label">Academic Status</span><span class="value">{{academic_status}}</span></div>
        </div>
      </div>
    </div>

    <div class="dbc-tc-body">
      <p>This is to certify that <strong>{{student_title}} {{student_name}}</strong>, Registration No. <strong>{{registration_number}}</strong>, was a bonafide student of Don Bosco College, Tura (NEHU) from <strong>{{date_of_admission}}</strong> to <strong>{{date_of_leaving}}</strong>. The student pursued the <strong>{{degree_phrase}}</strong>, completed studies up to <strong>{{last_semester_completed}}</strong>, and conduct and academic performance were found to be satisfactory.</p>
    </div>

    <div class="dbc-tc-summary-wrap">
      <p class="dbc-tc-section-title">Academic &amp; Conduct Summary</p>
      <table class="dbc-tc-admin">
        <tr><th>Conduct</th><td>{{conduct}}</td><th>Attendance</th><td>{{attendance}}</td></tr>
        <tr><th>Fee Clearance</th><td>{{fee_clearance}}</td><th>Library</th><td>{{library_clearance}}</td></tr>
        <tr><th>Hostel</th><td>{{hostel_clearance}}</td><th>Reason for Leaving</th><td>{{reason_for_leaving}}</td></tr>
      </table>
    </div>

    <div class="dbc-tc-remarks">
      <span class="dbc-tc-remarks-label">Remarks</span>{{remarks}}
    </div>

    <footer class="dbc-tc-footer">
      <div class="dbc-tc-signature">{{prepared_by_block}}</div>
      <div class="dbc-tc-signature">
        <div class="dbc-tc-seal-slot">{{seal_block}}</div>
        {{verified_by_block}}
      </div>
      <div class="dbc-tc-signature">{{principal_signature_block}}</div>
    </footer>

    <div class="dbc-tc-bottom-bar">
      <div>BCL OneCampus ERP · {{issued_timestamp}}</div>
      <div class="center">Verify at <strong>{{verification_portal}}</strong></div>
      <div class="right">ID: <strong>{{verification_id}}</strong></div>
    </div>
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
    name: 'DBC Official — Transfer Certificate (A4 Landscape)',
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
  'gender',
  'student_category',
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
  'library_clearance',
  'hostel_clearance',
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
  'prepared_by_block',
  'verified_by_block',
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
