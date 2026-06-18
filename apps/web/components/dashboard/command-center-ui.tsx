'use client';

import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart } from 'recharts';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { ChartContainer } from '@/components/dashboard/chart-container';
import { cn } from '@/utils/cn';

export const CC_COLORS = {
  primary: '#2563EB',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#0F172A',
  muted: '#475569',
  bg: '#F8FAFC',
} as const;

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

export function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function pct(n: number, decimals = 1) {
  return `${Math.round(n * 10 ** decimals) / 10 ** decimals}%`;
}

export function SaaSCard({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.04)]',
        'dark:border-border/60 dark:bg-card',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-bold tracking-tight text-[#0F172A] dark:text-foreground">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-[#475569] dark:text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

type KpiTone = 'blue' | 'green' | 'orange' | 'red' | 'purple';

const KPI_TONE: Record<KpiTone, { bg: string; icon: string; ring: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-[#2563EB]', ring: 'ring-blue-100' },
  green: { bg: 'bg-emerald-50', icon: 'text-[#16A34A]', ring: 'ring-emerald-100' },
  orange: { bg: 'bg-amber-50', icon: 'text-[#F59E0B]', ring: 'ring-amber-100' },
  red: { bg: 'bg-red-50', icon: 'text-[#EF4444]', ring: 'ring-red-100' },
  purple: { bg: 'bg-violet-50', icon: 'text-violet-600', ring: 'ring-violet-100' },
};

export function KpiCard({
  label,
  value,
  subValue,
  hint,
  icon: Icon,
  tone,
  href,
  sparkline,
  trend,
}: {
  label: string;
  value: string;
  subValue?: string;
  hint?: string;
  icon: LucideIcon;
  tone: KpiTone;
  href?: string;
  sparkline?: number[];
  trend?: { pct: number; up: boolean };
}) {
  const colors = KPI_TONE[tone];
  const chartData = (sparkline ?? []).map((v, i) => ({ i, v }));

  const inner = (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
      className={cn(
        'group relative h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow',
        'dark:border-border/60 dark:bg-card',
        href && 'cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-xl ring-4',
            colors.bg,
            colors.ring,
          )}
        >
          <Icon className={cn('h-5 w-5', colors.icon)} />
        </div>
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold',
              trend.up ? 'bg-emerald-50 text-[#16A34A]' : 'bg-red-50 text-[#EF4444]',
            )}
          >
            {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend.pct)}%
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#475569] dark:text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-foreground">
        {value}
      </p>
      {subValue ? <p className="mt-0.5 text-sm font-medium text-[#475569]">{subValue}</p> : null}
      {hint ? <p className="mt-1 text-[11px] text-[#64748B]">{hint}</p> : null}
      {sparkline?.length ? (
        <ChartContainer height={36} className="mt-3 opacity-80">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`cc-kpi-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CC_COLORS.primary} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CC_COLORS.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={CC_COLORS.primary}
              strokeWidth={1.5}
              fill={`url(#cc-kpi-${label})`}
              dot={false}
              isAnimationActive
            />
          </AreaChart>
        </ChartContainer>
      ) : null}
    </motion.div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function CircularProgress({
  value,
  size = 120,
  stroke = 10,
  color = CC_COLORS.primary,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  sublabel?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-[#0F172A] dark:text-foreground">
            <AnimatedCounter value={value} decimals={1} suffix="%" />
          </span>
          {sublabel ? <span className="text-[10px] text-[#64748B]">{sublabel}</span> : null}
        </div>
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-[#475569]">{label}</p>
    </div>
  );
}

export function FeeBarChart({ values }: { values: number[] }) {
  const data = values.map((value, i) => ({
    day: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i] ?? `${i + 1}`,
    amount: value,
  }));

  return (
    <ChartContainer height={120}>
      <BarChart data={data} barCategoryGap="20%">
        <Bar dataKey="amount" fill={CC_COLORS.success} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  );
}

export function PriorityBadge({ priority }: { priority: 'critical' | 'high' | 'medium' }) {
  const map = {
    critical: { label: 'Critical', className: 'bg-red-50 text-[#EF4444] border-red-200' },
    high: { label: 'Important', className: 'bg-amber-50 text-[#F59E0B] border-amber-200' },
    medium: { label: 'Normal', className: 'bg-blue-50 text-[#2563EB] border-blue-200' },
  };
  const item = map[priority];
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
        item.className,
      )}
    >
      {item.label}
    </span>
  );
}

export function DeptProgressBar({
  name,
  value,
  metric,
}: {
  name: string;
  value: number | null;
  metric: string;
}) {
  const pctVal = value ?? 0;
  const color =
    pctVal >= 75 ? CC_COLORS.success : pctVal >= 60 ? CC_COLORS.warning : CC_COLORS.danger;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-[#0F172A] dark:text-foreground">{name}</span>
        <span className="text-xs text-[#64748B]">
          {value != null ? `${value}%` : '—'} · {metric}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pctVal)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function StatusDot({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  const colors = {
    healthy: 'bg-[#16A34A]',
    warning: 'bg-[#F59E0B]',
    critical: 'bg-[#EF4444]',
  };
  const labels = { healthy: 'Healthy', warning: 'Warning', critical: 'Critical' };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span className={cn('h-2 w-2 rounded-full', colors[status])} />
      <span className="text-[#475569]">{labels[status]}</span>
    </span>
  );
}

export function QuickActionCard({
  label,
  href,
  icon: Icon,
  primary,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
}) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -3, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors',
          primary
            ? 'border-[#2563EB]/30 bg-[#2563EB]/5 hover:border-[#2563EB]/50 hover:bg-[#2563EB]/10'
            : 'border-slate-200/80 bg-white hover:border-[#2563EB]/30 hover:shadow-md dark:border-border/60 dark:bg-card',
        )}
      >
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            primary ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-[#475569] dark:bg-muted',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs font-semibold text-[#0F172A] dark:text-foreground">{label}</span>
      </motion.div>
    </Link>
  );
}

export function ArrowLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
    >
      {label}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export function OpsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200/60" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-2xl bg-slate-200/60" />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-slate-200/60" />
        ))}
      </div>
    </div>
  );
}
