import type { DayVisual, WorkingCalendarDay, WorkingDayStatus } from './types';

const HOLIDAY_RE = /holiday|break|non-working|result|admission|exam|bridge|staff event/i;
const OPTIONAL_RE = /optional|restricted/i;
const WEEKEND_RE = /weekend/i;
const WORKING_SAT_RE = /working on saturday|saturday working|holiday class|compensatory|makeup/i;

/** ERP joins titles with "; " — CMS handbook uses newlines. Accept both. */
export function parseDayEventTitles(description: string): string[] {
  return description
    .split(/\n+|;\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function resolveDayVisual(day: WorkingCalendarDay): DayVisual {
  const statusLabel = day.statusLabel.trim();
  const events = parseDayEventTitles(day.description);
  const hasEvents = events.length > 0;

  const isSunday = day.dayOfWeek.toUpperCase() === 'SUN';
  const isSaturday = day.dayOfWeek.toUpperCase() === 'SAT';

  let status: WorkingDayStatus;
  let label: string;

  // ERP days with events use statusLabel for event type (e.g. "Institutional Event"), not day kind.
  if (hasEvents && day.isWorkingDay) {
    status = isSaturday ? 'saturday-working' : 'working';
    label = 'Working';
  } else if (OPTIONAL_RE.test(statusLabel)) {
    status = 'optional';
    label = 'Optional';
  } else if (WEEKEND_RE.test(statusLabel) || (isSunday && !day.isWorkingDay && !statusLabel)) {
    status = 'weekend';
    label = 'Weekend';
  } else if (
    (isSaturday && day.isWorkingDay) ||
    WORKING_SAT_RE.test(statusLabel) ||
    (isSaturday && /working/i.test(statusLabel))
  ) {
    status = 'saturday-working';
    label = 'Working';
  } else if (
    HOLIDAY_RE.test(statusLabel) &&
    !/holiday class|compensatory|makeup/i.test(statusLabel)
  ) {
    status = 'holiday';
    label = 'Holiday';
  } else if (day.isWorkingDay) {
    status = isSaturday ? 'saturday-working' : 'working';
    label = 'Working';
  } else if (isSunday || isSaturday) {
    status = 'weekend';
    label = 'Weekend';
  } else {
    status = 'holiday';
    label = statusLabel || 'Holiday';
  }

  return {
    status,
    label,
    title: hasEvents ? events[0] : statusLabel || undefined,
    events,
  };
}

export function summarizeMonth(days: WorkingCalendarDay[]) {
  let weekends = 0;
  let holidays = 0;
  let optional = 0;
  let saturdaysWorking = 0;
  let sundays = 0;

  for (const day of days) {
    const visual = resolveDayVisual(day);
    if (visual.status === 'saturday-working') saturdaysWorking += 1;
    if (visual.status === 'weekend') weekends += 1;
    if (visual.status === 'holiday') holidays += 1;
    if (visual.status === 'optional') optional += 1;
    if (day.dayOfWeek.toUpperCase() === 'SUN') sundays += 1;
  }

  return {
    workingDays: days.filter((d) => d.isWorkingDay).length,
    weekends,
    publicHolidays: holidays,
    optionalHolidays: optional,
    saturdaysWorking,
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
    dot: 'bg-[#2563EB]',
    badge: 'bg-blue-50 text-blue-700 ring-blue-100',
    card: 'hover:ring-blue-200/80',
  },
  'saturday-working': {
    dot: 'bg-[#F59E0B]',
    badge: 'bg-amber-50 text-amber-800 ring-amber-100',
    card: 'hover:ring-amber-200/80',
  },
  holiday: {
    dot: 'bg-[#EF4444]',
    badge: 'bg-rose-50 text-rose-700 ring-rose-100',
    card: 'hover:ring-rose-200/80',
  },
  optional: {
    dot: 'bg-violet-500',
    badge: 'bg-violet-50 text-violet-700 ring-violet-100',
    card: 'hover:ring-violet-200/80',
  },
};
