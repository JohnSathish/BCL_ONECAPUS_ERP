'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Reusable KPI / statistics card for any School ERP module dashboard. */
export function SchoolErpKpiCard({
  label,
  value,
  hint,
  tone = 'green',
  href,
}: {
  label: string;
  value?: number | string | null;
  hint?: string;
  tone?: 'green' | 'blue' | 'orange' | 'purple' | 'slate' | 'rose';
  href?: string;
}) {
  const tones = {
    green: 'border-emerald-200/80 bg-emerald-50/70 text-emerald-900',
    blue: 'border-sky-200/80 bg-sky-50/70 text-sky-900',
    orange: 'border-amber-200/80 bg-amber-50/70 text-amber-950',
    purple: 'border-violet-200/80 bg-violet-50/70 text-violet-950',
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    rose: 'border-rose-200/80 bg-rose-50/70 text-rose-950',
  };
  const valueTone = {
    green: 'text-emerald-800',
    blue: 'text-sky-800',
    orange: 'text-amber-900',
    purple: 'text-violet-900',
    slate: 'text-slate-800',
    rose: 'text-rose-900',
  };

  const body = (
    <div className={cn('rounded-2xl border p-4 shadow-sm transition hover:shadow-md', tones[tone])}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold tracking-tight', valueTone[tone])}>
        {value ?? '—'}
      </p>
      {hint ? <p className="mt-1 text-xs opacity-70">{hint}</p> : null}
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

export function SchoolErpQuickActionTile({
  href,
  label,
  icon,
  tone = 'green',
  disabled,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  tone?: 'green' | 'blue' | 'orange' | 'purple' | 'slate';
  disabled?: boolean;
}) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
    blue: 'bg-sky-50 text-sky-900 hover:bg-sky-100',
    orange: 'bg-amber-50 text-amber-950 hover:bg-amber-100',
    purple: 'bg-violet-50 text-violet-950 hover:bg-violet-100',
    slate: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
  };

  if (disabled) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl bg-slate-100 px-3 py-3 text-left text-slate-400 opacity-70">
        {icon}
        <span className="text-xs font-semibold leading-snug">{label}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-start gap-2 rounded-xl px-3 py-3 text-left transition',
        tones[tone],
      )}
    >
      {icon}
      <span className="text-xs font-semibold leading-snug">{label}</span>
    </Link>
  );
}

export function SchoolErpNoticeItem({
  title,
  body,
  tone = 'green',
}: {
  title: string;
  body: string;
  tone?: 'green' | 'gold' | 'slate' | 'rose';
}) {
  const bar =
    tone === 'gold'
      ? 'bg-[#c5a572]'
      : tone === 'slate'
        ? 'bg-slate-400'
        : tone === 'rose'
          ? 'bg-rose-500'
          : 'bg-emerald-600';
  return (
    <li className="flex gap-3">
      <span className={cn('mt-1 h-8 w-1 shrink-0 rounded-full', bar)} />
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--school-erp-muted)]">{body}</p>
      </div>
    </li>
  );
}

export function SchoolErpActivityItem({
  href,
  title,
  subtitle,
  badge,
  badgeClassName,
  initial,
}: {
  href: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeClassName?: string;
  initial?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition hover:border-[var(--school-erp-border)] hover:bg-[#f7faf8]"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf5ee] text-xs font-bold text-[var(--school-erp-primary)]">
          {initial || title.slice(0, 1) || 'A'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{title}</p>
          {subtitle ? (
            <p className="font-mono text-[11px] text-[var(--school-erp-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {badge ? (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
              badgeClassName,
            )}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
