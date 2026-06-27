/** Normalize common date strings to ISO `YYYY-MM-DD` for storage. */
export function parseFlexibleDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return formatIsoDate(value);
  }

  const text = String(value).trim();
  if (!text) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  let match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD.MM.YYYY (common in Indian Excel exports)
  match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // M/D/YY (US short year, e.g. 8/18/07)
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    const [, m, d, yy] = match;
    const year = Number(yy) > 30 ? 1900 + Number(yy) : 2000 + Number(yy);
    return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Excel serial (rough range for birth dates ~1950–2015)
  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 10000 && serial < 60000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const parsed = new Date(excelEpoch + serial * 86_400_000);
    if (!Number.isNaN(parsed.getTime())) return formatIsoDate(parsed);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return formatIsoDate(parsed);
  return null;
}

function formatIsoDate(value: Date) {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
