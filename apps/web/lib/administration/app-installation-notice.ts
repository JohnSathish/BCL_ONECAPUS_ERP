import type {
  InstallationDepartment,
  InstallationPerson,
  InstallationReport,
  InstallScope,
} from '@/services/app-installation-report';

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusText(status: InstallationPerson['status']) {
  if (status === 'INSTALLED') return 'Installed';
  if (status === 'UNVERIFIED') return 'Unverified';
  return 'Not installed';
}

function day(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function peopleTable(rows: InstallationPerson[], contacts: boolean) {
  const head = contacts
    ? '<th>Sl.</th><th>Name</th><th>Roll / Staff ID</th><th>Designation / Semester</th><th>Official Email</th><th>Mobile</th><th>Status</th><th>Last Login</th><th>Last Active</th>'
    : '<th>Sl.</th><th>Name</th><th>Roll / Staff ID</th><th>Designation / Semester</th><th>Status</th>';
  const body = rows
    .map((person) => {
      const cells = contacts
        ? `<td>${person.serial}</td><td>${escapeHtml(person.name)}</td><td>${escapeHtml(person.identifier)}</td><td>${escapeHtml(person.roleLabel)}</td><td>${escapeHtml(person.email ?? '—')}</td><td>${escapeHtml(person.mobile ?? '—')}</td><td class="status ${person.status.toLowerCase()}">${statusText(person.status)}</td><td>${escapeHtml(day(person.lastLoginAt))}</td><td>${escapeHtml(day(person.lastActiveAt))}</td>`
        : `<td>${person.serial}</td><td>${escapeHtml(person.name)}</td><td>${escapeHtml(person.identifier)}</td><td>${escapeHtml(person.roleLabel)}</td><td class="status ${person.status.toLowerCase()}">${statusText(person.status)}</td>`;
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function departmentBlock(department: InstallationDepartment, scope: InstallScope) {
  const contacts = scope === 'detailed' || scope === 'department';
  const sections: string[] = [];
  const mainTitle =
    scope === 'pending'
      ? `${department.name} — pending installation (${department.people.length})`
      : department.name;
  if (scope === 'pending' && !department.people.length && !department.followUp.length) {
    return '';
  }
  if (department.people.length || scope !== 'pending') {
    sections.push(
      `<h2>${escapeHtml(mainTitle)}</h2>${
        department.people.length
          ? peopleTable(department.people, contacts)
          : '<p class="muted">No users in this list.</p>'
      }`,
    );
  }
  if (scope === 'pending' && department.followUp.length) {
    sections.push(
      `<h2>${escapeHtml(department.name)} — unverified device information (${department.followUp.length})</h2>${peopleTable(department.followUp, false)}`,
    );
  }
  return sections.join('');
}

export function installationNoticeHtml(report: InstallationReport, scope: InstallScope) {
  const summaryRows = report.departments
    .map(
      (department) => `<tr>
        <td class="num">${department.serial}</td>
        <td>${escapeHtml(department.name)}</td>
        <td class="num">${department.total}</td>
        <td class="num">${department.installed}</td>
        <td class="num">${department.notInstalled}</td>
        <td class="num">${department.unverified}</td>
        <td class="num">${department.percent.toFixed(1)}%</td>
      </tr>`,
    )
    .join('');
  const lists =
    scope === 'summary'
      ? ''
      : report.departments.map((department) => departmentBlock(department, scope)).join('');
  const highest = report.summary.highest;
  const lowest = report.summary.lowest;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.headingName)} — Mobile App Installation</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 11px; }
    header { border-bottom: 3px solid #0b2a4a; padding-bottom: 8px; margin-bottom: 12px; }
    h1 { margin: 0; color: #0b2a4a; font-size: 20px; letter-spacing: 0.04em; }
    h2 { margin: 18px 0 6px; color: #0b2a4a; font-size: 13px; }
    .title { margin: 4px 0 0; font-size: 13px; font-weight: 700; color: #0b2a4a; }
    .meta { margin: 4px 0 0; color: #334155; }
    .basis { margin: 8px 0 0; color: #475569; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
    th { background: #0b2a4a; color: #fff; text-align: left; font-size: 10px; }
    td.num, th.num { text-align: right; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .cards { display: flex; gap: 8px; margin: 12px 0; }
    .card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; }
    .card b { display: block; font-size: 16px; color: #0b2a4a; }
    .status { font-weight: 700; }
    .installed { color: #166534; }
    .not_installed { color: #9f1239; }
    .unverified { color: #334155; }
    .muted { color: #64748b; }
    .sign { margin-top: 22px; }
    footer { margin-top: 16px; border-top: 1px solid #cbd5e1; padding-top: 6px; color: #475569; font-size: 10px; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(report.headingName)}</h1>
    <p class="title">DEPARTMENT-WISE MOBILE APP INSTALLATION STATUS REPORT</p>
    <p class="meta">Academic Year: ${escapeHtml(report.academicYear?.name ?? 'Not set')}</p>
    <p class="meta">Report Generated On: ${escapeHtml(report.generatedLabel)}</p>
    <p class="basis">${escapeHtml(report.basis)}</p>
  </header>
  <div class="cards">
    <div class="card"><span>Total users</span><b>${report.summary.total}</b></div>
    <div class="card"><span>Installed</span><b>${report.summary.installed}</b></div>
    <div class="card"><span>Not installed</span><b>${report.summary.notInstalled}</b></div>
    <div class="card"><span>Unverified</span><b>${report.summary.unverified}</b></div>
    <div class="card"><span>Installation</span><b>${report.summary.percent.toFixed(1)}%</b></div>
  </div>
  <p class="meta">Highest: ${escapeHtml(highest ? `${highest.name} (${highest.percent.toFixed(1)}%)` : '—')} &nbsp; Lowest: ${escapeHtml(lowest ? `${lowest.name} (${lowest.percent.toFixed(1)}%)` : '—')}</p>
  <h2>Department summary</h2>
  <table>
    <thead>
      <tr>
        <th class="num">Sl. No.</th>
        <th>Department</th>
        <th class="num">Total Users</th>
        <th class="num">Installed</th>
        <th class="num">Not Installed</th>
        <th class="num">Unverified</th>
        <th class="num">Installation %</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows || '<tr><td colspan="7">No departments match these filters.</td></tr>'}
      <tr>
        <td></td>
        <td><strong>Total</strong></td>
        <td class="num"><strong>${report.summary.total}</strong></td>
        <td class="num"><strong>${report.summary.installed}</strong></td>
        <td class="num"><strong>${report.summary.notInstalled}</strong></td>
        <td class="num"><strong>${report.summary.unverified}</strong></td>
        <td class="num"><strong>${report.summary.percent.toFixed(1)}%</strong></td>
      </tr>
    </tbody>
  </table>
  ${lists}
  <div class="sign">
    <p><strong>Prepared by: IT Department</strong><br />${escapeHtml(report.collegeName)}</p>
  </div>
  <footer>
    <span>Prepared by: IT Department, ${escapeHtml(report.collegeName)}</span>
    <span>Notice board copy</span>
  </footer>
</body>
</html>`;
}

export function printInstallationNotice(report: InstallationReport, scope: InstallScope) {
  const frame = document.createElement('iframe');
  frame.title = 'Print installation report';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(installationNoticeHtml(report, scope));
  doc.close();
  const cleanup = () => window.setTimeout(() => frame.remove(), 1500);
  win.onafterprint = cleanup;
  window.setTimeout(() => {
    win.focus();
    win.print();
    cleanup();
  }, 300);
}
