/** App-wide date display: dd/mm/yyyy (en-GB). API/storage stays ISO yyyy-mm-dd. */
export const DATE_DISPLAY_LOCALE = 'en-GB';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

export function todayIsoDate(): string {
  const now = new Date();
  return toIsoDateParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function toIsoDateParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseIsoDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const raw = value.includes('T') ? value.slice(0, 10) : value.trim();
  const match = raw.match(ISO_DATE_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** Parse dd/mm/yyyy (also accepts dd-mm-yyyy, dd.mm.yyyy) or ISO yyyy-mm-dd → ISO date string. */
export function parseDisplayDateToIso(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (ISO_DATE_RE.test(trimmed)) return trimmed;

  const match = trimmed.match(DISPLAY_DATE_RE);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return toIsoDateParts(year, month, day);
}

/** ISO or Date → dd/mm/yyyy for inputs and labels. Empty string when invalid/empty. */
export function isoToDisplayDate(value?: string | null): string {
  if (!value?.trim()) return '';
  const iso = parseDisplayDateToIso(value);
  const date = iso ? parseIsoDate(iso) : parseIsoDate(value);
  if (!date) return '';
  return formatDisplayDate(date);
}

/** Format a date as dd/mm/yyyy. Returns em dash for empty/invalid. */
export function formatDisplayDate(value?: string | Date | null): string {
  if (value == null || value === '') return '—';
  const date =
    typeof value === 'string'
      ? (parseIsoDate(value) ?? (Number.isNaN(Date.parse(value)) ? null : new Date(value)))
      : value;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(DATE_DISPLAY_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Format a timestamp as dd/mm/yyyy, hh:mm. */
export function formatDisplayDateTime(value?: string | Date | null): string {
  if (value == null || value === '') return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(DATE_DISPLAY_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DISPLAY_DATETIME_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/;

/** ISO timestamp → dd/mm/yyyy hh:mm for datetime inputs. */
export function isoToDisplayDateTimeInput(value?: string | null): string {
  if (!value?.trim()) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const datePart = formatDisplayDate(date);
  if (datePart === '—') return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}`;
}

/** Parse dd/mm/yyyy hh:mm (date-only ok) or ISO → ISO timestamp string. */
export function parseDisplayDateTimeToIso(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.includes('T') || trimmed.endsWith('Z')) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const match = trimmed.match(DISPLAY_DATETIME_RE);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hours = match[4] != null ? Number(match[4]) : 0;
  const minutes = match[5] != null ? Number(match[5]) : 0;
  const date = new Date(year, month - 1, day, hours, minutes);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }
  return date.toISOString();
}

/** @deprecated Prefer formatDisplayDate — kept for existing imports. */
export function formatShortDate(value?: string | null): string {
  return formatDisplayDate(value);
}
