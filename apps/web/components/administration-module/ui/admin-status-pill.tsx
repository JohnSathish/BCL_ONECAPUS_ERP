'use client';

import { cn } from '@/utils/cn';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30',
  suspended: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30',
  blocked: 'bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/30',
  inactive: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 ring-slate-500/30',
};

export function AdminStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize',
        STATUS_STYLES[status] ?? STATUS_STYLES.inactive,
      )}
    >
      {status}
    </span>
  );
}
