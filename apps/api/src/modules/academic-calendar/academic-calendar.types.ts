export const ACADEMIC_CALENDAR_EVENT_TYPES = [
  'NATIONAL_HOLIDAY',
  'STATE_HOLIDAY',
  'COLLEGE_HOLIDAY',
  'RESTRICTED_HOLIDAY',
  'EMERGENCY_HOLIDAY',
  'WEATHER_CLOSURE',
  'WEEKEND',
  'HOLIDAY_CLASS',
  'COMPENSATORY_CLASS',
  'MAKEUP_CLASS',
  'ORIENTATION',
  'BRIDGE_COURSE',
  'SEMESTER_START',
  'SEMESTER_END',
  'TEACHING_BREAK',
  'INTERNAL_ASSESSMENT',
  'MID_SEM_EXAM',
  'END_SEM_EXAM',
  'PRACTICAL_EXAM',
  'VIVA',
  'HALL_TICKET',
  'RESULT',
  'FEE_DUE',
  'FEE_FINE_START',
  'ADMISSION_WINDOW',
  'INSTITUTIONAL_EVENT',
  'STAFF_EVENT',
  'OTHER',
] as const;

export type AcademicCalendarEventType =
  (typeof ACADEMIC_CALENDAR_EVENT_TYPES)[number];

export type DayKind =
  | 'WORKING'
  | 'WEEKEND'
  | 'HOLIDAY'
  | 'HOLIDAY_CLASS'
  | 'COMPENSATORY'
  | 'EXAM'
  | 'BREAK'
  | 'NON_WORKING';

export type ResolvedDay = {
  date: string;
  isWorkingDay: boolean;
  dayKind: DayKind;
  events: Array<{ id: string; type: string; title: string }>;
  createsAttendanceSession: boolean;
};

const HOLIDAY_TYPES = new Set<string>([
  'NATIONAL_HOLIDAY',
  'STATE_HOLIDAY',
  'COLLEGE_HOLIDAY',
  'RESTRICTED_HOLIDAY',
  'EMERGENCY_HOLIDAY',
  'WEATHER_CLOSURE',
]);

const CLASS_TYPES = new Set<string>([
  'HOLIDAY_CLASS',
  'COMPENSATORY_CLASS',
  'MAKEUP_CLASS',
]);

const EXAM_TYPES = new Set<string>([
  'INTERNAL_ASSESSMENT',
  'MID_SEM_EXAM',
  'END_SEM_EXAM',
  'PRACTICAL_EXAM',
  'VIVA',
]);

const BREAK_TYPES = new Set<string>(['TEACHING_BREAK', 'SEMESTER_END']);

/** Type defaults when event.isWorkingDay is null. */
export function defaultIsWorkingDayForType(type: string): boolean {
  if (CLASS_TYPES.has(type)) return true;
  if (HOLIDAY_TYPES.has(type)) return false;
  if (type === 'WEEKEND') return false;
  if (BREAK_TYPES.has(type)) return false;
  if (EXAM_TYPES.has(type)) return true; // exam days still count unless overridden
  return true;
}

export function defaultCreatesAttendanceSession(type: string): boolean {
  return CLASS_TYPES.has(type);
}

export function dayKindFromEvents(
  isWeekend: boolean,
  events: Array<{ type: string; isWorkingDay: boolean | null }>,
  isWorkingDay: boolean,
): DayKind {
  if (events.some((e) => CLASS_TYPES.has(e.type) && (e.isWorkingDay ?? true))) {
    if (events.some((e) => e.type === 'COMPENSATORY_CLASS'))
      return 'COMPENSATORY';
    return 'HOLIDAY_CLASS';
  }
  if (events.some((e) => HOLIDAY_TYPES.has(e.type))) return 'HOLIDAY';
  if (events.some((e) => EXAM_TYPES.has(e.type))) return 'EXAM';
  if (events.some((e) => BREAK_TYPES.has(e.type))) return 'BREAK';
  if (isWeekend && !isWorkingDay) return 'WEEKEND';
  if (!isWorkingDay) return 'NON_WORKING';
  return 'WORKING';
}

export function toDateOnlyIso(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function parseDateOnly(iso: string): Date {
  const raw = iso.slice(0, 10);
  const [y, m, d] = raw.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function statusLabelForType(type: string): string {
  switch (type) {
    case 'NATIONAL_HOLIDAY':
    case 'STATE_HOLIDAY':
    case 'COLLEGE_HOLIDAY':
    case 'RESTRICTED_HOLIDAY':
    case 'EMERGENCY_HOLIDAY':
    case 'WEATHER_CLOSURE':
      return 'Holiday';
    case 'HOLIDAY_CLASS':
      return 'Holiday Class';
    case 'COMPENSATORY_CLASS':
      return 'Compensatory';
    case 'MAKEUP_CLASS':
      return 'Makeup Class';
    case 'TEACHING_BREAK':
      return 'Break';
    case 'INTERNAL_ASSESSMENT':
    case 'MID_SEM_EXAM':
    case 'END_SEM_EXAM':
    case 'PRACTICAL_EXAM':
    case 'VIVA':
      return 'Exam';
    case 'ORIENTATION':
      return 'Orientation';
    default:
      return type
        .split('_')
        .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
        .join(' ');
  }
}

export function mapStaffHolidayType(
  holidayType: string | null | undefined,
): AcademicCalendarEventType {
  const t = (holidayType ?? '').toUpperCase();
  if (t.includes('NATIONAL')) return 'NATIONAL_HOLIDAY';
  if (t.includes('STATE')) return 'STATE_HOLIDAY';
  if (t.includes('RESTRICT')) return 'RESTRICTED_HOLIDAY';
  if (t.includes('EMERGENCY')) return 'EMERGENCY_HOLIDAY';
  return 'COLLEGE_HOLIDAY';
}
