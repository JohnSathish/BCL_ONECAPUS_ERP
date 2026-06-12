'use client';

import type { DashboardDataSource } from '@/types/dashboard-analytics';
import { cn } from '@/utils/cn';

type Props = {
  title: string;
  description?: string;
  source?: DashboardDataSource;
  className?: string;
  children: React.ReactNode;
  footer?: string;
};

export function ChartWidgetCard({
  title,
  description,
  source,
  className,
  children,
  footer,
}: Props) {
  return (
    <article
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card/95 p-5 shadow-sm',
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {source === 'seed' ? (
          <span className="shrink-0 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
            Estimated
          </span>
        ) : null}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
      {footer ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{footer}</p>
      ) : source === 'seed' ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Based on institutional benchmarks until live feeds are connected.
        </p>
      ) : null}
    </article>
  );
}
