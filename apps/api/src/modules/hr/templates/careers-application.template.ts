export type CareersApplicationPdfModel = {
  applicationNo: string;
  appliedOn: string;
  generatedAt: string;
  contentHashShort: string;
  verifyUrl: string;
  qrDataUri: string;
  logoDataUri: string | null;
  photoDataUri: string | null;
  collegeName: string;
  collegeAddress: string;
  collegeWebsite: string;
  collegePhone: string;
  collegeEmail: string;
  recruitmentSession: string;
  positionTitle: string;
  departmentName: string;
  personal: Record<string, string>;
  contact: Record<string, string>;
  education: Array<{
    qualification: string;
    university: string;
    institution: string;
    year: string;
    score: string;
  }>;
  experience: Array<{
    institution: string;
    designation: string;
    department: string;
    fromDate: string;
    toDate: string;
    years: string;
  }>;
  research: Record<string, string>;
  skills: Record<string, string>;
  references: Array<{
    name: string;
    designation: string;
    institution: string;
    email: string;
    phone: string;
  }>;
  declaration: {
    accepted: string;
    signatureName: string;
    place: string;
    date: string;
  };
};

function esc(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dash(value?: string | null) {
  const v = (value ?? '').toString().trim();
  return v ? esc(v) : '—';
}

function kvRows(map: Record<string, string>) {
  return Object.entries(map)
    .map(
      ([label, value]) =>
        `<tr><th>${esc(label)}</th><td>${dash(value)}</td></tr>`,
    )
    .join('');
}

export function buildCareersApplicationHtml(model: CareersApplicationPdfModel) {
  const eduRows =
    model.education.length > 0
      ? model.education
          .map(
            (r) => `<tr>
        <td>${dash(r.qualification)}</td>
        <td>${dash(r.university)}</td>
        <td>${dash(r.institution)}</td>
        <td>${dash(r.year)}</td>
        <td>${dash(r.score)}</td>
      </tr>`,
          )
          .join('')
      : `<tr><td colspan="5">—</td></tr>`;

  const expRows =
    model.experience.length > 0
      ? model.experience
          .map(
            (r) => `<tr>
        <td>${dash(r.institution)}</td>
        <td>${dash(r.designation)}</td>
        <td>${dash(r.department)}</td>
        <td>${dash(r.fromDate)}</td>
        <td>${dash(r.toDate)}</td>
        <td>${dash(r.years)}</td>
      </tr>`,
          )
          .join('')
      : `<tr><td colspan="6">—</td></tr>`;

  const refRows =
    model.references.length > 0
      ? model.references
          .map(
            (r) => `<tr>
        <td>${dash(r.name)}</td>
        <td>${dash(r.designation)}</td>
        <td>${dash(r.institution)}</td>
        <td>${dash(r.email)}</td>
        <td>${dash(r.phone)}</td>
      </tr>`,
          )
          .join('')
      : `<tr><td colspan="5">—</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(model.applicationNo)} – Career Application</title>
<style>
  @page { size: A4; margin: 12mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #1f2a37;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5px;
    line-height: 1.35;
  }
  .wrap { position: relative; }
  .watermark {
    position: fixed;
    inset: 20% 5%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
    opacity: 0.06;
    font-size: 36px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #0b2e59;
    transform: rotate(-24deg);
    text-align: center;
  }
  .content { position: relative; z-index: 1; }
  .header {
    display: grid;
    grid-template-columns: 72px 1fr 86px;
    gap: 10px;
    align-items: center;
    border-bottom: 2px solid #0b2e59;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }
  .logo { width: 68px; height: 68px; object-fit: contain; }
  .brand { text-align: center; }
  .brand h1 { margin: 0; color: #0b2e59; font-size: 16px; letter-spacing: 0.03em; }
  .brand .portal { margin: 2px 0 0; font-size: 11px; font-weight: 700; color: #c8102e; letter-spacing: 0.12em; }
  .brand p { margin: 2px 0 0; color: #35506d; font-size: 9px; }
  .qr-wrap { text-align: center; }
  .qr-wrap img { width: 74px; height: 74px; }
  .qr-wrap span { display: block; margin-top: 2px; font-size: 7.5px; color: #617083; }
  .title-bar {
    background: #0b2e59;
    color: #fff;
    text-align: center;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 7px 10px;
    font-size: 11px;
    margin-bottom: 8px;
  }
  .meta {
    display: grid;
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: 0;
    border: 1px solid #c9d3df;
    background: #eef2f6;
    margin-bottom: 8px;
  }
  .meta div { padding: 6px 8px; border-right: 1px solid #c9d3df; }
  .meta div:last-child { border-right: 0; }
  .meta label {
    display: block;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #617083;
    margin-bottom: 2px;
  }
  .meta strong { color: #0b2e59; font-size: 10.5px; }
  .profile {
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: 10px;
    border: 1px solid #c9d3df;
    padding: 8px;
    margin-bottom: 10px;
  }
  .photo {
    width: 88px;
    height: 110px;
    object-fit: cover;
    border: 1px solid #c9d3df;
    background: #f5f7fa;
  }
  .photo-ph {
    width: 88px;
    height: 110px;
    border: 1px dashed #c9d3df;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 9px;
    text-align: center;
    padding: 4px;
  }
  h2 {
    margin: 12px 0 6px;
    font-size: 11px;
    color: #0b2e59;
    border-left: 3px solid #c8102e;
    padding-left: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  table.data {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4px;
  }
  table.data th, table.data td {
    border: 1px solid #d5dde7;
    padding: 5px 6px;
    vertical-align: top;
    text-align: left;
  }
  table.data th {
    width: 32%;
    background: #f3f6f9;
    color: #35506d;
    font-weight: 600;
    font-size: 9.5px;
  }
  table.grid th {
    width: auto;
    background: #0b2e59;
    color: #fff;
    font-size: 9px;
    text-transform: uppercase;
  }
  table.grid td { font-size: 9.5px; }
  .sign {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin-top: 18px;
  }
  .sign .box {
    border-top: 1px solid #94a3b8;
    padding-top: 6px;
    min-height: 48px;
  }
  .sign label { display: block; font-size: 8.5px; color: #617083; text-transform: uppercase; }
  .sign strong { display: block; margin-top: 4px; font-size: 11px; color: #0b2e59; }
  .footer-note {
    margin-top: 16px;
    padding-top: 8px;
    border-top: 1px solid #c9d3df;
    font-size: 8px;
    color: #617083;
    text-align: center;
    line-height: 1.45;
  }
</style>
</head>
<body>
  <div class="watermark">${esc(model.applicationNo)}</div>
  <div class="wrap content">
    <div class="header">
      <div>${model.logoDataUri ? `<img class="logo" src="${model.logoDataUri}" alt="Logo" />` : ''}</div>
      <div class="brand">
        <h1>${esc(model.collegeName)}</h1>
        <div class="portal">CAREER PORTAL</div>
        <p>${dash(model.collegeAddress)}</p>
        <p>${dash(model.collegeWebsite)} · ${dash(model.collegePhone)} · ${dash(model.collegeEmail)}</p>
      </div>
      <div class="qr-wrap">
        <img src="${model.qrDataUri}" alt="QR" />
        <span>Scan to verify</span>
      </div>
    </div>

    <div class="title-bar">ONLINE APPLICATION FORM</div>

    <div class="meta">
      <div>
        <label>Application No</label>
        <strong>${esc(model.applicationNo)}</strong>
      </div>
      <div>
        <label>Applied On</label>
        <strong>${esc(model.appliedOn)}</strong>
      </div>
      <div>
        <label>Recruitment Session</label>
        <strong>${esc(model.recruitmentSession)}</strong>
      </div>
    </div>

    <div class="profile">
      ${
        model.photoDataUri
          ? `<img class="photo" src="${model.photoDataUri}" alt="Photo" />`
          : `<div class="photo-ph">Passport<br/>Photo</div>`
      }
      <div>
        <table class="data">
          <tr><th>Applied Position</th><td>${dash(model.positionTitle)}</td></tr>
          <tr><th>Department</th><td>${dash(model.departmentName)}</td></tr>
          <tr><th>Full Name</th><td>${dash(model.personal['Full Name'])}</td></tr>
          <tr><th>Email</th><td>${dash(model.contact['Email Address'])}</td></tr>
          <tr><th>Mobile</th><td>${dash(model.contact['Mobile Number'])}</td></tr>
        </table>
      </div>
    </div>

    <h2>Personal Information</h2>
    <table class="data">${kvRows(model.personal)}</table>

    <h2>Contact & Address</h2>
    <table class="data">${kvRows(model.contact)}</table>

    <h2>Educational Qualifications</h2>
    <table class="data grid">
      <thead>
        <tr>
          <th>Qualification</th>
          <th>University</th>
          <th>Institution</th>
          <th>Year</th>
          <th>Percentage / CGPA</th>
        </tr>
      </thead>
      <tbody>${eduRows}</tbody>
    </table>

    <h2>Experience</h2>
    <table class="data grid">
      <thead>
        <tr>
          <th>Institution</th>
          <th>Designation</th>
          <th>Department</th>
          <th>From</th>
          <th>To</th>
          <th>Years</th>
        </tr>
      </thead>
      <tbody>${expRows}</tbody>
    </table>

    <h2>Research Profile</h2>
    <table class="data">${kvRows(model.research)}</table>

    <h2>Skills</h2>
    <table class="data">${kvRows(model.skills)}</table>

    <h2>References</h2>
    <table class="data grid">
      <thead>
        <tr>
          <th>Name</th>
          <th>Designation</th>
          <th>Institution</th>
          <th>Email</th>
          <th>Phone</th>
        </tr>
      </thead>
      <tbody>${refRows}</tbody>
    </table>

    <h2>Declaration</h2>
    <p style="margin:0 0 8px;font-size:10px;">
      I hereby declare that the information provided in this application is true and correct to the best of my knowledge.
      I understand that any false information may lead to rejection or cancellation of my application.
      <strong>Accepted:</strong> ${dash(model.declaration.accepted)}
    </p>

    <div class="sign">
      <div class="box">
        <label>Candidate Signature</label>
        <strong>${dash(model.declaration.signatureName)}</strong>
      </div>
      <div class="box">
        <label>Date</label>
        <strong>${dash(model.declaration.date)}</strong>
      </div>
      <div class="box">
        <label>Place</label>
        <strong>${dash(model.declaration.place)}</strong>
      </div>
    </div>

    <div class="footer-note">
      Computer Generated Document · BCL OneCampus Career Portal · ${esc(model.collegeName)} · Powered by BaseCode Labs Pvt Ltd<br/>
      Generated ${esc(model.generatedAt)} · Hash ${esc(model.contentHashShort)} · Verify ${esc(model.verifyUrl)}
    </div>
  </div>
</body>
</html>`;
}
