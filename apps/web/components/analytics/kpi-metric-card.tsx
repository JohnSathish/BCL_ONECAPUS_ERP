'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { Area, AreaChart } from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { ChartContainer } from '@/components/dashboard/chart-container';
import type { DashboardKpiMetric } from '@/types/dashboard-analytics';
import { cn } from '@/utils/cn';

type Props = {
  metric: DashboardKpiMetric;
  icon: LucideIcon;
  className?: string;
};

export function KpiMetricCard({ metric, icon: Icon, className }: Props) {
  const up = metric.trend === 'up';
  const chartData = metric.sparkline.map((v, i) => ({ i, v }));

  return (
    <article
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card/95 p-4 shadow-sm transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              up
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-500/10 text-red-700 dark:text-red-400',
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(metric.changePct)}%
          </span>
          {metric.source === 'seed' ? (
            <span className="rounded-full border border-amber-200/80 bg-amber-50 px-1.5 py-px text-[9px] font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
              Est.
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-xs font-medium text-muted-foreground">{metric.label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
        <AnimatedCounter
          value={metric.value}
          decimals={metric.suffix === '%' ? 1 : 0}
          suffix={metric.suffix ?? ''}
        />
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{metric.context}</p>

      <ChartContainer height={40} className="mt-3 opacity-90">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`kpi-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--institution-primary, hsl(var(--primary)))"
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor="var(--institution-primary, hsl(var(--primary)))"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="var(--institution-primary, hsl(var(--primary)))"
            fill={`url(#kpi-${metric.id})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </article>
  );
}
