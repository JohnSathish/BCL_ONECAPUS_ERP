'use client';

import { motion } from 'framer-motion';
import { BedDouble, GraduationCap, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';
import { Area, AreaChart } from 'recharts';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { ChartContainer } from '@/components/dashboard/chart-container';
import { KPI_METRICS } from '@/modules/dashboard/mock-data';
import { cn } from '@/utils/cn';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  students: Users,
  faculty: GraduationCap,
  attendance: Users,
  fees: Wallet,
  placement: TrendingUp,
  grievances: TrendingDown,
  completion: GraduationCap,
  hostel: BedDouble,
};

type LiveStats = {
  applications?: number;
  pendingReview?: number;
  programs?: number;
  campuses?: number;
};

export function KpiGrid({ liveStats }: { liveStats?: LiveStats }) {
  const metrics = KPI_METRICS.map((kpi) => {
    if (kpi.id === 'students' && liveStats?.applications != null) {
      return {
        ...kpi,
        value: liveStats.applications,
        label: 'Applications',
        context: 'admissions pipeline',
        suffix: undefined,
      };
    }
    if (kpi.id === 'grievances' && liveStats?.pendingReview != null) {
      return {
        ...kpi,
        value: liveStats.pendingReview,
        label: 'Pending review',
        context: 'requires action',
        suffix: undefined,
      };
    }
    return kpi;
  });

  return (
    <motion.div className="grid w-full grid-cols-12 gap-4 md:gap-5 lg:gap-6">
      {metrics.map((kpi, i) => {
        const Icon = ICONS[kpi.id] ?? Users;
        const up = kpi.trend === 'up';
        const chartData = kpi.sparkline.map((v, idx) => ({ i: idx, v }));

        return (
          <motion.article
            key={kpi.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4 }}
            className="glass-card group col-span-12 rounded-2xl p-4 transition-shadow hover:shadow-[var(--shadow-glow)] sm:col-span-6 lg:col-span-4 xl:col-span-3 2xl:col-span-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
                  up ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
                )}
              >
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(kpi.change)}%
              </span>
            </div>

            <p className="mt-4 text-xs font-medium text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              <AnimatedCounter
                value={kpi.value}
                decimals={kpi.suffix === '%' ? 1 : 0}
                suffix={kpi.suffix ?? ''}
              />
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{kpi.context}</p>

            <ChartContainer height={48} className="mt-3 opacity-80">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`g-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="hsl(var(--primary))"
                  fill={`url(#g-${kpi.id})`}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          </motion.article>
        );
      })}
    </motion.div>
  );
}
