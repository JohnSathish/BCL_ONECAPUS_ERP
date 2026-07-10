export type AttendanceStatusCode =
  | 'P'
  | 'A'
  | 'L'
  | 'OD'
  | 'ML'
  | 'SPORTS'
  | 'NSS'
  | 'NCC'
  | 'EXEMPTED';

export type AttendanceStatusMeta = {
  code: AttendanceStatusCode;
  label: string;
  shortLabel: string;
  /** Tailwind classes for the selected (filled) button */
  activeClass: string;
  /** Tailwind classes for unselected (outline) button */
  inactiveClass: string;
  /** Tailwind classes for summary chip */
  chipClass: string;
  group: 'present' | 'absent' | 'leave' | 'od' | 'other';
};

export const PRIMARY_ATTENDANCE_STATUSES: AttendanceStatusCode[] = ['P', 'A', 'L', 'OD'];

export const EXTENDED_ATTENDANCE_STATUSES: AttendanceStatusCode[] = [
  'ML',
  'SPORTS',
  'NSS',
  'NCC',
  'EXEMPTED',
];

export const ATTENDANCE_STATUS_MAP: Record<AttendanceStatusCode, AttendanceStatusMeta> = {
  P: {
    code: 'P',
    label: 'Present',
    shortLabel: 'P',
    activeClass: 'border-emerald-600 bg-emerald-600 text-white shadow-sm',
    inactiveClass:
      'border-emerald-300 bg-transparent text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40',
    chipClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    group: 'present',
  },
  A: {
    code: 'A',
    label: 'Absent',
    shortLabel: 'A',
    activeClass: 'border-rose-600 bg-rose-600 text-white shadow-sm',
    inactiveClass:
      'border-rose-300 bg-transparent text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40',
    chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    group: 'absent',
  },
  L: {
    code: 'L',
    label: 'Leave',
    shortLabel: 'L',
    activeClass: 'border-amber-600 bg-amber-500 text-white shadow-sm',
    inactiveClass:
      'border-amber-300 bg-transparent text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40',
    chipClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    group: 'leave',
  },
  OD: {
    code: 'OD',
    label: 'Official Duty',
    shortLabel: 'OD',
    activeClass: 'border-sky-600 bg-sky-600 text-white shadow-sm',
    inactiveClass:
      'border-sky-300 bg-transparent text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/40',
    chipClass: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
    group: 'od',
  },
  ML: {
    code: 'ML',
    label: 'Medical Leave',
    shortLabel: 'ML',
    activeClass: 'border-violet-600 bg-violet-600 text-white shadow-sm',
    inactiveClass:
      'border-violet-300 bg-transparent text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/40',
    chipClass: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
    group: 'leave',
  },
  SPORTS: {
    code: 'SPORTS',
    label: 'Sports',
    shortLabel: 'Sports',
    activeClass: 'border-orange-600 bg-orange-500 text-white shadow-sm',
    inactiveClass:
      'border-orange-300 bg-transparent text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/40',
    chipClass: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
    group: 'other',
  },
  NSS: {
    code: 'NSS',
    label: 'NSS',
    shortLabel: 'NSS',
    activeClass: 'border-cyan-600 bg-cyan-600 text-white shadow-sm',
    inactiveClass:
      'border-cyan-300 bg-transparent text-cyan-700 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-400 dark:hover:bg-cyan-950/40',
    chipClass: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200',
    group: 'other',
  },
  NCC: {
    code: 'NCC',
    label: 'NCC',
    shortLabel: 'NCC',
    activeClass: 'border-indigo-600 bg-indigo-600 text-white shadow-sm',
    inactiveClass:
      'border-indigo-300 bg-transparent text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950/40',
    chipClass: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200',
    group: 'other',
  },
  EXEMPTED: {
    code: 'EXEMPTED',
    label: 'Exempted',
    shortLabel: 'Exempt',
    activeClass: 'border-slate-500 bg-slate-500 text-white shadow-sm',
    inactiveClass:
      'border-slate-300 bg-transparent text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-900/40',
    chipClass: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    group: 'other',
  },
};

export function attendanceStatusLabel(code: string): string {
  const meta = ATTENDANCE_STATUS_MAP[code as AttendanceStatusCode];
  return meta?.label ?? code;
}

export function isExtendedAttendanceStatus(code: string): boolean {
  return EXTENDED_ATTENDANCE_STATUSES.includes(code as AttendanceStatusCode);
}

export type AttendanceSummaryCounts = {
  present: number;
  absent: number;
  leave: number;
  od: number;
  other: number;
  total: number;
  unmarked: number;
};

export function summarizeAttendanceStatuses(
  students: Array<{ id: string; status?: string | null }>,
  draft: Record<string, { status: string }>,
): AttendanceSummaryCounts {
  const counts: AttendanceSummaryCounts = {
    present: 0,
    absent: 0,
    leave: 0,
    od: 0,
    other: 0,
    total: students.length,
    unmarked: 0,
  };

  for (const student of students) {
    const code = draft[student.id]?.status ?? student.status ?? '';
    if (!code) {
      counts.unmarked += 1;
      continue;
    }
    const meta = ATTENDANCE_STATUS_MAP[code as AttendanceStatusCode];
    if (!meta) {
      counts.other += 1;
      continue;
    }
    if (meta.group === 'present') counts.present += 1;
    else if (meta.group === 'absent') counts.absent += 1;
    else if (meta.group === 'leave') counts.leave += 1;
    else if (meta.group === 'od') counts.od += 1;
    else counts.other += 1;
  }

  return counts;
}
