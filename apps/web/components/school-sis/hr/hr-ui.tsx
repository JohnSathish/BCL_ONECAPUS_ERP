'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  BarChart3,
  Building2,
  CalendarDays,
  Clock3,
  FileText,
  Home,
  Landmark,
  Receipt,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export const HR_LINKS: Array<{
  href: string;
  label: string;
  exact?: boolean;
  icon: LucideIcon;
}> = [
  { href: '/admin/school-sis/hr', label: 'Dashboard', exact: true, icon: Home },
  { href: '/admin/school-sis/hr/employees', label: 'Employees', icon: Users },
  { href: '/admin/school-sis/hr/org', label: 'Organisation', icon: Building2 },
  { href: '/admin/school-sis/hr/attendance', label: 'Attendance', icon: Clock3 },
  { href: '/admin/school-sis/hr/leave', label: 'Leave', icon: CalendarDays },
  { href: '/admin/school-sis/hr/salary', label: 'Salary', icon: Wallet },
  { href: '/admin/school-sis/hr/payroll', label: 'Payroll', icon: Banknote },
  { href: '/admin/school-sis/hr/payslips', label: 'Payslips', icon: FileText },
  { href: '/admin/school-sis/hr/loans', label: 'Loans', icon: Landmark },
  { href: '/admin/school-sis/hr/reimbursements', label: 'Reimbursements', icon: Receipt },
  { href: '/admin/school-sis/hr/me', label: 'My HR', icon: UserRound },
  { href: '/admin/school-sis/reports?module=staff', label: 'Reports', icon: BarChart3 },
];

export function inrPaise(paise?: number | null) {
  if (paise == null) return '₹0.00';
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function rupeesToPaise(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function HrShell({
  title,
  subtitle,
  extra,
  children,
}: {
  title: string;
  subtitle?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-full space-y-4 bg-[#eef4fb] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#2563eb]">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-500">
              HR & Payroll
            </p>
            <h1 className="text-[22px] font-bold tracking-tight text-[#1d4ed8]">{title}</h1>
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {extra}
      </div>
      <nav className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
        {HR_LINKS.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href.split('?')[0]);
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
                active
                  ? 'bg-[#1d4ed8] text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', active ? 'text-white' : 'text-[#2563eb]')} />
              {l.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export function HrCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function HrBadge({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  const map: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-rose-50 text-rose-800 ring-rose-200',
    blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  };
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1',
        map[tone] ?? map.slate,
      )}
    >
      {children}
    </span>
  );
}

export const field =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#1d4ed8]/20';
export const btn =
  'inline-flex h-10 items-center rounded-lg bg-[#1d4ed8] px-4 text-sm font-medium text-white disabled:opacity-50';
export const btnGhost =
  'inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-700';
