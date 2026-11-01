/** Don Bosco College, Tura — casual leave from the service rules. */
export const CASUAL_LEAVE_ANNUAL_DAYS = 15;
export const CASUAL_LEAVE_MAX_AT_A_TIME = 3;

const HIDDEN_CODES = new Set([
  'SL',
  'SICK',
  'ML',
  'MEDICAL',
  'EL',
  'EARNED',
  'MAT',
  'MATERNITY',
  'PAT',
  'PATERNITY',
  'PL',
]);

export const HOLIDAY_EVENT_TYPES = [
  'NATIONAL_HOLIDAY',
  'STATE_HOLIDAY',
  'COLLEGE_HOLIDAY',
  'RESTRICTED_HOLIDAY',
  'EMERGENCY_HOLIDAY',
  'WEATHER_CLOSURE',
] as const;

export function utcDateKey(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const [year, month, day] = utcDateKey(key).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function eachDate(from: string, to: string): string[] {
  const start = utcDateKey(from);
  const end = utcDateKey(to);
  if (end < start) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
    if (dates.length > 400) break;
  }
  return dates;
}

export function isSunday(key: string): boolean {
  const [year, month, day] = utcDateKey(key).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

export function isCasualLeaveType(type: {
  code?: string | null;
  name?: string | null;
}) {
  const code = (type.code ?? '').trim().toUpperCase();
  if (code === 'CL' || code === 'CASUAL') return true;
  return (type.name ?? '').trim().toUpperCase() === 'CASUAL LEAVE';
}

export function isPrivilegedLeaveType(type: {
  code?: string | null;
  name?: string | null;
}) {
  const code = (type.code ?? '').trim().toUpperCase();
  if (['MAT', 'PAT', 'MATERNITY', 'PATERNITY', 'PL'].includes(code))
    return true;
  const name = (type.name ?? '').toUpperCase();
  return name.includes('MATERNITY') || name.includes('PATERNITY');
}

/** Medical, earned, maternity, and paternity are not staff self-service options. */
export function isHiddenFromStaffLeave(type: {
  code?: string | null;
  name?: string | null;
}) {
  const code = (type.code ?? '').trim().toUpperCase();
  if (HIDDEN_CODES.has(code) || isPrivilegedLeaveType(type)) return true;
  const name = (type.name ?? '').toUpperCase();
  return (
    name.includes('MEDICAL') || name.includes('SICK') || name.includes('EARNED')
  );
}

export function staffCanApplyForLeave(type: {
  code?: string | null;
  name?: string | null;
}) {
  return !isHiddenFromStaffLeave(type);
}

export function chargeableDates(
  dates: readonly string[],
  holidays: ReadonlySet<string>,
) {
  return dates.filter((day) => !isSunday(day) && !holidays.has(day));
}

function gapIsOnlyNonWorking(
  left: string,
  right: string,
  holidays: ReadonlySet<string>,
) {
  for (
    let cursor = addDays(left, 1);
    cursor < right;
    cursor = addDays(cursor, 1)
  ) {
    if (!isSunday(cursor) && !holidays.has(cursor)) return false;
  }
  return true;
}

/** Sundays and holidays are skipped in the count, but they do not break the spell. */
export function connectedChargeableSpell(
  anchor: readonly string[],
  others: readonly string[],
  holidays: ReadonlySet<string>,
) {
  const all = [...new Set([...anchor, ...others])].sort();
  if (!all.length) return [];
  const groups: string[][] = [[all[0]]];
  for (let index = 1; index < all.length; index += 1) {
    const current = groups[groups.length - 1];
    const last = current[current.length - 1];
    if (gapIsOnlyNonWorking(last, all[index], holidays))
      current.push(all[index]);
    else groups.push([all[index]]);
  }
  const anchorSet = new Set(anchor);
  return groups.find((group) => group.some((day) => anchorSet.has(day))) ?? [];
}

function touchesAcrossNonWorking(
  from: string,
  to: string,
  blocked: ReadonlySet<string>,
  holidays: ReadonlySet<string>,
) {
  const span = eachDate(from, to);
  if (span.some((day) => blocked.has(day))) return true;

  const walk = (start: string, step: number) => {
    let cursor = start;
    for (let guard = 0; guard < 21; guard += 1) {
      if (blocked.has(cursor)) return true;
      if (!isSunday(cursor) && !holidays.has(cursor)) return false;
      cursor = addDays(cursor, step);
    }
    return false;
  };

  return walk(addDays(from, -1), -1) || walk(addDays(to, 1), 1);
}

export function evaluateCasualLeave(input: {
  from: string;
  to: string;
  holidays: ReadonlySet<string>;
  vacations: ReadonlySet<string>;
  existingCasualDates: readonly string[];
  otherLeaveDates: readonly string[];
  allocated: number;
  carried: number;
  used: number;
  pendingDates: readonly string[];
}): { ok: true; totalDays: number } | { ok: false; message: string } {
  const from = utcDateKey(input.from);
  const to = utcDateKey(input.to);
  if (to < from) {
    return { ok: false, message: 'To date must be on or after from date.' };
  }
  if (from.slice(0, 4) !== to.slice(0, 4)) {
    return {
      ok: false,
      message: 'Casual leave must fall within a single calendar year.',
    };
  }

  const span = eachDate(from, to);
  if (touchesAcrossNonWorking(from, to, input.vacations, input.holidays)) {
    return {
      ok: false,
      message: 'Casual leave cannot be prefixed or suffixed to a vacation.',
    };
  }

  if (
    touchesAcrossNonWorking(
      from,
      to,
      new Set(input.otherLeaveDates),
      input.holidays,
    )
  ) {
    return {
      ok: false,
      message:
        'Casual leave cannot be prefixed or suffixed to any other kind of leave.',
    };
  }

  const requested = chargeableDates(span, input.holidays);
  if (!requested.length) {
    return {
      ok: false,
      message:
        'Casual leave must include at least one working day. Sundays and holidays are not counted.',
    };
  }

  const existing = new Set(input.existingCasualDates);
  if (requested.some((day) => existing.has(day))) {
    return {
      ok: false,
      message:
        'These dates are already covered by another casual leave request.',
    };
  }

  const spell = connectedChargeableSpell(
    requested,
    input.existingCasualDates,
    input.holidays,
  );
  if (spell.length > CASUAL_LEAVE_MAX_AT_A_TIME) {
    return {
      ok: false,
      message:
        'Casual leave cannot be more than 3 working days at a time. Sundays and holidays are not counted, and they do not start a new spell.',
    };
  }

  const pending = new Set(input.pendingDates);
  const available = input.allocated + input.carried - input.used - pending.size;
  if (requested.length > available) {
    return {
      ok: false,
      message:
        available <= 0
          ? 'Casual leave balance for this calendar year is exhausted.'
          : `Casual leave balance is not enough. Remaining: ${available} day(s).`,
    };
  }

  return { ok: true, totalDays: requested.length };
}
