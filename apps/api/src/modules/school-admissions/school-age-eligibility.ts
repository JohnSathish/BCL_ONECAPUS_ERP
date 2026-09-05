export type AgeParts = { years: number; months: number; days: number };

export const TPS_KG_2027_CENSUS_DATE = '2027-01-01';
export const TPS_KG_2027_MIN_AGE_YEARS = 5;
export const TPS_KG_2027_MAX_AGE_YEARS_EXCLUSIVE = 6;

export const SCHOOL_AGE_INELIGIBLE_MESSAGE =
  'The child must be at least 5 years old but less than 6 years old as on 01 January 2027. Eligible date of birth: 02 January 2021 to 01 January 2022.';

const UTC_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function parseDateOnly(value: string): Date | null {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatUtcDateIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatUtcDateLong(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day} ${UTC_MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function compareUtcDateOnly(a: Date, b: Date): number {
  const left = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const right = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return left === right ? 0 : left < right ? -1 : 1;
}

export function addUtcCalendarDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
    ),
  );
}

export function eligibleDobRangeUtc(
  census: Date,
  minAgeYears = TPS_KG_2027_MIN_AGE_YEARS,
  maxAgeYearsExclusive = TPS_KG_2027_MAX_AGE_YEARS_EXCLUSIVE,
): { minDob: Date; maxDob: Date } {
  const maxDob = new Date(
    Date.UTC(
      census.getUTCFullYear() - minAgeYears,
      census.getUTCMonth(),
      census.getUTCDate(),
    ),
  );
  const sixthBirthday = new Date(
    Date.UTC(
      census.getUTCFullYear() - maxAgeYearsExclusive,
      census.getUTCMonth(),
      census.getUTCDate(),
    ),
  );
  return { minDob: addUtcCalendarDays(sixthBirthday, 1), maxDob };
}

export function eligibleDobIsoRange(
  censusDate = TPS_KG_2027_CENSUS_DATE,
  minAgeYears = TPS_KG_2027_MIN_AGE_YEARS,
  maxAgeYearsExclusive = TPS_KG_2027_MAX_AGE_YEARS_EXCLUSIVE,
): { minDob: string; maxDob: string } | null {
  const census = parseDateOnly(censusDate ?? TPS_KG_2027_CENSUS_DATE);
  if (!census) return null;
  const { minDob, maxDob } = eligibleDobRangeUtc(
    census,
    minAgeYears ?? TPS_KG_2027_MIN_AGE_YEARS,
    maxAgeYearsExclusive ?? TPS_KG_2027_MAX_AGE_YEARS_EXCLUSIVE,
  );
  return { minDob: formatUtcDateIso(minDob), maxDob: formatUtcDateIso(maxDob) };
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function ageAsOf(dob: Date, asOf: Date): AgeParts {
  let years = asOf.getUTCFullYear() - dob.getUTCFullYear();
  let months = asOf.getUTCMonth() - dob.getUTCMonth();
  let days = asOf.getUTCDate() - dob.getUTCDate();

  if (days < 0) {
    months -= 1;
    const prevMonthIndex = (asOf.getUTCMonth() + 11) % 12;
    const prevMonthYear =
      asOf.getUTCMonth() === 0
        ? asOf.getUTCFullYear() - 1
        : asOf.getUTCFullYear();
    days += daysInUtcMonth(prevMonthYear, prevMonthIndex);
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

export function schoolAgeIneligibleMessage(
  censusDate = TPS_KG_2027_CENSUS_DATE,
  minAgeYears = TPS_KG_2027_MIN_AGE_YEARS,
  maxAgeYearsExclusive = TPS_KG_2027_MAX_AGE_YEARS_EXCLUSIVE,
): string {
  const census = parseDateOnly(censusDate);
  if (!census) return SCHOOL_AGE_INELIGIBLE_MESSAGE;
  const { minDob, maxDob } = eligibleDobRangeUtc(
    census,
    minAgeYears,
    maxAgeYearsExclusive,
  );
  return `The child must be at least ${minAgeYears} years old but less than ${maxAgeYearsExclusive} years old as on ${formatUtcDateLong(census)}. Eligible date of birth: ${formatUtcDateLong(minDob)} to ${formatUtcDateLong(maxDob)}.`;
}

export function evaluateSchoolAgeEligibility(
  dateOfBirth: string,
  censusDate: string,
  minAgeYears?: number,
  maxAgeYearsExclusive?: number,
): {
  age: AgeParts | null;
  eligible: boolean;
  message: string;
  minDob?: string;
  maxDob?: string;
} {
  const minYears = minAgeYears ?? TPS_KG_2027_MIN_AGE_YEARS;
  const maxYearsExclusive =
    maxAgeYearsExclusive ?? TPS_KG_2027_MAX_AGE_YEARS_EXCLUSIVE;
  const dob = parseDateOnly(dateOfBirth);
  const census = parseDateOnly(censusDate);
  if (!dob || !census) {
    return {
      age: null,
      eligible: false,
      message: 'Enter a valid date of birth.',
    };
  }
  const { minDob, maxDob } = eligibleDobRangeUtc(
    census,
    minYears,
    maxYearsExclusive,
  );
  const age = ageAsOf(dob, census);
  const inRange =
    compareUtcDateOnly(dob, minDob) >= 0 &&
    compareUtcDateOnly(dob, maxDob) <= 0;
  const minIso = formatUtcDateIso(minDob);
  const maxIso = formatUtcDateIso(maxDob);
  if (!inRange) {
    return {
      age,
      eligible: false,
      minDob: minIso,
      maxDob: maxIso,
      message: schoolAgeIneligibleMessage(
        censusDate,
        minYears,
        maxYearsExclusive,
      ),
    };
  }
  return {
    age,
    eligible: true,
    minDob: minIso,
    maxDob: maxIso,
    message: `Age as of ${formatUtcDateLong(census)}: ${age.years} years, ${age.months} months, ${age.days} days.`,
  };
}
