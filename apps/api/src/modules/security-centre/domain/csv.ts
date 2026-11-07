export function csvCell(value: unknown): string {
  if (value == null) return '';
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map((header) => csvCell(header)).join(',')];
  for (const row of rows)
    lines.push(row.map((cell) => csvCell(cell)).join(','));
  return lines.join('\n');
}
