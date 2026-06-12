import type {
  IdVerificationReportMeta,
  IdVerificationReportRow,
  IdVerificationReportSection,
} from './id-card-verification-report-types';

function escHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(value: string | null | undefined, mono = false) {
  const text = value?.trim() || '—';
  return `<td class="${mono ? 'mono' : ''}">${escHtml(text)}</td>`;
}

function photoCell(url: string | null, name: string) {
  if (url) {
    return `<td class="photo-cell"><img src="${escHtml(url)}" alt="" class="photo" /></td>`;
  }
  return `<td class="photo-cell"><div class="photo-placeholder">${escHtml(name.charAt(0).toUpperCase())}</div></td>`;
}

function sectionTable(rows: IdVerificationReportRow[], startSerial: number): string {
  const body = rows
    .map((row, idx) => {
      const sl = startSerial + idx;
      return `<tr>
        <td class="sl">${sl}</td>
        ${photoCell(row.photoUrl, row.fullName)}
        ${cell(row.fullName)}
        ${cell(row.registrationNumber, true)}
        ${cell(row.rollNumber, true)}
        ${cell(row.programme)}
        ${cell(row.semester)}
        ${cell(row.gender)}
        ${cell(row.bloodGroup)}
        ${cell(row.mobile, true)}
        ${cell(row.rfidNumber, true)}
        ${cell(row.validToLabel)}
        ${cell(row.emergencyContact)}
        <td class="sign-cell"></td>
        <td class="remark-cell"></td>
      </tr>`;
    })
    .join('');

  return `<table class="verify-table">
    <thead>
      <tr>
        <th class="sl-col">Sl</th>
        <th class="photo-col">Photo</th>
        <th>Name (as on ID)</th>
        <th>Reg No</th>
        <th>Roll No</th>
        <th>Programme</th>
        <th>Sem</th>
        <th>Gender</th>
        <th>Blood</th>
        <th>Mobile</th>
        <th>RFID</th>
        <th>Valid Until</th>
        <th>Emergency</th>
        <th class="sign-col">Student Sign</th>
        <th class="remark-col">Corrections / Remarks</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

function sectionHtml(
  section: IdVerificationReportSection,
  meta: IdVerificationReportMeta,
  startSerial: number,
) {
  return `<section class="dept-section">
    <div class="dept-banner">
      <h2>${escHtml(section.departmentName)}</h2>
      <p>${section.rows.length} student(s)${meta.semester ? ` · Semester ${escHtml(meta.semester)}` : ''}</p>
    </div>
    ${sectionTable(section.rows, startSerial)}
  </section>`;
}

const REPORT_STYLES = `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #0f172a; background: #fff; }
  .report-page { padding: 0; }
  .report-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    border-bottom: 2px solid #001B44; padding-bottom: 8px; margin-bottom: 10px;
  }
  .report-header .brand { display: flex; gap: 10px; align-items: center; }
  .report-header .logo {
    width: 42px; height: 42px; object-fit: contain; border-radius: 50%;
    border: 1px solid #cbd5e1;
  }
  .report-header .logo-fallback {
    width: 42px; height: 42px; border-radius: 50%; background: #001B44; color: #fff;
    display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11pt;
  }
  .report-header h1 { margin: 0; font-size: 13pt; font-weight: 900; text-transform: uppercase; color: #001B44; }
  .report-header .subtitle { margin: 2px 0 0; font-size: 8.5pt; color: #475569; }
  .report-header .meta { text-align: right; font-size: 8pt; color: #475569; line-height: 1.45; }
  .report-header .meta strong { color: #001B44; display: block; font-size: 9pt; margin-bottom: 2px; }
  .instructions {
    margin: 0 0 10px; padding: 8px 10px; background: #f8fafc; border: 1px solid #cbd5e1;
    border-left: 4px solid #C5A028; font-size: 8pt; line-height: 1.45; color: #334155;
  }
  .instructions ol { margin: 4px 0 0 18px; padding: 0; }
  .dept-section { margin-bottom: 16px; }
  .dept-section + .dept-section { page-break-before: always; padding-top: 4px; }
  .dept-banner {
    display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
    margin-bottom: 6px; padding: 6px 8px; background: #001B44; color: #fff;
  }
  .dept-banner h2 { margin: 0; font-size: 10pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
  .dept-banner p { margin: 0; font-size: 8pt; opacity: 0.92; }
  .verify-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .verify-table th, .verify-table td {
    border: 1px solid #94a3b8; padding: 3px 4px; vertical-align: middle; word-wrap: break-word;
  }
  .verify-table th {
    background: #e2e8f0; font-size: 7pt; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.03em; color: #001B44; text-align: left;
  }
  .verify-table td { font-size: 7.5pt; }
  .verify-table td.mono { font-family: Consolas, 'Courier New', monospace; font-size: 7pt; }
  .verify-table .sl-col, .verify-table .sl { width: 22px; text-align: center; font-weight: 700; }
  .verify-table .photo-col { width: 34px; }
  .verify-table .photo-cell { width: 34px; text-align: center; padding: 2px; }
  .verify-table .photo { width: 28px; height: 34px; object-fit: cover; border: 1px solid #64748b; display: block; margin: 0 auto; }
  .verify-table .photo-placeholder {
    width: 28px; height: 34px; margin: 0 auto; background: #f1f5f9; border: 1px solid #64748b;
    display: flex; align-items: center; justify-content: center; font-weight: 800; color: #001B44; font-size: 10pt;
  }
  .verify-table .sign-col { width: 56px; }
  .verify-table .remark-col { width: 72px; }
  .verify-table .sign-cell, .verify-table .remark-cell { min-height: 28px; background: #fff; }
  .report-footer {
    margin-top: 10px; padding-top: 8px; border-top: 1px solid #cbd5e1;
    display: flex; justify-content: space-between; gap: 16px; font-size: 8pt; color: #475569;
  }
  .report-footer .sig-block { flex: 1; }
  .report-footer .sig-line {
    margin-top: 28px; border-top: 1px solid #334155; padding-top: 4px; font-weight: 700; color: #001B44;
  }
  @media screen {
    body { background: #e2e8f0; padding: 16px; }
    .report-page { max-width: 297mm; margin: 0 auto; background: #fff; padding: 12mm; box-shadow: 0 4px 24px rgba(15,23,42,0.12); }
  }
`;

export function buildIdVerificationReportDocument(
  meta: IdVerificationReportMeta,
  sections: IdVerificationReportSection[],
): string {
  let serial = 1;
  const sectionsHtml = sections
    .map((section) => {
      const html = sectionHtml(section, meta, serial);
      serial += section.rows.length;
      return html;
    })
    .join('');

  const logoHtml = meta.logoUrl
    ? `<img class="logo" src="${escHtml(meta.logoUrl)}" alt="" />`
    : `<div class="logo-fallback">${escHtml(meta.institutionName.charAt(0))}</div>`;

  const filterLine = [meta.semester ? `Semester ${meta.semester}` : null, meta.sessionName]
    .filter(Boolean)
    .join(' · ');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escHtml(meta.reportTitle)}</title>
<style>${REPORT_STYLES}</style></head><body>
<div class="report-page">
  <header class="report-header">
    <div class="brand">
      ${logoHtml}
      <div>
        <h1>${escHtml(meta.institutionName)}</h1>
        <p class="subtitle">${escHtml(meta.reportTitle)}</p>
        ${meta.campusName ? `<p class="subtitle">${escHtml(meta.campusName)}</p>` : ''}
      </div>
    </div>
    <div class="meta">
      <strong>Pre-print verification</strong>
      ${filterLine ? `<div>${escHtml(filterLine)}</div>` : ''}
      <div>Generated: ${escHtml(meta.generatedAt)}</div>
      <div>Total students: ${meta.totalStudents}</div>
    </div>
  </header>

  <div class="instructions">
    <strong>Instructions for students and class representatives</strong>
    <ol>
      <li>Verify every field that will appear on your identity card — especially name spelling, registration number, programme, semester, gender, blood group, mobile, and photograph.</li>
      <li>Write corrections clearly in the <strong>Corrections / Remarks</strong> column and sign in the <strong>Student Sign</strong> column.</li>
      <li>Submit this sheet to the department office within the deadline announced by the college. ID cards will be printed only after verification.</li>
      <li>Report missing or incorrect photos to the administration office immediately.</li>
    </ol>
  </div>

  ${sectionsHtml}

  <footer class="report-footer">
    <div class="sig-block"><div class="sig-line">Head of Department</div></div>
    <div class="sig-block"><div class="sig-line">Class Representative</div></div>
    <div class="sig-block"><div class="sig-line">ID Card Office / Administration</div></div>
  </footer>
</div>
</body></html>`;
}
