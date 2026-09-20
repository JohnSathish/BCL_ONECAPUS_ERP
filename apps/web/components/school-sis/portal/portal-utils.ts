export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asText(value: unknown, fallback = '—') {
  if (value == null) return fallback;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

export function asNumber(value: unknown, fallback = 0) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function moneyPaise(value: unknown) {
  const n = asNumber(value, 0);
  const rupees = Math.abs(n) >= 1000 && Number.isInteger(n) ? n / 100 : n;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function percentLabel(value: unknown) {
  if (value == null || value === '') return '—';
  const n = asNumber(value, NaN);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

export function initials(name?: string | null) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function formatDay(value?: string | Date | null) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return asText(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function weekdayName(day?: number) {
  return (
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day ?? -1] ?? ''
  );
}

export const CHILD_STORAGE_KEY = 'sls-portal-child';
