/**
 * 2026 college roll numbers are per major department, not one Arts prefix.
 * Economics is EC26-01, Education is ED26-01, English is EN26-01, and so on.
 * The number starts at 01 inside that department.
 */
export const DEPARTMENT_ROLL_PREFIXES: ReadonlyArray<{
  names: readonly string[];
  prefix: string;
}> = [
  { names: ['economics'], prefix: 'EC' },
  { names: ['education'], prefix: 'ED' },
  { names: ['english'], prefix: 'EN' },
  { names: ['garo'], prefix: 'GA' },
  { names: ['geography'], prefix: 'GE' },
  { names: ['history'], prefix: 'HI' },
  { names: ['philosophy'], prefix: 'PHI' },
  { names: ['political science'], prefix: 'PS' },
  { names: ['sociology'], prefix: 'SO' },
  { names: ['commerce'], prefix: 'COM' },
  { names: ['botany'], prefix: 'BOT' },
  { names: ['chemistry'], prefix: 'CHE' },
  { names: ['mathematics', 'maths'], prefix: 'MAT' },
  { names: ['physics'], prefix: 'PHY' },
  { names: ['zoology'], prefix: 'ZOO' },
];

/** Department rolls are EC26-01, not EC26-001. Numbers above 99 stay as EC26-128. */
export const DEPARTMENT_ROLL_SEQUENCE_LENGTH = 2;

export function normalizeDepartmentLabel(value?: string | null) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function prefixForDepartment(
  name?: string | null,
  code?: string | null,
): string | null {
  const labels = [
    normalizeDepartmentLabel(name),
    normalizeDepartmentLabel(code),
  ].filter(Boolean);
  for (const row of DEPARTMENT_ROLL_PREFIXES) {
    if (row.names.some((label) => labels.includes(label))) return row.prefix;
  }
  const codeKey = (code ?? '').trim().toUpperCase();
  if (DEPARTMENT_ROLL_PREFIXES.some((row) => row.prefix === codeKey))
    return codeKey;
  return null;
}

export function prefixForStreamCode(code?: string | null): string | null {
  return prefixForDepartment(null, (code ?? '').replace(/_/g, ' '));
}

export type ShiftBandName = 'day' | 'morning';

export type RollBand = {
  start: number;
  end: number;
  next: number;
};

/** Day Shift is 01–100. Morning Shift is 101 and above. A full Day series pushes Morning up. */
export function suggestDepartmentShiftBands(
  dayHighest: number,
  morningHighest: number,
): { day: RollBand; morning: RollBand; note: string | null } {
  const dayStart = 1;
  const dayEnd = dayHighest > 100 ? Math.max(150, dayHighest) : 100;
  const dayNext = dayHighest > 0 ? dayHighest + 1 : dayStart;
  let morningStart = 101;
  let morningEnd = Math.max(200, morningHighest);
  let note: string | null = null;
  if (dayEnd >= morningStart) {
    morningStart = dayEnd + 1;
    morningEnd = Math.max(morningStart + 99, morningHighest);
    note = `Day Shift already uses numbers through ${String(dayHighest).padStart(2, '0')}, so Morning Shift starts at ${String(morningStart).padStart(2, '0')}.`;
  }
  const morningNext =
    morningHighest >= morningStart ? morningHighest + 1 : morningStart;
  return {
    day: { start: dayStart, end: dayEnd, next: dayNext },
    morning: { start: morningStart, end: morningEnd, next: morningNext },
    note,
  };
}

export function shiftBandFor(
  code?: string | null,
  name?: string | null,
): ShiftBandName | null {
  const text = `${code ?? ''} ${name ?? ''}`.toUpperCase();
  if (text.includes('MORNING')) return 'morning';
  if (text.includes('DAY')) return 'day';
  return null;
}

/** Next free number inside one shift band. Skips numbers already used in the department. */
export function nextFreeInBand(
  start: number,
  end: number,
  used: Iterable<number>,
  highestInBand: number,
): number | null {
  const taken = new Set(used);
  let candidate = highestInBand >= start ? highestInBand + 1 : start;
  if (candidate < start) candidate = start;
  while (candidate <= end && taken.has(candidate)) candidate += 1;
  if (candidate < start || candidate > end) return null;
  return candidate;
}
