'use client';

import { GlassCard } from '@/components/erp/glass-card';
import type { StudentAcademicChip } from '@/types/student-portal';
import { cn } from '@/utils/cn';

const CHIP_COLORS: Record<string, string> = {
  MAJOR: 'border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-300',
  MINOR: 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300',
  MDC: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
  AEC: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  SEC: 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300',
  VAC: 'border-teal-500/30 bg-teal-500/10 text-teal-800 dark:text-teal-300',
};

export function AcademicSnapshotWidget({
  chips,
  loading,
}: {
  chips?: StudentAcademicChip[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-32 rounded-full bg-muted" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-semibold tracking-tight">Academic Snapshot</h3>
      <p className="text-xs text-muted-foreground">Your registered subjects this semester</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {!chips?.length ? (
          <p className="text-sm text-muted-foreground">No subject registration found yet.</p>
        ) : (
          chips.map((chip) => (
            <span
              key={`${chip.category}-${chip.courseTitle}`}
              className={cn(
                'inline-flex flex-col rounded-2xl border px-3 py-2 text-left',
                CHIP_COLORS[chip.category] ?? 'border-border/60 bg-muted/30',
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                {chip.label}
              </span>
              <span className="text-xs font-semibold">{chip.courseTitle}</span>
            </span>
          ))
        )}
      </div>
    </GlassCard>
  );
}
