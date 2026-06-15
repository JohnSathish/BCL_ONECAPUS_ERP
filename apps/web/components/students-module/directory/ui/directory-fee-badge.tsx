'use client';

import type { StudentDirectoryRow } from '@/types/students';
import { cn } from '@/utils/cn';

const FEE_STYLES: Record<string, string> = {
  CLEAR: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  DUE: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  PARTIAL: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  OVERDUE: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

function formatAmount(amount: number) {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function DirectoryFeeBadge({ row }: { row: StudentDirectoryRow }) {
  const status = row.feeStatus ?? ((row.feeDueAmount ?? 0) > 0 ? 'DUE' : 'CLEAR');
  const amount = row.feeDueAmount ?? 0;

  let label = 'Paid';
  if (status === 'OVERDUE' && amount > 0) {
    label = `Overdue ${formatAmount(amount)}`;
  } else if ((status === 'DUE' || status === 'PARTIAL') && amount > 0) {
    label = `Due ${formatAmount(amount)}`;
  } else if (amount > 0) {
    label = `Due ${formatAmount(amount)}`;
  }

  return (
    <span
      className={cn(
        'inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums',
        FEE_STYLES[status] ?? FEE_STYLES.CLEAR,
      )}
      title={amount > 0 ? `${formatAmount(amount)} outstanding` : 'No pending fees'}
    >
      {label}
    </span>
  );
}
