'use client';

import { Check, X } from 'lucide-react';
import { cn } from '@/utils/cn';

type MonthRow = { month: string; status: string; amount?: number };

export function FeeMonthGrid({ tracker }: { tracker?: MonthRow[] }) {
  if (!tracker?.length) {
    return <p className="text-sm text-slate-500">No monthly fee data</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tracker.map((row) => {
        const paid = row.status === 'PAID' || row.status === 'CLEAR' || row.status === 'paid';
        return (
          <div
            key={row.month}
            className={cn(
              'flex min-w-[72px] flex-col items-center rounded-lg border px-2 py-2 text-center text-xs',
              paid
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800',
            )}
          >
            <span className="font-semibold capitalize">{row.month}</span>
            {paid ? <Check className="mt-1 h-4 w-4" /> : <X className="mt-1 h-4 w-4" />}
          </div>
        );
      })}
    </div>
  );
}
