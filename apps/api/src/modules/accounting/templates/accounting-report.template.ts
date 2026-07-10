type AccountingReportColumn = {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
};

type AccountingReportContext = {
  institutionName: string;
  institutionTagline?: string;
  productName?: string;
  reportTitle: string;
  reportIcon?: string;
  logoDataUri?: string | null;
  primaryColor?: string;
  generatedAt: Date;
  filterLines?: Array<{ label: string; value: string }>;
  summary?: Record<string, string | number>;
  columns: AccountingReportColumn[];
  rows: Array<Record<string, unknown>>;
  footerNote?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInr(value: unknown) {
  const n = Number(value ?? 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCell(key: string, value: unknown) {
  if (value == null || value === '') return '—';
  if (
    /debit|credit|amount|income|expense|surplus|asset|liabilit|profit|total/i.test(
      key,
    )
  ) {
    const n = Number(value);
    if (!Number.isNaN(n) && n !== 0) return formatInr(n);
    if (n === 0) return '—';
  }
  return escapeHtml(value);
}

export function renderAccountingReportPdfHtml(ctx: AccountingReportContext) {
  const primary = ctx.primaryColor ?? '#1e3a8a';
  const accent = '#059669';
  const expense = '#ea580c';
  const generated = ctx.generatedAt.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const headerCells = ctx.columns
    .map(
      (col) =>
        `<th style="text-align:${col.align ?? 'left'}">${escapeHtml(col.label)}</th>`,
    )
    .join('');

  const bodyRows = ctx.rows
    .map((row, index) => {
      const cells = ctx.columns
        .map((col) => {
          const raw = row[col.key];
          const isMoney =
            /debit|credit|amount|income|expense|surplus|asset|liabilit|profit|total/i.test(
              col.key,
            );
          const color = isMoney
            ? col.key.toLowerCase().includes('expense') ||
              col.key.toLowerCase().includes('debit')
              ? expense
              : accent
            : '#111827';
          return `<td style="text-align:${col.align ?? 'left'};color:${color}">${formatCell(col.key, raw)}</td>`;
        })
        .join('');
      const zebra = index % 2 === 1 ? 'background:#f8fafc;' : '';
      return `<tr style="${zebra}">${cells}</tr>`;
    })
    .join('');

  const filterHtml = (ctx.filterLines ?? [])
    .map(
      (line) =>
        `<div class="filter"><span class="label">${escapeHtml(line.label)}</span><span class="value">${escapeHtml(line.value)}</span></div>`,
    )
    .join('');

  const summaryHtml = Object.entries(ctx.summary ?? {})
    .map(
      ([label, value]) =>
        `<div class="summary-card"><div class="summary-label">${escapeHtml(label)}</div><div class="summary-value">${escapeHtml(value)}</div></div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(ctx.reportTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 0; padding: 0; font-size: 10px; }
    .page { padding: 20px 24px 28px; }
    .header { display: flex; gap: 16px; align-items: center; border-bottom: 3px solid ${primary}; padding-bottom: 14px; margin-bottom: 16px; }
    .logo { width: 72px; height: 72px; object-fit: contain; }
    .logo-fallback { width: 72px; height: 72px; border-radius: 12px; background: linear-gradient(135deg, ${primary}, #3b82f6); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22px; }
    .institution { flex: 1; }
    .institution h1 { margin: 0; font-size: 20px; color: ${primary}; letter-spacing: 0.02em; }
    .institution p { margin: 4px 0 0; color: #64748b; font-size: 10px; }
    .report-title { margin: 0 0 12px; font-size: 16px; color: ${primary}; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
    .filters { display: grid; gap: 4px; }
    .filter { display: flex; gap: 8px; }
    .filter .label { color: #64748b; min-width: 110px; }
    .filter .value { font-weight: 600; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .summary-card { background: linear-gradient(135deg, #eff6ff, #f8fafc); border: 1px solid #dbeafe; border-radius: 8px; padding: 8px 10px; }
    .summary-label { color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
    .summary-value { font-size: 12px; font-weight: 700; color: ${primary}; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead th { background: ${primary}; color: #fff; padding: 7px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; border: 1px solid ${primary}; }
    tbody td { border: 1px solid #e2e8f0; padding: 6px; vertical-align: top; }
    .footer { margin-top: 16px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 9px; display: flex; justify-content: space-between; }
    .product { color: ${primary}; font-weight: 600; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      ${
        ctx.logoDataUri
          ? `<img class="logo" src="${ctx.logoDataUri}" alt="Institution logo" />`
          : `<div class="logo-fallback">${escapeHtml(ctx.institutionName.slice(0, 2).toUpperCase())}</div>`
      }
      <div class="institution">
        <h1>${escapeHtml(ctx.institutionName)}</h1>
        ${ctx.institutionTagline ? `<p>${escapeHtml(ctx.institutionTagline)}</p>` : ''}
        <p class="product">${escapeHtml(ctx.productName ?? 'BCL OneCampus ERP')} · Finance & Accounts</p>
      </div>
    </div>
    <h2 class="report-title">${escapeHtml(ctx.reportIcon ?? '📊')} ${escapeHtml(ctx.reportTitle)}</h2>
    <div class="meta-grid">
      <div class="filters">${filterHtml}<div class="filter"><span class="label">Generated</span><span class="value">${escapeHtml(generated)}</span></div></div>
      <div class="summary">${summaryHtml}</div>
    </div>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="${ctx.columns.length}">No records</td></tr>`}</tbody>
    </table>
    <div class="footer">
      <span>${escapeHtml(ctx.footerNote ?? 'Computer-generated financial report. Verify against general ledger before statutory filing.')}</span>
      <span>Powered by BaseCode Labs Pvt. Ltd.</span>
    </div>
  </div>
</body>
</html>`;
}
