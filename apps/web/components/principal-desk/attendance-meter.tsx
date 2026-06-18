'use client';

import { cn } from '@/utils/cn';

export function AttendanceMeter({
  percentage,
  band,
  classesAttended,
  classesConducted,
}: {
  percentage: number | null;
  band: 'green' | 'orange' | 'red' | 'neutral';
  classesAttended: number;
  classesConducted: number;
}) {
  const pct = percentage ?? 0;
  const ringColor =
    band === 'green'
      ? 'text-emerald-500'
      : band === 'orange'
        ? 'text-amber-500'
        : band === 'red'
          ? 'text-rose-500'
          : 'text-slate-300';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-100"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${Math.min(pct, 100) * 2.64} 264`}
            className={cn('transition-all duration-700', ringColor)}
          />
        </svg>
        <div className="text-center">
          <p className={cn('text-3xl font-black tabular-nums', ringColor)}>
            {percentage != null ? `${percentage}%` : '—'}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Attendance
          </p>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-muted/40">
          <p className="font-bold text-slate-900 dark:text-foreground">{classesAttended}</p>
          <p className="text-slate-500">Attended</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-muted/40">
          <p className="font-bold text-slate-900 dark:text-foreground">{classesConducted}</p>
          <p className="text-slate-500">Conducted</p>
        </div>
      </div>
    </div>
  );
}
