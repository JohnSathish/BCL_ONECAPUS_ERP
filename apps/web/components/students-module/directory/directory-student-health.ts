import type { StudentDirectoryRow } from '@/types/students';

export type HealthSignal = {
  key: string;
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
};

import { studentDisplayInitials } from '@/utils/student-name-format';

export function initialsFromName(name: string): string {
  return studentDisplayInitials(name);
}

export function avatarColorClass(name: string): string {
  const palette = [
    'bg-violet-500/20 text-violet-700 dark:text-violet-200',
    'bg-sky-500/20 text-sky-700 dark:text-sky-200',
    'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200',
    'bg-amber-500/20 text-amber-800 dark:text-amber-200',
    'bg-rose-500/20 text-rose-700 dark:text-rose-200',
    'bg-indigo-500/20 text-indigo-700 dark:text-indigo-200',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % palette.length;
  return palette[hash] ?? palette[0]!;
}

function feeTone(row: StudentDirectoryRow): HealthSignal['tone'] {
  if (row.feeStatus === 'OVERDUE') return 'bad';
  if (row.feeStatus === 'DUE' || row.feeStatus === 'PARTIAL' || (row.feeDueAmount ?? 0) > 0)
    return 'warn';
  return 'good';
}

function attendanceTone(row: StudentDirectoryRow): HealthSignal['tone'] {
  if (row.attendanceEligibility === 'DETAINED' || row.attendanceShortage) return 'bad';
  if (row.attendanceEligibility === 'CONDONATION') return 'warn';
  if (row.attendancePercent != null && row.attendancePercent >= 75) return 'good';
  if (row.attendancePercent != null) return 'warn';
  return 'neutral';
}

export function studentHealthSignals(row: StudentDirectoryRow): HealthSignal[] {
  const subjectsTone: HealthSignal['tone'] =
    row.registrationStatus === 'completed'
      ? 'good'
      : row.registrationStatus === 'draft' || row.registrationStatus === 'pending'
        ? 'warn'
        : 'bad';

  const feeLabel =
    row.feeStatus === 'CLEAR' || ((row.feeDueAmount ?? 0) <= 0 && !row.feeStatus)
      ? 'Fees paid'
      : row.feeStatus === 'OVERDUE'
        ? 'Fees overdue'
        : `Fees due ₹${(row.feeDueAmount ?? 0).toLocaleString()}`;

  const attendanceLabel =
    row.attendancePercent != null
      ? `Attendance ${row.attendancePercent}%`
      : row.attendanceShortage
        ? 'Attendance shortage'
        : 'No attendance data';

  return [
    {
      key: 'fees',
      label: feeLabel,
      tone: feeTone(row),
    },
    {
      key: 'attendance',
      label: attendanceLabel,
      tone: attendanceTone(row),
    },
    {
      key: 'subjects',
      label:
        row.registrationStatus === 'completed'
          ? 'Subjects assigned'
          : row.registrationStatus === 'draft'
            ? 'Mapping draft'
            : 'Mapping pending',
      tone: subjectsTone,
    },
    {
      key: 'hostel',
      label: row.isHosteller || row.residenceType === 'HOSTELLER' ? 'Hosteller' : 'Day scholar',
      tone: row.isHosteller ? 'good' : 'neutral',
    },
    {
      key: 'rfid',
      label: row.rfidNumber ? 'RFID assigned' : 'No RFID',
      tone: row.rfidNumber ? 'good' : 'warn',
    },
  ];
}

export function student360Score(row: StudentDirectoryRow): {
  score: number;
  label: string;
  tone: 'good' | 'warn' | 'bad';
} {
  let points = 0;
  const max = 8;
  if (row.registrationStatus === 'completed') points += 1;
  if (row.rfidNumber) points += 1;
  if (row.mobileNumber) points += 1;
  if (row.photoPath) points += 1;
  if (row.rollNumber) points += 1;
  if (feeTone(row) === 'good') points += 1;
  if (attendanceTone(row) === 'good') points += 1;
  if (row.isHosteller || row.residenceType === 'DAY_SCHOLAR') points += 1;

  const pct = Math.round((points / max) * 100);
  if (pct >= 80) return { score: pct, label: 'Healthy profile', tone: 'good' };
  if (pct >= 50) return { score: pct, label: 'Needs attention', tone: 'warn' };
  return { score: pct, label: 'Incomplete profile', tone: 'bad' };
}
