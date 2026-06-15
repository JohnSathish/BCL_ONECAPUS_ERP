'use client';

import { cn } from '@/utils/cn';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:
    'bg-emerald-500/15 text-emerald-700 shadow-[0_0_12px_-2px] shadow-emerald-500/40 dark:text-emerald-300',
  PENDING: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  SUSPENDED:
    'bg-rose-500/15 text-rose-700 shadow-[0_0_12px_-2px] shadow-rose-500/40 dark:text-rose-300',
  ALUMNI:
    'bg-violet-500/15 text-violet-700 shadow-[0_0_12px_-2px] shadow-violet-500/40 dark:text-violet-300',
  TRANSFER:
    'bg-blue-500/15 text-blue-700 shadow-[0_0_12px_-2px] shadow-blue-500/40 dark:text-blue-300',
  INACTIVE: 'bg-muted text-muted-foreground',
};

const DOT_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  PENDING: 'bg-amber-500',
  SUSPENDED: 'bg-rose-500',
  ALUMNI: 'bg-violet-500',
  TRANSFER: 'bg-blue-500',
  INACTIVE: 'bg-muted-foreground/50',
};

const RAW_TO_DISPLAY: Record<string, { key: string; label: string }> = {
  STUDYING: { key: 'ACTIVE', label: 'Active' },
  PROMOTED: { key: 'ACTIVE', label: 'Active' },
  PENDING: { key: 'PENDING', label: 'Pending' },
  DETAINED: { key: 'PENDING', label: 'Pending' },
  DROPPED: { key: 'SUSPENDED', label: 'Suspended' },
  LEAVING: { key: 'SUSPENDED', label: 'Suspended' },
  ALUMNI: { key: 'ALUMNI', label: 'Alumni' },
  GRADUATED: { key: 'ALUMNI', label: 'Alumni' },
  TRANSFER: { key: 'TRANSFER', label: 'Transfer' },
  TRANSFERRED: { key: 'TRANSFER', label: 'Transfer' },
  INACTIVE: { key: 'INACTIVE', label: 'Inactive' },
};

function normalizeStatus(label: string) {
  const key = label.toUpperCase().replace(/\s+/g, '_');
  return RAW_TO_DISPLAY[key] ?? { key, label };
}

type Props = {
  label: string;
  className?: string;
};

export function DirectoryStatusPill({ label, className }: Props) {
  const { key, label: display } = normalizeStatus(label);
  const pulse = key === 'SUSPENDED';

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
