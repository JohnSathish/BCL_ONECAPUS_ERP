'use client';

import { cn } from '@/utils/cn';

type Props = {
  status?: 'completed' | 'draft' | 'pending' | 'none';
  className?: string;
};

type MappingKey = 'completed' | 'pending' | 'missing';

function mapStatus(status?: Props['status']): MappingKey {
  if (status === 'completed') return 'completed';
  if (status === 'draft' || status === 'pending') return 'pending';
  return 'missing';
}

const STYLES: Record<MappingKey, string> = {
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  missing: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

const DOT_STYLES: Record<MappingKey, string> = {
  completed: 'bg-emerald-500',
  pending: 'bg-amber-500',
  missing: 'bg-rose-500',
};

const LABELS: Record<MappingKey, string> = {
  completed: 'Completed',
  pending: 'Pending',
  missing: 'Missing',
};

export function DirectoryRegistrationBadge({ status = 'none', className }: Props) {
  const key = mapStatus(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
        STYLES[key],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_STYLES[key])} />
      {LABELS[key]}
    </span>
  );
}
