'use client';

import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

function resolveAttendance(row: StudentDirectoryRow): { label: string; tone: Tone } {
  const pct = row.attendancePercent;
  if (pct == null) {
    return { label: '—', tone: 'neutral' };
  }
  const rounded = Math.round(pct);
  if (rounded >= 90) return { label: `${rounded}%`, tone: 'good' };
  if (rounded >= 75) return { label: `${rounded}%`, tone: 'warn' };
  return { label: `${rounded}%`, tone: 'bad' };
}

const TONE_STYLES: Record<Tone, string> = {
  good: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  warn: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  bad: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  neutral: 'bg-muted text-muted-foreground',
};

const DOT_STYLES: Record<Tone, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
  neutral: 'bg-muted-foreground/40',
};

export function DirectoryAttendanceBadge({ row }: { row: StudentDirectoryRow }) {
  const { label, tone } = resolveAttendance(row);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums',
        TONE_STYLES[tone],
      )}
      title={
        row.attendancePercent != null
          ? `Attendance ${Math.round(row.attendancePercent)}%`
          : 'Attendance not recorded'
      }
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_STYLES[tone])} />
      {label}
    </span>
  );
}
