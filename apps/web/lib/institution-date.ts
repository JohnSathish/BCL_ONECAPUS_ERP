/** Institution calendar date (Don Bosco College, IST). Avoid UTC `toISOString()` for "today". */
export const INSTITUTION_TIMEZONE = 'Asia/Kolkata';

export function institutionDateKey(date = new Date(), timeZone = INSTITUTION_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
