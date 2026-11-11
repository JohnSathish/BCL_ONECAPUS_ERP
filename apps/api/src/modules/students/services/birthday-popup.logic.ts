import {
  isLeapYear,
  istCalendar,
  monthDayPairs,
} from '../../communication/domain/birthday-calendar';

export const BIRTHDAY_POPUP_MESSAGE =
  'Wishing you a wonderful year ahead filled with happiness, good health, success and God\u2019s blessings.';

/** True when this date of birth falls on today's IST calendar day. 29 Feb is observed on 28 Feb in a non-leap year. */
export function birthdayOccursToday(
  dateOfBirth: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime())) return false;
  const month = dateOfBirth.getUTCMonth() + 1;
  const day = dateOfBirth.getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const today = istCalendar(now);
  return monthDayPairs(today, 1).some(
    (pair) => pair.month === month && pair.day === day,
  );
}

export function istBirthdayDateKey(now = new Date()): string {
  return istCalendar(now).dateKey;
}

export function observesLeapDayOn(now = new Date()): boolean {
  const today = istCalendar(now);
  return today.month === 2 && today.day === 28 && !isLeapYear(today.year);
}
