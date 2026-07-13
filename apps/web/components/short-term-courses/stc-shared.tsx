'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BookOpen,
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export const STC_TAB_META = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'batches', label: 'Batches', icon: CalendarDays },
  { id: 'registrations', label: 'Registrations', icon: Users },
  { id: 'faculty', label: 'Faculty', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: ClipboardList },
  { id: 'assessments', label: 'Assessments', icon: ClipboardList },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'reports', label: 'Reports', icon: LayoutDashboard },
] as const;

export type StcTabId = (typeof STC_TAB_META)[number]['id'];

const STATUS_TONES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  PUBLISHED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ARCHIVED: 'bg-slate-100 text-slate-500 ring-slate-200',
  OPEN: 'bg-sky-50 text-sky-800 ring-sky-200',
  UPCOMING: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  COMPLETED: 'bg-violet-50 text-violet-800 ring-violet-200',
  APPLIED: 'bg-slate-100 text-slate-700 ring-slate-200',
  PAYMENT_PENDING: 'bg-amber-50 text-amber-900 ring-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  WAITLISTED: 'bg-orange-50 text-orange-800 ring-orange-200',
  CANCELLED: 'bg-rose-50 text-rose-800 ring-rose-200',
  FREE: 'bg-teal-50 text-teal-800 ring-teal-200',
  PAID: 'bg-blue-50 text-blue-800 ring-blue-200',
  OFFLINE: 'bg-slate-100 text-slate-700 ring-slate-200',
  ONLINE: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  HYBRID: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200',
};

export function money(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export function StcStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        STATUS_TONES[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function StcHero({
  title,
  subtitle,
  actions,
  badge = 'Certificate Programmes',
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  badge?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-6 text-white shadow-lg shadow-slate-900/10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-indigo-400/20 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            {badge}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function StcKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div
      className={cn('rounded-2xl border border-slate-200/80 bg-gradient-to-br p-4 shadow-sm', tone)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <div className="rounded-xl bg-white/70 p-2 shadow-sm ring-1 ring-slate-200/60">
          <Icon className="h-4 w-4 text-slate-700" />
        </div>
      </div>
    </div>
  );
}

export function StcPanel({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {Icon ? <Icon className="h-4 w-4 text-sky-700" /> : null}
            {title}
          </h3>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StcEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <Icon className="h-5 w-5 text-sky-700" />
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StcStatusBar({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) {
    return <p className="text-sm text-slate-500">No registration mix yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">{item.label}</span>
            <span className="tabular-nums text-slate-500">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full transition-all', item.color)}
              style={{ width: `${Math.round((item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
