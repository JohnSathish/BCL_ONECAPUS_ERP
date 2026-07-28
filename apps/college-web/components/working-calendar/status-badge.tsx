'use client';

import { memo } from 'react';
import { cn } from '@/lib/cn';
import { STATUS_STYLES } from './status';
import type { WorkingDayStatus } from './types';

type Props = {
  status: Exclude<WorkingDayStatus, 'empty'>;
  label: string;
  className?: string;
};

function StatusBadgeComponent({ status, label, className }: Props) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        styles.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} aria-hidden />
      {label}
    </span>
  );
}

export const StatusBadge = memo(StatusBadgeComponent);
