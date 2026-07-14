'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import { flagTone, formatFlagLabel, outcomeTone, statusTone } from './device-login-utils';

const TONE_CLASS = {
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700',
  danger: 'border-rose-500/25 bg-rose-500/10 text-rose-700',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-800',
  info: 'border-sky-500/25 bg-sky-500/10 text-sky-700',
  neutral: 'border-border bg-muted/60 text-muted-foreground',
} as const;

export function DeviceLoginBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function FlagBadges({ flags }: { flags?: string[] | null }) {
  if (!flags?.length) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((flag) => (
        <DeviceLoginBadge key={flag} tone={flagTone(flag)}>
          {formatFlagLabel(flag)}
        </DeviceLoginBadge>
      ))}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <DeviceLoginBadge tone={statusTone(status)}>{status.replace(/_/g, ' ')}</DeviceLoginBadge>;
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  return <DeviceLoginBadge tone={outcomeTone(outcome)}>{outcome}</DeviceLoginBadge>;
}

export function KpiCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
}) {
  const accent =
    tone === 'success'
      ? 'from-emerald-500/15 to-transparent'
      : tone === 'danger'
        ? 'from-rose-500/15 to-transparent'
        : tone === 'warning'
          ? 'from-amber-500/15 to-transparent'
          : tone === 'info'
            ? 'from-sky-500/15 to-transparent'
            : 'from-primary/10 to-transparent';

  const body = (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-sm transition',
        href && 'hover:border-primary/40 hover:shadow-md',
      )}
    >
      <div
        className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', accent)}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
          {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {Icon ? (
          <span className="rounded-lg border border-border/70 bg-background/80 p-2 text-muted-foreground">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
      >
        {body}
      </Link>
    );
  }
  return body;
}

export function MiniBarChart({
  title,
  subtitle,
  items,
  valueKey = 'count',
  labelKey,
  colorClass = 'bg-primary',
  emptyHint = 'No activity in this period yet.',
}: {
  title: string;
  subtitle?: string;
  items: Record<string, string | number>[];
  valueKey?: string;
  labelKey: (item: Record<string, string | number>, index: number) => string;
  colorClass?: string;
  emptyHint?: string;
}) {
  const values = items.map((item) => Number(item[valueKey] ?? 0));
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, n) => sum + n, 0);
  const chartH = 140;

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
          {total} total
        </span>
      </div>
      {total === 0 ? (
        <div className="flex h-[140px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <div className="flex h-[140px] items-end gap-1">
          {items.map((item, index) => {
            const value = Number(item[valueKey] ?? 0);
            const height = Math.max(value > 0 ? 8 : 3, Math.round((value / max) * chartH));
            const label = labelKey(item, index);
            return (
              <div
                key={`${label}-${index}`}
                className="group relative flex min-w-0 flex-1 flex-col items-center justify-end"
                title={`${label}: ${value}`}
              >
                <div className="pointer-events-none absolute -top-7 hidden rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
                  {value}
                </div>
                <div
                  className={cn(
                    'w-full max-w-[18px] rounded-t-md transition-all group-hover:opacity-90',
                    colorClass,
                    value === 0 && 'opacity-25',
                  )}
                  style={{ height }}
                />
              </div>
            );
          })}
        </div>
      )}
      {total > 0 ? (
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{labelKey(items[0]!, 0)}</span>
          <span>{labelKey(items[items.length - 1]!, items.length - 1)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function DistributionList({
  title,
  items,
}: {
  title: string;
  items: { name: string; count: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No devices registered yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((row) => (
            <li key={row.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{row.name}</span>
                <span className="tabular-nums text-muted-foreground">{row.count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max(6, Math.round((row.count / max) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EmptyTableState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function DeviceLoginTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm',
        className,
      )}
    >
      <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
    </div>
  );
}

export function DeviceLoginThead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
        {columns.map((col) => (
          <th key={col} className="px-4 py-3 font-semibold">
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}
