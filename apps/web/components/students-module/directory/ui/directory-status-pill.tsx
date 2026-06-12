'use client';

import { cn } from '@/utils/cn';

const STATUS_STYLES: Record<string, string> = {
  STUDYING:
    'bg-emerald-500/15 text-emerald-700 shadow-[0_0_12px_-2px] shadow-emerald-500/40 dark:text-emerald-300',
  PROMOTED:
    'bg-emerald-500/15 text-emerald-700 shadow-[0_0_12px_-2px] shadow-emerald-500/40 dark:text-emerald-300',
  ALUMNI:
    'bg-violet-500/15 text-violet-700 shadow-[0_0_12px_-2px] shadow-violet-500/40 dark:text-violet-300',
  GRADUATED:
    'bg-blue-500/15 text-blue-700 shadow-[0_0_12px_-2px] shadow-blue-500/40 dark:text-blue-300',
  DETAINED:
    'bg-amber-500/15 text-amber-800 shadow-[0_0_12px_-2px] shadow-amber-500/40 dark:text-amber-200',
  LEAVING:
    'bg-rose-500/15 text-rose-700 shadow-[0_0_12px_-2px] shadow-rose-500/40 dark:text-rose-300',
  DROPPED:
    'bg-rose-500/15 text-rose-700 shadow-[0_0_12px_-2px] shadow-rose-500/40 dark:text-rose-300',
  INACTIVE: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
};

const PULSE_STATUSES = new Set(['DETAINED', 'LEAVING', 'DROPPED']);

const DOT_COLORS: Record<string, string> = {
  STUDYING: 'bg-emerald-500',
  PROMOTED: 'bg-emerald-500',
  ALUMNI: 'bg-violet-500',
  GRADUATED: 'bg-blue-500',
  DETAINED: 'bg-amber-500',
  LEAVING: 'bg-rose-500',
  DROPPED: 'bg-rose-500',
  INACTIVE: 'bg-muted-foreground/50',
  PENDING: 'bg-amber-500',
};

const DISPLAY_LABELS: Record<string, string> = {
  STUDYING: 'Studying',
  PROMOTED: 'Promoted',
  ALUMNI: 'Alumni',
  GRADUATED: 'Graduated',
  DETAINED: 'Detained',
  LEAVING: 'Leaving',
  DROPPED: 'Dropped',
  INACTIVE: 'Inactive',
  PENDING: 'Pending',
};

type Props = {
  label: string;
  className?: string;
};

export function DirectoryStatusPill({ label, className }: Props) {
  const key = label.toUpperCase().replace(/\s+/g, '_');
  const pulse = PULSE_STATUSES.has(key);
  const display = DISPLAY_LABELS[key] ?? label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide',
        STATUS_STYLES[key] ?? 'bg-primary/10 text-primary',
        pulse && 'motion-safe:animate-pulse',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_COLORS[key] ?? 'bg-primary')} />
      {display}
    </span>
  );
}
