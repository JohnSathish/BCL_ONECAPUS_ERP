/** Shared academic calendar types + colors for web admin UI. */

export const CALENDAR_TYPE_COLORS: Record<string, string> = {
  WORKING_DAY: '#16a34a',
  NATIONAL_HOLIDAY: '#dc2626',
  STATE_HOLIDAY: '#ef4444',
  COLLEGE_HOLIDAY: '#f87171',
  RESTRICTED_HOLIDAY: '#fb7185',
  EMERGENCY_HOLIDAY: '#b91c1c',
  WEATHER_CLOSURE: '#e11d48',
  WEEKEND: '#fca5a5',
  HOLIDAY_CLASS: '#22c55e',
  COMPENSATORY_CLASS: '#4ade80',
  MAKEUP_CLASS: '#86efac',
  ORIENTATION: '#0ea5e9',
  BRIDGE_COURSE: '#38bdf8',
  SEMESTER_START: '#2563eb',
  SEMESTER_END: '#1d4ed8',
  TEACHING_BREAK: '#64748b',
  INTERNAL_ASSESSMENT: '#f97316',
  MID_SEM_EXAM: '#ea580c',
  END_SEM_EXAM: '#c2410c',
  PRACTICAL_EXAM: '#fb923c',
  VIVA: '#fdba74',
  HALL_TICKET: '#f59e0b',
  RESULT: '#d97706',
  FEE_DUE: '#a855f7',
  FEE_FINE_START: '#9333ea',
  ADMISSION_WINDOW: '#06b6d4',
  SEMINAR: '#8b5cf6',
  WORKSHOP: '#7c3aed',
  CONFERENCE: '#6d28d9',
  IQAC_ACTIVITY: '#db2777',
  STAFF_MEETING: '#7c3aed',
  DEPARTMENT_MEETING: '#a78bfa',
  SPORTS: '#2563eb',
  CULTURAL: '#ec4899',
  CONVOCATION: '#be185d',
  PRAYER: '#0f766e',
  MASS: '#115e59',
  LEAVE: '#eab308',
  MAINTENANCE: '#78716c',
  INSTITUTIONAL_EVENT: '#3b82f6',
  STAFF_EVENT: '#6366f1',
  CUSTOM: '#64748b',
  OTHER: '#94a3b8',
};

export function colorForType(type: string, override?: string | null) {
  return override || CALENDAR_TYPE_COLORS[type] || '#64748b';
}

export type CalendarViewMode = 'month' | 'week' | 'day' | 'agenda';

export type CalendarFilterKey =
  | 'holidays'
  | 'workingDays'
  | 'exams'
  | 'meetings'
  | 'sports'
  | 'admission'
  | 'iqac'
  | 'staffEvents'
  | 'studentEvents'
  | 'publicEvents';

export const CALENDAR_FILTER_LABELS: Record<CalendarFilterKey, string> = {
  holidays: 'Holidays',
  workingDays: 'Working Days',
  exams: 'Exams',
  meetings: 'Meetings',
  sports: 'Sports',
  admission: 'Admission',
  iqac: 'IQAC',
  staffEvents: 'Staff Events',
  studentEvents: 'Student Events',
  publicEvents: 'Public Events',
};

export const DEFAULT_CALENDAR_FILTERS: Record<CalendarFilterKey, boolean> = {
  holidays: true,
  workingDays: true,
  exams: true,
  meetings: true,
  sports: true,
  admission: true,
  iqac: true,
  staffEvents: true,
  studentEvents: true,
  publicEvents: true,
};

const HOLIDAY = new Set([
  'NATIONAL_HOLIDAY',
  'STATE_HOLIDAY',
  'COLLEGE_HOLIDAY',
  'RESTRICTED_HOLIDAY',
  'EMERGENCY_HOLIDAY',
  'WEATHER_CLOSURE',
  'WEEKEND',
]);
const EXAM = new Set([
  'INTERNAL_ASSESSMENT',
  'MID_SEM_EXAM',
  'END_SEM_EXAM',
  'PRACTICAL_EXAM',
  'VIVA',
  'HALL_TICKET',
  'RESULT',
]);
const MEETING = new Set(['STAFF_MEETING', 'DEPARTMENT_MEETING', 'STAFF_EVENT']);
const IQAC = new Set(['IQAC_ACTIVITY', 'WORKSHOP', 'CONFERENCE']);

export function filterGroupForType(type: string): CalendarFilterKey {
  if (HOLIDAY.has(type)) return 'holidays';
  if (type === 'WORKING_DAY' || type.includes('CLASS')) return 'workingDays';
  if (EXAM.has(type)) return 'exams';
  if (MEETING.has(type)) return 'meetings';
  if (type === 'SPORTS') return 'sports';
  if (type === 'ADMISSION_WINDOW') return 'admission';
  if (IQAC.has(type)) return 'iqac';
  if (type === 'LEAVE') return 'staffEvents';
  return 'studentEvents';
}

export function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to, last };
}

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeekSunday(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  const dow = d.getUTCDay();
  return addDaysIso(iso, -dow);
}

export function formatDisplayDate(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildSimpleRrule(freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY') {
  return `FREQ=${freq}`;
}

/** Soft chip colors for sidebar filters / legend. */
export const FILTER_ACCENT: Record<CalendarFilterKey, { dot: string; badge: string }> = {
  holidays: { dot: '#dc2626', badge: 'bg-rose-50 text-rose-700' },
  workingDays: { dot: '#16a34a', badge: 'bg-emerald-50 text-emerald-700' },
  exams: { dot: '#ea580c', badge: 'bg-orange-50 text-orange-700' },
  meetings: { dot: '#7c3aed', badge: 'bg-violet-50 text-violet-700' },
  sports: { dot: '#2563eb', badge: 'bg-blue-50 text-blue-700' },
  admission: { dot: '#06b6d4', badge: 'bg-cyan-50 text-cyan-700' },
  iqac: { dot: '#4f46e5', badge: 'bg-indigo-50 text-indigo-700' },
  staffEvents: { dot: '#6366f1', badge: 'bg-indigo-50 text-indigo-700' },
  studentEvents: { dot: '#3b82f6', badge: 'bg-sky-50 text-sky-700' },
  publicEvents: { dot: '#0ea5e9', badge: 'bg-sky-50 text-sky-700' },
};

export function dayKindBadge(kind?: string | null) {
  const k = String(kind ?? '').toUpperCase();
  if (k === 'WEEKEND') {
    return { label: 'WEEKEND', className: 'bg-rose-100 text-rose-700' };
  }
  if (k.includes('HOLIDAY') || k === 'WEATHER_CLOSURE') {
    return { label: 'HOLIDAY', className: 'bg-rose-100 text-rose-700' };
  }
  if (k === 'BREAK') {
    return { label: 'BREAK', className: 'bg-slate-100 text-slate-700' };
  }
  if (k.includes('EXAM')) {
    return { label: 'EXAM', className: 'bg-orange-100 text-orange-700' };
  }
  if (k === 'WORKING' || k === 'WORKING_DAY' || k.includes('CLASS')) {
    return { label: 'WORKING', className: 'bg-emerald-100 text-emerald-700' };
  }
  if (k === 'NON_WORKING') {
    return { label: 'OFF', className: 'bg-slate-100 text-slate-600' };
  }
  return { label: k || 'DAY', className: 'bg-slate-100 text-slate-600' };
}

export function dayCellSurface(kind?: string | null, isToday = false) {
  const k = String(kind ?? '').toUpperCase();
  if (isToday) return 'bg-sky-50 ring-2 ring-sky-400/70';
  if (k === 'WEEKEND') return 'bg-rose-50/80';
  if (k.includes('HOLIDAY') || k === 'WEATHER_CLOSURE') return 'bg-rose-100/70';
  if (k.includes('EXAM')) return 'bg-orange-50/80';
  return 'bg-emerald-50/50';
}

/** Pastel card surface for event chips (left accent = colorForType). */
export function eventChipSurface(type: string) {
  const group = filterGroupForType(type);
  switch (group) {
    case 'exams':
      return 'bg-orange-50 text-orange-950 border-orange-200';
    case 'meetings':
      return 'bg-violet-50 text-violet-950 border-violet-200';
    case 'holidays':
      return 'bg-rose-50 text-rose-950 border-rose-200';
    case 'sports':
      return 'bg-blue-50 text-blue-950 border-blue-200';
    case 'admission':
      return 'bg-cyan-50 text-cyan-950 border-cyan-200';
    case 'iqac':
      return 'bg-indigo-50 text-indigo-950 border-indigo-200';
    case 'staffEvents':
      return 'bg-amber-50 text-amber-950 border-amber-200';
    default:
      return 'bg-sky-50 text-sky-950 border-sky-200';
  }
}

export function formatClock(value?: string | null) {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = raw.match(/T(\d{2}):(\d{2})/);
  const hm = iso ? `${iso[1]}:${iso[2]}` : raw.slice(0, 5);
  const [hStr, mStr] = hm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatDayBadge(iso: string) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return {
    day: d.getUTCDate(),
    mon: d.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' }).toUpperCase(),
  };
}
