'use client';

import { memo } from 'react';
import { cn } from '@/lib/cn';
import { STATUS_STYLES } from './status';
import type { WorkingDayStatus } from './types';

type Props = {
  status: Exclude<WorkingDayStatus, 'empty'>;
  label: string;
  className?: string;
  compact?: boolean;
};

function StatusBadgeComponent({ status, label, className, compact }: Props) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold uppercase tracking-wide ring-1 ring-inset',
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'gap-1.5 px-2 py-0.5 text-[11px]',
        styles.badge,
        className,
      )}
    >
      {!compact ? (
        <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

export const StatusBadge = memo(StatusBadgeComponent);
