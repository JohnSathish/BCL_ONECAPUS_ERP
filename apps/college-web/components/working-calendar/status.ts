import type {
  DayVisual,
  WorkingCalendarDay,
  WorkingCalendarEvent,
  WorkingDayStatus,
} from './types';

const HOLIDAY_RE = /holiday|non-working|result|admission|bridge|staff event/i;
const BREAK_RE = /^break$|teaching break/i;
const EXAM_RE = /^exam$|assessment|mid.?sem|end.?sem|practical|viva/i;
const OPTIONAL_RE = /optional|restricted/i;
const WEEKEND_RE = /weekend/i;
const WORKING_SAT_RE = /working on saturday|saturday working|holiday class|compensatory|makeup/i;

/** Prefer structured events from ERP; fall back to description text. */
export function parseDayEvents(day: WorkingCalendarDay): WorkingCalendarEvent[] {
  if (day.events?.length) {
    return day.events
      .map((e) => ({
        title: String(e.title ?? '').trim(),
        type: String(e.type ?? 'OTHER'),
      }))
      .filter((e) => e.title);
  }
  return String(day.description ?? '')
    .split(/\n+|;\s*/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((title) => ({ title, type: 'OTHER' }));
}

/** @deprecated use parseDayEvents */
export function parseDayEventTitles(description: string): string[] {
  return description
    .split(/\n+|;\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function labelFromDayKind(dayKind?: string, fallback = 'Working'): string {
  const k = String(dayKind ?? '').toUpperCase();
  if (k === 'WEEKEND') return 'Weekend';
  if (k === 'HOLIDAY') return 'Holiday';
  if (k === 'BREAK') return 'Break';
  if (k === 'EXAM') return 'Exam';
  if (k === 'NON_WORKING') return 'Non-working';
  if (k === 'WORKING' || k.includes('CLASS') || k === 'COMPENSATORY') return 'Working';
  return fallback;
}

export function resolveDayVisual(day: WorkingCalendarDay): DayVisual {
  const statusLabel = day.statusLabel.trim();
  const events = parseDayEvents(day);
  const hasEvents = events.length > 0;
  const dayKind = String(day.dayKind ?? '').toUpperCase();

  const isSunday = day.dayOfWeek.toUpperCase() === 'SUN';
  const isSaturday = day.dayOfWeek.toUpperCase() === 'SAT';

  let status: WorkingDayStatus;
  let label: string;

  if (dayKind === 'BREAK' || BREAK_RE.test(statusLabel)) {
    status = 'break';
    label = 'Break';
  } else if (dayKind === 'EXAM' || EXAM_RE.test(statusLabel)) {
    status = 'exam';
    label = 'Exam';
  } else if (
    dayKind === 'HOLIDAY' ||
    (HOLIDAY_RE.test(statusLabel) && !WORKING_SAT_RE.test(statusLabel))
  ) {
    status = 'holiday';
    label = 'Holiday';
  } else if (OPTIONAL_RE.test(statusLabel)) {
    status = 'optional';
    label = 'Optional';
  } else if (
    dayKind === 'WEEKEND' ||
    WEEKEND_RE.test(statusLabel) ||
    (isSunday && !day.isWorkingDay)
  ) {
    status = 'weekend';
    label = 'Weekend';
  } else if (
    (isSaturday && day.isWorkingDay) ||
    WORKING_SAT_RE.test(statusLabel) ||
    (isSaturday && /working/i.test(statusLabel))
  ) {
    status = 'saturday-working';
    label = 'Working';
  } else if (day.isWorkingDay) {
    status = isSaturday ? 'saturday-working' : 'working';
    label = labelFromDayKind(day.dayKind, 'Working');
  } else if (isSunday || isSaturday) {
    status = 'weekend';
    label = 'Weekend';
  } else {
    status = 'holiday';
    label = statusLabel || labelFromDayKind(day.dayKind, 'Holiday');
  }

  return {
    status,
    label,
    title: hasEvents ? events[0].title : statusLabel || undefined,
    events,
  };
}

export function summarizeMonth(days: WorkingCalendarDay[]) {
  let weekends = 0;
  let holidays = 0;
  let optional = 0;
  let saturdaysWorking = 0;
  let breaks = 0;
  let exams = 0;
  let sundays = 0;

  for (const day of days) {
    const visual = resolveDayVisual(day);
    if (visual.status === 'saturday-working') saturdaysWorking += 1;
    if (visual.status === 'weekend') weekends += 1;
    if (visual.status === 'holiday') holidays += 1;
    if (visual.status === 'optional') optional += 1;
    if (visual.status === 'break') breaks += 1;
    if (visual.status === 'exam') exams += 1;
    if (day.dayOfWeek.toUpperCase() === 'SUN') sundays += 1;
  }

  return {
    workingDays: days.filter((d) => d.isWorkingDay).length,
    weekends,
    publicHolidays: holidays,
    optionalHolidays: optional,
    saturdaysWorking,
    breaks,
    exams,
    sundays,
  };
}

export const STATUS_STYLES: Record<
  Exclude<WorkingDayStatus, 'empty'>,
  { dot: string; badge: string; card: string }
> = {
  working: {
    dot: 'bg-[#22C55E]',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    card: 'hover:ring-emerald-200/80',
  },
  weekend: {
    dot: 'bg-[#F43F5E]',
    badge: 'bg-rose-50 text-rose-700 ring-rose-100',
    card: 'bg-rose-50/40 hover:ring-rose-200/80',
  },
  'saturday-working': {
    dot: 'bg-[#F59E0B]',
    badge: 'bg-amber-50 text-amber-800 ring-amber-100',
    card: 'hover:ring-amber-200/80',
  },
  holiday: {
    dot: 'bg-[#EF4444]',
    badge: 'bg-rose-100 text-rose-800 ring-rose-200',
    card: 'bg-rose-50/70 hover:ring-rose-200/80',
  },
  break: {
    dot: 'bg-[#64748B]',
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    card: 'bg-slate-50 hover:ring-slate-200/80',
  },
  exam: {
    dot: 'bg-[#EA580C]',
    badge: 'bg-orange-50 text-orange-800 ring-orange-100',
    card: 'bg-orange-50/50 hover:ring-orange-200/80',
  },
  optional: {
    dot: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700 ring-violet-100',
    card: 'hover:ring-violet-200/80',
  },
};

export function eventChipClass(type: string): string {
  const t = type.toUpperCase();
  if (/HOLIDAY|WEEKEND|WEATHER|CLOSURE/.test(t)) {
    return 'bg-amber-100 text-amber-950 border-amber-200';
  }
  if (/BREAK|TEACHING_BREAK/.test(t)) {
    return 'bg-slate-100 text-slate-800 border-slate-200';
  }
  if (/EXAM|ASSESSMENT|VIVA|RESULT|HALL_TICKET/.test(t)) {
    return 'bg-orange-50 text-orange-950 border-orange-200';
  }
  if (/MEETING|IQAC|STAFF/.test(t)) {
    return 'bg-violet-50 text-violet-950 border-violet-200';
  }
  if (/SPORTS|CULTURAL|PRAYER|MASS|CONVOCATION/.test(t)) {
    return 'bg-sky-50 text-sky-950 border-sky-200';
  }
  return 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]';
}
