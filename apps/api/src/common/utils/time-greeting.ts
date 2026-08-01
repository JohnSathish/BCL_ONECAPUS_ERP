/** Institution default — Don Bosco College, Meghalaya (IST). */
export const DEFAULT_INSTITUTION_TIMEZONE = 'Asia/Kolkata';

export function getZonedHour(
  date = new Date(),
  timeZone = DEFAULT_INSTITUTION_TIMEZONE,
): number {
  const hourPart = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    hour12: false,
    timeZone,
  })
    .formatToParts(date)
    .find((part) => part.type === 'hour');
  return Number(hourPart?.value ?? date.getUTCHours());
}

/** Calendar date (YYYY-MM-DD) in the institution timezone. */
export function getZonedDateKey(
  date = new Date(),
  timeZone = DEFAULT_INSTITUTION_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * JS weekday (0=Sun … 6=Sat) for the institution calendar day.
 * Prefer this over `date.getDay()` on UTC servers.
 */
export function getZonedWeekday(
  date = new Date(),
  timeZone = DEFAULT_INSTITUTION_TIMEZONE,
): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? date.getDay();
}

/** Midnight UTC for a YYYY-MM-DD calendar key (date-only columns). */
export function dateKeyToUtcMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function formatInstitutionDateLabel(
  dateKeyOrDate: string | Date,
  timeZone = DEFAULT_INSTITUTION_TIMEZONE,
): string {
  const date =
    typeof dateKeyOrDate === 'string'
      ? dateKeyToUtcMidnight(dateKeyOrDate)
      : dateKeyOrDate;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getDayPartGreeting(
  date = new Date(),
  timeZone = DEFAULT_INSTITUTION_TIMEZONE,
): string {
  const hour = getZonedHour(date, timeZone);
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
