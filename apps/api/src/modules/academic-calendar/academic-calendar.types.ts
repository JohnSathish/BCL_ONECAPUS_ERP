export const ACADEMIC_CALENDAR_EVENT_TYPES = [
  'WORKING_DAY',
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
  'SEMINAR',
  'WORKSHOP',
  'CONFERENCE',
  'IQAC_ACTIVITY',
  'STAFF_MEETING',
  'DEPARTMENT_MEETING',
  'SPORTS',
  'CULTURAL',
  'CONVOCATION',
  'PRAYER',
  'MASS',
  'LEAVE',
  'MAINTENANCE',
  'INSTITUTIONAL_EVENT',
  'STAFF_EVENT',
  'CUSTOM',
  'OTHER',
] as const;

export type AcademicCalendarEventType =
  (typeof ACADEMIC_CALENDAR_EVENT_TYPES)[number];

/** Default hex colors for calendar badges (legend + UI). */
export const ACADEMIC_CALENDAR_TYPE_COLORS: Record<string, string> = {
  WORKING_DAY: '#16a34a',
  NATIONAL_HOLIDAY: '#dc2626',
  STATE_HOLIDAY: '#ef4444',
  COLLEGE_HOLIDAY: '#f87171',
  RESTRICTED_HOLIDAY: '#fb7185',
  EMERGENCY_HOLIDAY: '#b91c1c',
  WEATHER_CLOSURE: '#e11d48',
  WEEKEND: '#fca5a5',
  HOLIDAY_CLASS: '#22c55e',
  COMPENSATORY_CLASS: '#4ade80',
  MAKEUP_CLASS: '#86efac',
  ORIENTATION: '#0ea5e9',
  BRIDGE_COURSE: '#38bdf8',
  SEMESTER_START: '#2563eb',
  SEMESTER_END: '#1d4ed8',
  TEACHING_BREAK: '#64748b',
  INTERNAL_ASSESSMENT: '#f97316',
  MID_SEM_EXAM: '#ea580c',
  END_SEM_EXAM: '#c2410c',
  PRACTICAL_EXAM: '#fb923c',
  VIVA: '#fdba74',
  HALL_TICKET: '#f59e0b',
  RESULT: '#d97706',
  FEE_DUE: '#a855f7',
  FEE_FINE_START: '#9333ea',
  ADMISSION_WINDOW: '#06b6d4',
  SEMINAR: '#8b5cf6',
  WORKSHOP: '#7c3aed',
  CONFERENCE: '#6d28d9',
  IQAC_ACTIVITY: '#db2777',
  STAFF_MEETING: '#7c3aed',
  DEPARTMENT_MEETING: '#a78bfa',
  SPORTS: '#2563eb',
  CULTURAL: '#ec4899',
  CONVOCATION: '#be185d',
  PRAYER: '#0f766e',
  MASS: '#115e59',
  LEAVE: '#eab308',
  MAINTENANCE: '#78716c',
  INSTITUTIONAL_EVENT: '#3b82f6',
  STAFF_EVENT: '#6366f1',
  CUSTOM: '#64748b',
  OTHER: '#94a3b8',
};

export function defaultColorForType(type: string): string {
  return ACADEMIC_CALENDAR_TYPE_COLORS[type] ?? '#64748b';
}

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

export type CalendarVisibilityFlags = {
  students?: boolean;
  staff?: boolean;
  parents?: boolean;
  public?: boolean;
};

export type CalendarAttachmentMeta = {
  url: string;
  name: string;
  mimeType?: string;
  size?: number;
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

export const EXAM_TYPES = new Set<string>([
  'INTERNAL_ASSESSMENT',
  'MID_SEM_EXAM',
  'END_SEM_EXAM',
  'PRACTICAL_EXAM',
  'VIVA',
  'HALL_TICKET',
  'RESULT',
]);

export const IQAC_TYPES = new Set<string>([
  'IQAC_ACTIVITY',
  'WORKSHOP',
  'CONFERENCE',
]);

export const MEETING_TYPES = new Set<string>([
  'STAFF_MEETING',
  'DEPARTMENT_MEETING',
  'STAFF_EVENT',
]);

/** Routine / staff-only types omitted when falling back to unpublished-website PUBLIC events. */
export const WEBSITE_FALLBACK_EXCLUDED_TYPES = [
  'WORKING_DAY',
  'WEEKEND',
  'STAFF_MEETING',
  'DEPARTMENT_MEETING',
  'STAFF_EVENT',
  'LEAVE',
  'MAINTENANCE',
] as const;

const BREAK_TYPES = new Set<string>([
  'TEACHING_BREAK',
  'SEMESTER_END',
  'LEAVE',
]);

/** Types that flip Working Day Engine day kind when present. */
export function isDayKindAffectingType(type: string): boolean {
  return (
    HOLIDAY_TYPES.has(type) ||
    CLASS_TYPES.has(type) ||
    EXAM_TYPES.has(type) ||
    BREAK_TYPES.has(type) ||
    type === 'WEEKEND' ||
    type === 'WORKING_DAY'
  );
}

/** Type defaults when event.isWorkingDay is null. */
export function defaultIsWorkingDayForType(type: string): boolean {
  if (CLASS_TYPES.has(type)) return true;
  if (type === 'WORKING_DAY') return true;
  if (HOLIDAY_TYPES.has(type)) return false;
  if (type === 'WEEKEND') return false;
  if (BREAK_TYPES.has(type)) return false;
  if (EXAM_TYPES.has(type)) return true;
  // Informational events (seminar, sports, …) do not flip working day by default.
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
    case 'WORKING_DAY':
      return 'Working';
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
    case 'IQAC_ACTIVITY':
      return 'IQAC';
    case 'STAFF_MEETING':
    case 'DEPARTMENT_MEETING':
      return 'Meeting';
    case 'LEAVE':
      return 'Leave';
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

/** Filter group used by admin sidebar. */
export function filterGroupForType(type: string): string {
  if (HOLIDAY_TYPES.has(type) || type === 'WEEKEND') return 'holidays';
  if (type === 'WORKING_DAY' || CLASS_TYPES.has(type)) return 'workingDays';
  if (EXAM_TYPES.has(type)) return 'exams';
  if (MEETING_TYPES.has(type)) return 'meetings';
  if (type === 'SPORTS') return 'sports';
  if (type === 'ADMISSION_WINDOW') return 'admission';
  if (IQAC_TYPES.has(type)) return 'iqac';
  if (type === 'STAFF_EVENT' || type === 'LEAVE') return 'staffEvents';
  return 'studentEvents';
}
