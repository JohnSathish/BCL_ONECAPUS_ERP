'use client';

import {
  student360Score,
  studentHealthSignals,
  type HealthSignal,
} from '@/components/students-module/directory/directory-student-health';
import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

const TONE_DOT: Record<HealthSignal['tone'], string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
  neutral: 'bg-muted-foreground/50',
};

const SCORE_STYLES = {
  good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  bad: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export function DirectoryHealthIndicators({
  row,
  compact = false,
}: {
  row: StudentDirectoryRow;
  compact?: boolean;
}) {
  const signals = studentHealthSignals(row);
  const score = student360Score(row);

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {signals.map((s) => (
          <span
            key={s.key}
            title={s.label}
            className={cn('h-2 w-2 rounded-full', TONE_DOT[s.tone])}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {signals.map((s) => (
          <span
            key={s.key}
            title={s.label}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border border-border/50 px-1.5 py-0.5 text-[9px] font-medium',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[s.tone])} />
            {s.label}
          </span>
        ))}
      </div>
      <span
        className={cn(
          'inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold',
          SCORE_STYLES[score.tone],
        )}
        title={`Profile completeness ${score.score}%`}
      >
        {score.label} · {score.score}%
      </span>
    </div>
  );
}
