/** Calendar helpers in Asia/Kolkata — never UTC toISOString() for “today”. */

export function istDayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function istNowMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return 0;
  return h * 60 + (m || 0);
}

export function addDayKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Monday = 1 … Sunday = 7, matching school timetable dayOfWeek. */
export function weekdayFromKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return utc === 0 ? 7 : utc;
}

export function formatDayLabel(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
  const month = dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${weekday}, ${d} ${month} ${y}`;
}

export function formatMonthLong(stamp: string) {
  const [y, m] = stamp.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatIstStamp(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${date}, ${time.replace(/\s*(am|pm)/i, (_, mer: string) => ` ${mer.toUpperCase()}`)}`;
}

export type CalendarCell = { key: string; day: number; outside: boolean };

/** Sunday-first month grid, including overflow days from the neighbouring months. */
export function sundayMonthGrid(stamp: string): CalendarCell[] {
  const [y, m] = stamp.split('-').map(Number);
  const firstKey = `${stamp}-01`;
  const startPad = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < startPad; i++) {
    const key = addDayKey(firstKey, i - startPad);
    cells.push({ key, day: Number(key.slice(8)), outside: true });
  }
  for (let d = 1; d <= days; d++) {
    const key = `${stamp}-${String(d).padStart(2, '0')}`;
    cells.push({ key, day: d, outside: false });
  }
  while (cells.length % 7) {
    const key = addDayKey(cells[cells.length - 1].key, 1);
    cells.push({ key, day: Number(key.slice(8)), outside: true });
  }
  return cells;
}

export function monthsBetween(startKey: string, endKey: string) {
  const out: string[] = [];
  let y = Number(startKey.slice(0, 4));
  let m = Number(startKey.slice(5, 7));
  const ey = Number(endKey.slice(0, 4));
  const em = Number(endKey.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function splitClock(hhmm: string) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  const hour = Number.isNaN(h) ? 0 : h;
  const min = Number.isNaN(m) ? 0 : m;
  const am = hour < 12;
  const hr = hour % 12 || 12;
  return {
    time: `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    mer: am ? 'AM' : 'PM',
  };
}

const ICONS: Array<{ test: RegExp; emoji: string; bg: string; fg: string }> = [
  { test: /break|lunch|recess/, emoji: '☕', bg: '#fce7f3', fg: '#be185d' },
  { test: /english|lang|grammar/, emoji: '📖', bg: '#dbeafe', fg: '#1d4ed8' },
  { test: /math/, emoji: '🧮', bg: '#d1fae5', fg: '#047857' },
  { test: /rhyme|music|sing|art|draw/, emoji: '🎵', bg: '#fce7f3', fg: '#9d174d' },
  { test: /general knowledge|gk|evs|environ/, emoji: '💡', bg: '#fef9c3', fg: '#a16207' },
  { test: /scien/, emoji: '🔬', bg: '#e0e7ff', fg: '#4338ca' },
  { test: /comput|it\b|coding/, emoji: '💻', bg: '#cffafe', fg: '#0e7490' },
  { test: /pe\b|pt\b|sport|game|physical/, emoji: '⚽', bg: '#ffedd5', fg: '#c2410c' },
  { test: /social|history|geo|civics/, emoji: '🌍', bg: '#ede9fe', fg: '#6d28d9' },
  { test: /moral|value|bible|catech|religion/, emoji: '💜', bg: '#fae8ff', fg: '#a21caf' },
  { test: /hindi|garo|khasi|assamese|language/, emoji: '🗣️', bg: '#ffe4e6', fg: '#be123c' },
];

export function subjectLook(name: string, kind?: string) {
  if (kind === 'BREAK') return { emoji: '☕', bg: '#fce7f3', fg: '#be185d' };
  const n = name.toLowerCase();
  const hit = ICONS.find((row) => row.test.test(n));
  return hit ?? { emoji: '📘', bg: '#e0e7ff', fg: '#4338ca' };
}

const RAILS = ['#dcfce7', '#fef9c3', '#ffedd5', '#e0f2fe', '#fce7f3', '#ede9fe'];

export function railColor(index: number) {
  return RAILS[index % RAILS.length];
}

export type PeriodStatus = 'NOW' | 'UPCOMING' | 'DONE' | 'BREAK' | null;

export function periodStatus(
  start: string,
  end: string,
  kind: string | undefined,
  viewingToday: boolean,
  nowMinutes: number,
): PeriodStatus {
  if (!viewingToday) return kind === 'BREAK' ? 'BREAK' : null;
  if (kind === 'BREAK') return 'BREAK';
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (nowMinutes >= a && nowMinutes < b) return 'NOW';
  if (nowMinutes < a) return 'UPCOMING';
  return 'DONE';
}
