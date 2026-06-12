'use client';

import type { CompletionCell, CompletionStatus } from '@/types/curriculum-completion';
import { STATUS_DOT, STATUS_STYLES } from '@/types/curriculum-completion';
import { cn } from '@/utils/cn';

type Props = {
  cell: CompletionCell;
  onClick?: () => void;
  compact?: boolean;
};

export function CompletionCellBadge({ cell, onClick, compact }: Props) {
  return (
    <button
      type="button"
      title={cell.issues.length ? cell.issues.join(', ') : cell.status}
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
        STATUS_STYLES[cell.status as CompletionStatus],
        onClick && 'hover:opacity-80 cursor-pointer',
        !onClick && 'cursor-default',
        compact && 'min-w-[52px] justify-center',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[cell.status as CompletionStatus])}
      />
      {cell.actual}/{cell.required}
    </button>
  );
}
