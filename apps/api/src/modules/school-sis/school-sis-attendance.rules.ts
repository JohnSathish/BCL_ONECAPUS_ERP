export type AttendanceStatusCode =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'LEAVE'
  | 'EXCUSED'
  | string;

export type AttendanceSettingsLike = {
  lateCountsPresent: boolean;
  halfDayValue: number;
  leaveCountsPresent: boolean;
  excusedCountsPresent: boolean;
  presentWeight?: number;
  lateWeight?: number;
  absentWeight?: number;
};

export const DEFAULT_ATTENDANCE_STATUSES: Array<{
  code: string;
  name: string;
  shortCode: string;
  countsPresent: boolean;
  countsAbsent: boolean;
  attendanceValue: number;
  requiresRemark: boolean;
  sortOrder: number;
}> = [
  {
    code: 'PRESENT',
    name: 'Present',
    shortCode: 'P',
    countsPresent: true,
    countsAbsent: false,
    attendanceValue: 1,
    requiresRemark: false,
    sortOrder: 1,
  },
  {
    code: 'ABSENT',
    name: 'Absent',
    shortCode: 'A',
    countsPresent: false,
    countsAbsent: true,
    attendanceValue: 0,
    requiresRemark: false,
    sortOrder: 2,
  },
  {
    code: 'LATE',
    name: 'Late',
    shortCode: 'L',
    countsPresent: true,
    countsAbsent: false,
    attendanceValue: 1,
    requiresRemark: false,
    sortOrder: 3,
  },
  {
    code: 'HALF_DAY',
    name: 'Half Day',
    shortCode: 'H',
    countsPresent: true,
    countsAbsent: false,
    attendanceValue: 0.5,
    requiresRemark: false,
    sortOrder: 4,
  },
  {
    code: 'LEAVE',
    name: 'Leave',
    shortCode: 'LV',
    countsPresent: false,
    countsAbsent: false,
    attendanceValue: 0,
    requiresRemark: false,
    sortOrder: 5,
  },
  {
    code: 'EXCUSED',
    name: 'Excused',
    shortCode: 'E',
    countsPresent: true,
    countsAbsent: false,
    attendanceValue: 1,
    requiresRemark: false,
    sortOrder: 6,
  },
];

export const DEFAULT_LEAVE_TYPES = [
  { code: 'SICK', name: 'Sick Leave', countsAsPresent: false, sortOrder: 1 },
  {
    code: 'CASUAL',
    name: 'Casual Leave',
    countsAsPresent: false,
    sortOrder: 2,
  },
  {
    code: 'MEDICAL',
    name: 'Medical Leave',
    countsAsPresent: false,
    sortOrder: 3,
  },
  {
    code: 'FAMILY',
    name: 'Family Leave',
    countsAsPresent: false,
    sortOrder: 4,
  },
  { code: 'OTHER', name: 'Other', countsAsPresent: false, sortOrder: 5 },
];

export const REGISTER_LETTER: Record<string, string> = {
  PRESENT: 'P',
  ABSENT: 'A',
  LATE: 'L',
  HALF_DAY: 'H',
  LEAVE: 'LV',
  EXCUSED: 'E',
  HOLIDAY: 'HLD',
};

export function unitForStatus(
  code: string,
  settings: AttendanceSettingsLike,
): number {
  const c = code.toUpperCase();
  if (c === 'PRESENT') return settings.presentWeight ?? 1;
  if (c === 'LATE') {
    if (settings.lateWeight != null) return Number(settings.lateWeight);
    return settings.lateCountsPresent ? 1 : 0;
  }
  if (c === 'HALF_DAY') return Number(settings.halfDayValue) || 0.5;
  if (c === 'LEAVE') return settings.leaveCountsPresent ? 1 : 0;
  if (c === 'EXCUSED') return settings.excusedCountsPresent ? 1 : 0;
  if (c === 'ABSENT') return settings.absentWeight ?? 0;
  return 0;
}

export function attendancePercent(earned: number, workingDays: number): number {
  if (!workingDays) return 0;
  return Math.round((earned / workingDays) * 10000) / 100;
}

export function bandForPercent(
  pct: number,
  warnPercent: number,
  minPercent: number,
) {
  if (pct >= warnPercent) return 'GREEN';
  if (pct >= minPercent) return 'WARNING';
  return 'CRITICAL';
}

export function attendanceStatusLabel(
  pct: number,
  warnPercent: number,
  minPercent: number,
  goodPercent = 90,
): 'Excellent' | 'Good' | 'Normal' | 'Warning' | 'Critical' {
  if (pct >= Math.max(95, goodPercent + 5)) return 'Excellent';
  if (pct >= goodPercent) return 'Good';
  if (pct >= warnPercent) return 'Normal';
  if (pct >= minPercent) return 'Warning';
  return 'Critical';
}

export function sessionNaturalKey(input: {
  academicYearId: string;
  date: string;
  sectionId: string;
  mode: string;
  periodKey: string;
}) {
  return [
    input.academicYearId,
    input.date.slice(0, 10),
    input.sectionId,
    input.mode,
    input.periodKey || 'DAILY',
  ].join('|');
}
