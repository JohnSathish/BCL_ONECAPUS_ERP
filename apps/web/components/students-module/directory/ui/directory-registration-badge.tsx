'use client';

import { cn } from '@/utils/cn';

type Props = {
  status?: 'completed' | 'draft' | 'pending' | 'none';
  className?: string;
};

const STYLES: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  draft: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  pending: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  none: 'bg-muted text-muted-foreground',
};

const LABELS: Record<string, string> = {
  completed: 'Mapping complete',
  draft: 'Mapping draft',
  pending: 'Mapping pending',
  none: 'Not started',
};

export function DirectoryRegistrationBadge({ status = 'none', className }: Props) {
  const key = status ?? 'none';
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        STYLES[key] ?? STYLES.none,
        className,
      )}
    >
      {LABELS[key] ?? LABELS.none}
    </span>
  );
}
