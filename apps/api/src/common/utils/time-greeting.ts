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

export function getDayPartGreeting(
  date = new Date(),
  timeZone = DEFAULT_INSTITUTION_TIMEZONE,
): string {
  const hour = getZonedHour(date, timeZone);
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
