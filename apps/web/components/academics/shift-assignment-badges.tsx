'use client';

import { cn } from '@/utils/cn';
import type { AssignedShiftChip } from '@/services/faculty-shifts';

const ACCENT: Record<string, string> = {
  MORNING:
    'border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-800/50 dark:bg-teal-950/40 dark:text-teal-200',
  DAY: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200',
};

export function ShiftAssignmentBadges({
  shifts,
  currentShiftId,
  className,
}: {
  shifts?: AssignedShiftChip[] | null;
  currentShiftId?: string | null;
  className?: string;
}) {
  if (!shifts?.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {shifts.map((shift) => {
        const code = shift.code.toUpperCase();
        const isCurrent = currentShiftId === shift.id;
        return (
          <span
            key={shift.id}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              ACCENT[code] ?? 'border-border bg-muted text-muted-foreground',
              isCurrent && 'ring-1 ring-primary/40',
            )}
            title={shift.isPrimary ? `${shift.name} (primary)` : shift.name}
          >
            {isCurrent ? '☑' : '☐'} {shift.name.replace(/ Shift$/i, '') || shift.code}
          </span>
        );
      })}
    </div>
  );
}
