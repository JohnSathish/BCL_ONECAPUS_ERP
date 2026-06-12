'use client';

import { cn } from '@/utils/cn';

export const STATUS_COLORS: Record<string, string> = {
  VACANT: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  OCCUPIED: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  RESERVED: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  MAINTENANCE: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  ACTIVE: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  COMPLETED: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-500/15 text-amber-700',
  RECOVERED: 'bg-emerald-500/15 text-emerald-700',
};

export function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function quarterTypeLabel(slug: string) {
  return slug.replace(/_/g, ' ');
}

export function inputClass(extra?: string) {
  return cn(
    'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30',
    extra,
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        STATUS_COLORS[status] ?? 'bg-muted',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function OccupancyBar({
  occupied,
  total,
  label,
}: {
  occupied: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {occupied}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function EmptyTableRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
