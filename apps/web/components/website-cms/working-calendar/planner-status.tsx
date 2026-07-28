import type { AcademicPlannerDay } from '@/types/website-cms';
import { cn } from '@/utils/cn';

export type PlannerDayStatus =
  | 'working'
  | 'weekend'
  | 'saturday-working'
  | 'holiday'
  | 'optional'
  | 'empty';

const HOLIDAY_RE =
  /holiday|break|non-working|result|admission|exam|orientation|bridge|institutional event|staff event/i;
const OPTIONAL_RE = /optional|restricted/i;
const WEEKEND_RE = /weekend/i;
const WORKING_SAT_RE = /working on saturday|saturday working|holiday class|compensatory|makeup/i;

export function resolvePlannerDayStatus(day: AcademicPlannerDay): {
  status: Exclude<PlannerDayStatus, 'empty'>;
  label: string;
} {
  const statusLabel = day.statusLabel.trim();
  const isSunday = day.dayOfWeek.toUpperCase() === 'SUN';
  const isSaturday = day.dayOfWeek.toUpperCase() === 'SAT';

  if (OPTIONAL_RE.test(statusLabel)) return { status: 'optional', label: 'Optional' };
  if (WEEKEND_RE.test(statusLabel) || (isSunday && !day.isWorkingDay && !statusLabel)) {
    return { status: 'weekend', label: 'Weekend' };
  }
  if (
    (isSaturday && day.isWorkingDay) ||
    WORKING_SAT_RE.test(statusLabel) ||
    (isSaturday && /working/i.test(statusLabel))
  ) {
    return { status: 'saturday-working', label: 'Working' };
  }
  if (HOLIDAY_RE.test(statusLabel) && !/holiday class|compensatory|makeup/i.test(statusLabel)) {
    return { status: 'holiday', label: 'Holiday' };
  }
  if (day.isWorkingDay) {
    return { status: isSaturday ? 'saturday-working' : 'working', label: 'Working' };
  }
  if (isSunday || isSaturday) return { status: 'weekend', label: 'Weekend' };
  return { status: 'holiday', label: statusLabel || 'Holiday' };
}

export const PLANNER_STATUS_STYLES: Record<
  Exclude<PlannerDayStatus, 'empty'>,
  { dot: string; badge: string }
> = {
  working: { dot: 'bg-[#22C55E]', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  weekend: { dot: 'bg-[#2563EB]', badge: 'bg-blue-50 text-blue-700 ring-blue-100' },
  'saturday-working': {
    dot: 'bg-[#F59E0B]',
    badge: 'bg-amber-50 text-amber-800 ring-amber-100',
  },
  holiday: { dot: 'bg-[#EF4444]', badge: 'bg-rose-50 text-rose-700 ring-rose-100' },
  optional: { dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 ring-violet-100' },
};

export function PlannerStatusBadge({
  status,
  label,
}: {
  status: Exclude<PlannerDayStatus, 'empty'>;
  label: string;
}) {
  const styles = PLANNER_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        styles.badge,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} aria-hidden />
      {label}
    </span>
  );
}
