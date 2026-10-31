import {
  parseDateOnly,
  toDateOnlyIso,
} from '../../academic-calendar/academic-calendar.types';

/** College library dates follow Asia/Kolkata. The calendar stores date-only values. */
export const LIBRARY_COLLEGE_TIMEZONE = 'Asia/Kolkata';

export type LoanDayRules = {
  excludeWeekends: boolean;
  excludeHolidays: boolean;
  weekendDays: number[];
};

export type HolidayDay = {
  dayKind: string;
  isWorkingDay: boolean;
};

const HOLIDAY_KINDS = new Set(['HOLIDAY', 'BREAK', 'NON_WORKING']);

export function collegeDateIso(
  value: Date,
  timeZone = LIBRARY_COLLEGE_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

/** Last instant of a college calendar date, so the due date itself is not overdue. */
export function endOfCollegeDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 18, 29, 59, 999));
}

export function addCalendarDays(iso: string, days: number): string {
  return toDateOnlyIso(
    new Date(parseDateOnly(iso).getTime() + days * 86_400_000),
  );
}

/**
 * Count `workingDays` open days after `startIso`. The start date is not day one.
 * A date that is both a weekend and a holiday is closed once.
 */
export function addWorkingDays(
  startIso: string,
  workingDays: number,
  closed: (iso: string) => boolean,
  maxScan = 800,
): string {
  if (workingDays < 1) return startIso.slice(0, 10);
  let cursor = parseDateOnly(startIso);
  let counted = 0;
  let scanned = 0;
  while (counted < workingDays) {
    if (scanned >= maxScan) {
      throw new Error('LOAN_WINDOW');
    }
    cursor = new Date(cursor.getTime() + 86_400_000);
    scanned += 1;
    const iso = toDateOnlyIso(cursor);
    if (!closed(iso)) counted += 1;
  }
  return toDateOnlyIso(cursor);
}

/**
 * Working days strictly after the due date through the return date, minus grace.
 * The due date is not an overdue day. A closed day is never an overdue day.
 */
export function overdueWorkingDays(
  dueIso: string,
  asOfIso: string,
  graceWorkingDays: number,
  closed: (iso: string) => boolean,
): number {
  const due = dueIso.slice(0, 10);
  const asOf = asOfIso.slice(0, 10);
  if (asOf <= due) return 0;
  let cursor = parseDateOnly(due);
  const end = parseDateOnly(asOf).getTime();
  let count = 0;
  while (cursor.getTime() < end) {
    cursor = new Date(cursor.getTime() + 86_400_000);
    if (!closed(toDateOnlyIso(cursor))) count += 1;
  }
  const grace = Number.isFinite(graceWorkingDays)
    ? Math.max(0, graceWorkingDays)
    : 0;
  return Math.max(0, count - grace);
}

export function fineFromOverdueDays(
  days: number,
  finePerDay: number,
  maxFine: number,
): number {
  const raw = Math.max(0, days) * Number(finePerDay);
  if (!Number.isFinite(raw)) return 0;
  const cap = Number(maxFine);
  if (!Number.isFinite(cap)) return raw;
  return Math.min(cap, raw);
}

/** Official college holidays, breaks, and other non-working calendar days. */
export function isHolidayClosure(day: HolidayDay | undefined): boolean {
  if (!day || day.isWorkingDay) return false;
  return HOLIDAY_KINDS.has(day.dayKind);
}

export function isLoanDayClosed(
  iso: string,
  rules: LoanDayRules,
  holidayDates: Set<string>,
): boolean {
  if (
    rules.excludeWeekends &&
    rules.weekendDays.includes(parseDateOnly(iso).getUTCDay())
  ) {
    return true;
  }
  return rules.excludeHolidays && holidayDates.has(iso.slice(0, 10));
}

export function renewalPeriodDays(
  roleDays: number,
  renewalWorkingDays: number | null,
): number {
  if (renewalWorkingDays != null && renewalWorkingDays > 0) {
    return Math.floor(renewalWorkingDays);
  }
  return roleDays;
}
