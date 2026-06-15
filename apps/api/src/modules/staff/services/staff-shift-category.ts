export const TEACHING_SHIFT_CATEGORIES = [
  'MORNING',
  'DAY',
  'BOTH',
  'EVENING',
  'WEEKEND',
  'ONLINE',
] as const;

export type TeachingShiftCategory = (typeof TEACHING_SHIFT_CATEGORIES)[number];

export const TEACHING_SHIFT_CATEGORY_LABELS: Record<
  TeachingShiftCategory,
  string
> = {
  MORNING: 'Morning Shift',
  DAY: 'Day Shift',
  BOTH: 'Both Shifts',
  EVENING: 'Evening Shift',
  WEEKEND: 'Weekend Shift',
  ONLINE: 'Online Shift',
};

export function isTeachingShiftCategory(
  value: string,
): value is TeachingShiftCategory {
  return (TEACHING_SHIFT_CATEGORIES as readonly string[]).includes(value);
}

export function teachingShiftCategoryLabel(
  category: string | null | undefined,
): string {
  if (!category || !isTeachingShiftCategory(category)) {
    return TEACHING_SHIFT_CATEGORY_LABELS.DAY;
  }
  return TEACHING_SHIFT_CATEGORY_LABELS[category];
}

export type TeachingShiftIds = {
  morningId?: string;
  dayId?: string;
  eveningId?: string;
};

export function resolveShiftIdsByCode(
  shifts: Array<{ id: string; code: string }>,
): TeachingShiftIds {
  const byCode = new Map(shifts.map((s) => [s.code.toUpperCase(), s.id]));
  return {
    morningId: byCode.get('MORNING'),
    dayId: byCode.get('DAY'),
    eveningId: byCode.get('EVENING'),
  };
}

export function shiftAssignmentForCategory(
  category: TeachingShiftCategory,
  ids: TeachingShiftIds,
): { primaryShiftId: string | null; additionalShiftIds: string[] } {
  switch (category) {
    case 'MORNING':
      return { primaryShiftId: ids.morningId ?? null, additionalShiftIds: [] };
    case 'DAY':
      return { primaryShiftId: ids.dayId ?? null, additionalShiftIds: [] };
    case 'BOTH':
      return {
        primaryShiftId: ids.dayId ?? null,
        additionalShiftIds: ids.morningId ? [ids.morningId] : [],
      };
    case 'EVENING':
      return { primaryShiftId: ids.eveningId ?? null, additionalShiftIds: [] };
    default:
      return { primaryShiftId: ids.dayId ?? null, additionalShiftIds: [] };
  }
}

export function inferTeachingShiftCategory(
  primaryShiftCode: string | null | undefined,
  additionalShiftCodes: string[],
): TeachingShiftCategory {
  const codes = new Set(
    [primaryShiftCode, ...additionalShiftCodes]
      .filter((code): code is string => Boolean(code))
      .map((code) => code.toUpperCase()),
  );
  const hasMorning = codes.has('MORNING');
  const hasDay = codes.has('DAY');
  if (hasMorning && hasDay) return 'BOTH';
  if (hasMorning) return 'MORNING';
  if (codes.has('EVENING')) return 'EVENING';
  return 'DAY';
}

export function normalizeStaffName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').toUpperCase();
}

export function namesLikelyMatch(a: string, b: string): boolean {
  const na = normalizeStaffName(a);
  const nb = normalizeStaffName(b);
  if (na === nb) return true;
  const wa = na.split(' ').filter((token) => token.length > 1);
  const wb = nb.split(' ').filter((token) => token.length > 1);
  if (wa.length < 2 || wb.length < 2) return false;
  const setB = new Set(wb);
  const overlap = wa.filter((token) => setB.has(token));
  return overlap.length >= Math.min(wa.length, wb.length);
}
