'use client';

import type { ChartSeriesPoint } from '@/types/dashboard-analytics';
import { cn } from '@/utils/cn';

type Props = {
  items: ChartSeriesPoint[];
  className?: string;
};

export function PendingApprovalsWidget({ items, className }: Props) {
  const max = Math.max(...items.map((i) => Number(i.value)), 1);

  return (
    <ul className={cn('space-y-4', className)}>
      {items.map((item) => {
        const value = Number(item.value);
        const pct = Math.round((value / max) * 100);
        return (
          <li key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">{item.label}</span>
              <span className="tabular-nums text-muted-foreground">{value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
