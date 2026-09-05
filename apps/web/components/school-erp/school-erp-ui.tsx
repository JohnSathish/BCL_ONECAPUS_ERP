'use client';

import Link from 'next/link';
import { cn } from '@/utils/cn';

export function SchoolErpStatCard({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string;
  value?: number | string | null;
  hint?: string;
  href?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200/80 bg-emerald-50/60'
      : tone === 'warning'
        ? 'border-amber-200/80 bg-amber-50/60'
        : tone === 'danger'
          ? 'border-rose-200/80 bg-rose-50/60'
          : tone === 'info'
            ? 'border-sky-200/80 bg-sky-50/50'
            : tone === 'accent'
              ? 'border-[#c5a572]/40 bg-[#f8f1e6]/70'
              : 'border-[var(--school-erp-border)] bg-white';

  const body = (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-sm transition hover:border-[#1b4d3e]/35',
        toneClass,
        href && 'cursor-pointer',
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--school-erp-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--school-erp-primary)]">
        {value ?? '—'}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--school-erp-muted)]">{hint}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

export function SchoolErpPanel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-[var(--school-erp-border)] bg-white p-5 shadow-sm',
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--school-erp-primary)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SchoolErpComingSoonBadge({ compact }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full font-medium',
        compact
          ? 'bg-white/15 px-1.5 py-0.5 text-[9px] text-emerald-50/90'
          : 'bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500',
      )}
    >
      Coming Soon
    </span>
  );
}
