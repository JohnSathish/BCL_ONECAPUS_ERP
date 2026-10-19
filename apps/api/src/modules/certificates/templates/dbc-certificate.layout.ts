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
  @page { size: A4 landscape; margin: 7mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: auto; }
  body {
    font-family: 'Times New Roman', Georgia, 'Palatino Linotype', serif;
    color: #2d3436; background: #fff;
  }
  .dbc-tc {
    position: relative; width: 100%;
    padding: 6mm 7mm 5mm;
    border: 2.5px solid #0e2f6b;
    outline: 1.5px solid #c4a35a;
    outline-offset: 2.5px;
    box-shadow: inset 0 0 0 1px #c4a35a;
    background:
      radial-gradient(circle at 50% 46%, rgba(14,47,107,0.045), transparent 28%),
      #fff;
    overflow: hidden;
  }
  .dbc-tc-corner {
    position: absolute; width: 14px; height: 14px; border: 1.5px solid #c4a35a; z-index: 2;
  }
  .dbc-tc-corner.tl { top: 2.5mm; left: 2.5mm; border-right: 0; border-bottom: 0; }
  .dbc-tc-corner.tr { top: 2.5mm; right: 2.5mm; border-left: 0; border-bottom: 0; }
  .dbc-tc-corner.bl { bottom: 2.5mm; left: 2.5mm; border-right: 0; border-top: 0; }
  .dbc-tc-corner.br { bottom: 2.5mm; right: 2.5mm; border-left: 0; border-top: 0; }
  .dbc-tc-watermark {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    opacity: 0.07; pointer-events: none; user-select: none; z-index: 0;
  }
  .dbc-tc-watermark .emblem,
  .dbc-tc-watermark .dbc-seal-img {
    width: 168px !important; height: 168px !important; border-radius: 50%;
    object-fit: contain; opacity: 1;
  }
  .dbc-tc-watermark .emblem {
    border: 1.5px solid #0e2f6b; display: flex; align-items: center; justify-content: center;
    text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 1.5px;
    line-height: 1.35; padding: 16px; color: #0e2f6b;
  }
  .dbc-tc-inner {
    position: relative; z-index: 1; min-height: 178mm;
    display: flex; flex-direction: column;
  }
  .dbc-tc-header {
    display: grid; grid-template-columns: 78px 1fr 118px; gap: 10px; align-items: center;
  }
  .dbc-tc-header .dbc-logo,
  .dbc-tc-header .dbc-logo-placeholder { width: 74px; height: 74px; object-fit: contain; }
  .dbc-tc-logo-placeholder,
  .dbc-tc-header .dbc-logo-placeholder {
    width: 74px; height: 74px; border: 1px solid #c4a35a; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 8px;
    color: #0e2f6b; text-align: center; padding: 4px; line-height: 1.2;
  }
  .dbc-tc-institution { text-align: center; color: #0e2f6b; }
  .dbc-tc-institution .order {
    margin: 0; font-size: 10px; letter-spacing: 2.4px; text-transform: uppercase;
    font-weight: 600; color: #1a3f86;
  }
  .dbc-tc-institution h1 {
    margin: 1px 0 0; font-size: 22px; letter-spacing: 0.6px; font-weight: 800;
    text-transform: uppercase; color: #0e2f6b; line-height: 1.05;
  }
  .dbc-tc-institution .sub { margin: 1px 0 0; font-size: 10px; color: #24324a; line-height: 1.3; }
  .dbc-tc-institution .contact {
    margin: 3px 0 0; font-size: 9.5px; color: #1e3a5f; letter-spacing: 0.1px;
  }
  .dbc-tc-institution .contact .sep { color: #c4a35a; margin: 0 6px; }
  .dbc-tc-id { text-align: right; font-size: 10px; line-height: 1.35; color: #1a1a1a; margin-bottom: 3px; }
  .dbc-tc-id span { color: #334155; }
  .dbc-tc-id strong { color: #111; font-weight: 700; }
  .dbc-tc-meta-qr { text-align: center; }
  .dbc-tc-meta-qr img { width: 58px !important; height: 58px !important; display: block; margin: 0 auto 1px; }
  .dbc-tc-meta-qr .caption { font-size: 8px; color: #334155; }
  .dbc-tc-flourish {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    margin: 4px 0 2px; color: #c4a35a;
  }
  .dbc-tc-flourish span { height: 1px; width: 92px; background: linear-gradient(90deg, transparent, #c4a35a, transparent); }
  .dbc-tc-flourish i { font-style: normal; font-size: 9px; }
  .dbc-tc-title {
    margin: 0; text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 3px;
    color: #0e2f6b; text-transform: uppercase; line-height: 1.1;
  }
  .dbc-tc-cols {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 6px 0 5px;
  }
  .dbc-tc-panel { border: 1px solid #b7cbe2; background: #fff; }
  .dbc-tc-section-title {
    margin: 0; padding: 3px 8px; background: #d7e6f6; color: #0e2f6b;
    font-size: 10px; font-weight: 800; letter-spacing: 0.7px; text-transform: uppercase;
  }
  .dbc-tc-grid { display: grid; gap: 2px 0; padding: 4px 8px 5px; font-size: 10.5px; line-height: 1.3; }
  .dbc-tc-grid .field { display: grid; grid-template-columns: 132px 10px 1fr; gap: 4px; align-items: baseline; }
  .dbc-tc-grid .label { color: #1f2937; }
  .dbc-tc-grid .colon { color: #1f2937; }
  .dbc-tc-grid .value { color: #111; font-weight: 700; min-width: 0; }
  .dbc-tc-grid .value.name, .dbc-tc-grid .value.status { letter-spacing: 0.3px; text-transform: uppercase; }
  .dbc-tc-body {
    font-size: 11px; line-height: 1.45; text-align: justify; margin: 2px 0 6px; color: #1f2937;
  }
  .dbc-tc-body p { margin: 0; }
  .dbc-tc-summary-wrap { margin: 0 0 5px; }
  .dbc-tc-admin { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  .dbc-tc-admin th, .dbc-tc-admin td {
    border: 1px solid #9bb3d1; padding: 3px 7px; text-align: left; line-height: 1.3;
  }
  .dbc-tc-admin th { width: 18%; font-weight: 700; background: #fff; color: #0e2f6b; }
  .dbc-tc-admin td { font-weight: 600; color: #111; }
  .dbc-tc-remarks {
    border: 1px solid #9bb3d1; min-height: 22px; margin: 0 0 6px;
    padding: 4px 8px; font-size: 11px; font-weight: 600;
  }
  .dbc-tc-footer {
    display: grid; grid-template-columns: 1.1fr 0.8fr 1.1fr 1.1fr; gap: 8px; align-items: end;
    margin-top: auto; padding-top: 8px;
  }
  .dbc-tc-seal { text-align: center; }
  .dbc-tc-seal .dbc-seal-img,
  .dbc-tc-seal .dbc-seal-img[style] { width: 58px !important; height: 58px !important; margin: 0 auto 2px; display: block; }
  .dbc-tc-seal .caption {
    font-size: 8px; letter-spacing: 0.8px; font-weight: 700; color: #0e2f6b;
  }
  .dbc-tc-signature, .dbc-tc-footer .dbc-tc-signature, .dbc-tc-footer .dbc-signature {
    text-align: center; font-size: 11px; color: #111;
  }
  .dbc-tc-signature .line, .dbc-tc-footer .dbc-signature .line, .dbc-tc-footer .dbc-tc-signature .line {
    margin-top: 22px; border-top: 1px solid #111; padding-top: 3px;
    font-weight: 700; min-width: 120px; display: inline-block; color: #111;
  }
  .dbc-tc-signature .designation, .dbc-tc-footer .dbc-signature .designation,
  .dbc-tc-footer .dbc-tc-signature .designation {
    font-weight: 500; color: #1f2937; font-size: 10px;
  }
  .dbc-tc-signature .dbc-digital, .dbc-tc-footer .dbc-signature .dbc-digital { display: none; }
  .dbc-tc-signature .dbc-sig-img, .dbc-tc-footer .dbc-signature .dbc-sig-img {
    max-height: 32px; max-width: 110px; margin: 0 auto 2px; display: block;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dbc-tc { page-break-after: avoid; }
    .dbc-tc-section-title { background: #d7e6f6 !important; }
  }
`;

const TRANSFER_CERTIFICATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>Transfer Certificate — {{student_name}}</title><style>${TC_STYLES}</style></head>
<body>
<div class="dbc-tc">
  <span class="dbc-tc-corner tl"></span>
  <span class="dbc-tc-corner tr"></span>
  <span class="dbc-tc-corner bl"></span>
  <span class="dbc-tc-corner br"></span>
  <div class="dbc-tc-watermark"><div class="emblem">DON BOSCO<br/>COLLEGE<br/>TURA</div></div>
  <div class="dbc-tc-inner">
    <header class="dbc-tc-header">
      <div>{{logo_block}}</div>
      <div class="dbc-tc-institution">
        <p class="order">Salesians of Don Bosco</p>
        <h1>{{college_name_upper}}</h1>
        <p class="sub">Affiliated to North Eastern Hill University (NEHU)</p>
        <p class="sub">{{college_address}}</p>
        <p class="contact"><span>{{college_website}}</span><span class="sep">|</span><span>{{college_email}}</span><span class="sep">|</span><span>{{college_phone}}</span></p>
      </div>
      <div>
        <div class="dbc-tc-id">
          <div><span>No.</span> <strong>{{certificate_number}}</strong></div>
          <div><span>Date:</span> <strong>{{date_of_issue}}</strong></div>
        </div>
        <div class="dbc-tc-meta-qr">
          {{qr_code}}
          <div class="caption">Scan to Verify</div>
        </div>
      </div>
    </header>
    <div class="dbc-tc-flourish"><span></span><i>&#10022;</i><span></span></div>
    <h2 class="dbc-tc-title">Transfer Certificate</h2>
    <div class="dbc-tc-flourish"><span></span><i>&#10022;</i><span></span></div>

    <div class="dbc-tc-cols">
      <div class="dbc-tc-panel">
        <p class="dbc-tc-section-title">Personal Details</p>
        <div class="dbc-tc-grid">
          <div class="field"><span class="label">Name of the Student</span><span class="colon">:</span><span class="value name">{{student_name}}</span></div>
          <div class="field"><span class="label">Father's Name</span><span class="colon">:</span><span class="value">{{father_name}}</span></div>
          <div class="field"><span class="label">Mother's Name</span><span class="colon">:</span><span class="value">{{mother_name}}</span></div>
          <div class="field"><span class="label">Date of Birth</span><span class="colon">:</span><span class="value">{{date_of_birth}}</span></div>
          <div class="field"><span class="label">Gender</span><span class="colon">:</span><span class="value">{{gender}}</span></div>
          <div class="field"><span class="label">Category</span><span class="colon">:</span><span class="value">{{student_category}}</span></div>
          <div class="field"><span class="label">Roll Number</span><span class="colon">:</span><span class="value">{{roll_number}}</span></div>
          <div class="field"><span class="label">Registration No.</span><span class="colon">:</span><span class="value">{{registration_number}}</span></div>
          <div class="field"><span class="label">Address</span><span class="colon">:</span><span class="value">{{permanent_address}}</span></div>
        </div>
      </div>
      <div class="dbc-tc-panel">
        <p class="dbc-tc-section-title">Academic Details</p>
        <div class="dbc-tc-grid">
          <div class="field"><span class="label">Programme</span><span class="colon">:</span><span class="value">{{programme}}</span></div>
          <div class="field"><span class="label">Major / Honours</span><span class="colon">:</span><span class="value">{{major_subject}}</span></div>
          <div class="field"><span class="label">Session</span><span class="colon">:</span><span class="value">{{academic_session}}</span></div>
          <div class="field"><span class="label">Admission Date</span><span class="colon">:</span><span class="value">{{date_of_admission}}</span></div>
          <div class="field"><span class="label">Last Date of Attendance</span><span class="colon">:</span><span class="value">{{date_of_leaving}}</span></div>
          <div class="field"><span class="label">Last Semester</span><span class="colon">:</span><span class="value">{{last_semester_completed}}</span></div>
          <div class="field"><span class="label">Academic Status</span><span class="colon">:</span><span class="value status">{{academic_status}}</span></div>
        </div>
      </div>
    </div>

    <div class="dbc-tc-body">
      <p>This is to certify that <strong>{{student_title}} {{student_name}}</strong>, Roll No. <strong>{{roll_number}}</strong>, Registration No. <strong>{{registration_number}}</strong>, was a bonafide student of Don Bosco College, Tura (NEHU) from <strong>{{date_of_admission}}</strong> to <strong>{{date_of_leaving}}</strong>. The student pursued the <strong>{{degree_phrase}}</strong>, completed studies up to <strong>{{last_semester_completed}}</strong>, and conduct and academic performance were found to be satisfactory.</p>
    </div>

    <div class="dbc-tc-summary-wrap">
      <p class="dbc-tc-section-title">Academic &amp; Conduct Summary</p>
      <table class="dbc-tc-admin">
        <tr><th>Conduct</th><td>{{conduct}}</td><th>Attendance</th><td>{{attendance}}</td></tr>
        <tr><th>Fee Clearance</th><td>{{fee_clearance}}</td><th>Library</th><td>{{library_clearance}}</td></tr>
        <tr><th>Hostel</th><td>{{hostel_clearance}}</td><th>Reason for Leaving</th><td>{{reason_for_leaving}}</td></tr>
      </table>
    </div>

    <p class="dbc-tc-section-title">Remarks</p>
    <div class="dbc-tc-remarks">{{remarks}}</div>

    <footer class="dbc-tc-footer">
      <div>{{prepared_by_block}}</div>
      <div class="dbc-tc-seal">
        {{seal_block}}
        <div class="caption">OFFICIAL SEAL</div>
      </div>
      <div>{{verified_by_block}}</div>
      <div>{{principal_signature_block}}</div>
    </footer>
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
