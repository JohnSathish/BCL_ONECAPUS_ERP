type MomContext = {
  institutionName: string;
  committeeName: string;
  committeeCode: string;
  meetingTitle: string;
  meetingDate: string;
  meetingTime?: string | null;
  venue?: string | null;
  discussion?: string | null;
  decisions?: string | null;
  resolutions?: string | null;
  futureActions?: string | null;
  agendaItems?: Array<{ title: string; description?: string | null }>;
  attendance?: Array<{ displayName?: string | null; status: string }>;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraph(text?: string | null) {
  if (!text?.trim()) return '<p class="muted">—</p>';
  return `<p>${escapeHtml(text).replace(/\n/g, '<br/>')}</p>`;
}

export function renderGovernanceMomHtml(ctx: MomContext) {
  const agendaRows = ctx.agendaItems?.length
    ? ctx.agendaItems
        .map(
          (item, index) =>
            `<tr><td>${index + 1}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.description ?? '—')}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="muted">No agenda items recorded</td></tr>';

  const attendanceRows = ctx.attendance?.length
    ? ctx.attendance
        .map(
          (row) =>
            `<tr><td>${escapeHtml(row.displayName ?? 'Member')}</td><td>${escapeHtml(row.status)}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="2" class="muted">Attendance not recorded</td></tr>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Minutes of Meeting - ${escapeHtml(ctx.meetingTitle)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; margin: 0; padding: 24px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #111827; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
    .meta { color: #4b5563; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .muted { color: #6b7280; font-style: italic; }
    .header { text-align: center; margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(ctx.institutionName)}</h1>
    <div class="meta">Minutes of Meeting</div>
  </div>
  <div class="meta">
    <strong>Committee:</strong> ${escapeHtml(ctx.committeeName)} (${escapeHtml(ctx.committeeCode)})<br/>
    <strong>Meeting:</strong> ${escapeHtml(ctx.meetingTitle)}<br/>
    <strong>Date:</strong> ${escapeHtml(ctx.meetingDate)}${ctx.meetingTime ? ` at ${escapeHtml(ctx.meetingTime)}` : ''}<br/>
    <strong>Venue:</strong> ${escapeHtml(ctx.venue ?? '—')}
  </div>

  <h2>Agenda</h2>
  <table>
    <thead><tr><th>#</th><th>Item</th><th>Description</th></tr></thead>
    <tbody>${agendaRows}</tbody>
  </table>

  <h2>Discussion</h2>
  ${paragraph(ctx.discussion)}

  <h2>Decisions</h2>
  ${paragraph(ctx.decisions)}

  <h2>Resolutions</h2>
  ${paragraph(ctx.resolutions)}

  <h2>Future Actions</h2>
  ${paragraph(ctx.futureActions)}

  <h2>Attendance</h2>
  <table>
    <thead><tr><th>Member</th><th>Status</th></tr></thead>
    <tbody>${attendanceRows}</tbody>
  </table>
</body>
</html>`;
}
