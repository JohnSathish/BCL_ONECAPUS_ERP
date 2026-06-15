type ReportRow = Record<string, string | number | null | undefined>;

type ReportContext = {
  institutionName: string;
  reportTitle: string;
  generatedAt: string;
  academicYear?: string;
  columns: string[];
  rows: ReportRow[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderGovernanceReportHtml(ctx: ReportContext) {
  const headerCells = ctx.columns
    .map((col) => `<th>${escapeHtml(col)}</th>`)
    .join('');
  const bodyRows = ctx.rows
    .map((row) => {
      const cells = ctx.columns
        .map((col) => `<td>${escapeHtml(String(row[col] ?? '—'))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(ctx.reportTitle)}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; padding: 24px; font-size: 11px; }
    h1 { font-size: 18px; margin: 0 0 6px; }
    .meta { color: #4b5563; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 5px 6px; text-align: left; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>${escapeHtml(ctx.institutionName)}</h1>
  <h2 style="font-size:14px;margin:0 0 8px;">${escapeHtml(ctx.reportTitle)}</h2>
  <div class="meta">
    Generated: ${escapeHtml(ctx.generatedAt)}
    ${ctx.academicYear ? `<br/>Academic Year: ${escapeHtml(ctx.academicYear)}` : ''}
  </div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows || '<tr><td colspan="' + ctx.columns.length + '">No records</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

export function rowsToCsv(columns: string[], rows: ReportRow[]) {
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => escape(row[col])).join(','));
  }
  return lines.join('\n');
}
