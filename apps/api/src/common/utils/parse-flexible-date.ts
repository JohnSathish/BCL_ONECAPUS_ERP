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
    return toValidIsoDate(Number(y), Number(m), Number(d));
  }

  // DD/MM/YYYY or DD-MM-YYYY
  match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return toValidIsoDate(Number(y), Number(m), Number(d));
  }

  // DD.MM.YYYY (common in Indian Excel exports)
  match = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return toValidIsoDate(Number(y), Number(m), Number(d));
  }

  // M/D/YY (US short year, e.g. 8/18/07)
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    const [, m, d, yy] = match;
    const year = Number(yy) > 30 ? 1900 + Number(yy) : 2000 + Number(yy);
    return toValidIsoDate(year, Number(m), Number(d));
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

const MIN_YEAR = 1900;
const MAX_YEAR_OFFSET = 1; // allow next calendar year (admission windows)

function maxAllowedYear() {
  return new Date().getUTCFullYear() + MAX_YEAR_OFFSET;
}

function isPlausibleYear(year: number) {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= maxAllowedYear();
}

/** Reject impossible calendar dates (e.g. month 13) that `new Date` cannot represent. */
function toValidIsoDate(
  year: number,
  month: number,
  day: number,
): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !isPlausibleYear(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatIsoDate(value: Date): string | null {
  const y = value.getFullYear();
  const m = value.getMonth() + 1;
  const d = value.getDate();
  if (isPlausibleYear(y)) {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  // Excel serials are built with Date.UTC — fall back to UTC components.
  const yUtc = value.getUTCFullYear();
  if (!isPlausibleYear(yUtc)) return null;
  return `${yUtc}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}
