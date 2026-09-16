'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

export const ATT_LINKS = [
  { href: '/admin/school-sis/attendance', label: 'Dashboard', exact: true },
  { href: '/admin/school-sis/attendance/mark', label: 'Take attendance' },
  { href: '/admin/school-sis/attendance/absentees', label: 'Absentees' },
  { href: '/admin/school-sis/attendance/monthly', label: 'Monthly' },
  { href: '/admin/school-sis/attendance/leave', label: 'Leave' },
  { href: '/admin/school-sis/attendance/corrections', label: 'Corrections' },
  { href: '/admin/school-sis/reports?module=attendance', label: 'Reports' },
  { href: '/admin/school-sis/attendance/settings', label: 'Settings' },
];

export function AttendanceShell({
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
    <div className="space-y-4 bg-[#f4f7fb] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Student Attendance
          </p>
          <h1 className="text-xl font-semibold text-[#1e3a8a]">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {extra}
      </div>
      <nav className="flex flex-wrap gap-2">
        {ATT_LINKS.map((item) => {
          const pathOnly = item.href.split('?')[0];
          const active = item.exact
            ? pathname === pathOnly
            : pathname === pathOnly || pathname?.startsWith(`${pathOnly}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 sm:text-sm',
                active
                  ? 'bg-[#1e3a8a] text-white ring-[#1e3a8a] shadow-sm'
                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

export function AttCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const STATUS_BTN: Record<string, string> = {
  PRESENT: 'bg-emerald-600 text-white ring-emerald-600',
  ABSENT: 'bg-rose-600 text-white ring-rose-600',
  LATE: 'bg-amber-500 text-white ring-amber-500',
  HALF_DAY: 'bg-sky-600 text-white ring-sky-600',
  LEAVE: 'bg-violet-600 text-white ring-violet-600',
  EXCUSED: 'bg-slate-700 text-white ring-slate-700',
};

export const STATUS_BADGE: Record<string, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  ABSENT: 'bg-rose-50 text-rose-800 ring-rose-200',
  LATE: 'bg-amber-50 text-amber-800 ring-amber-200',
  HALF_DAY: 'bg-sky-50 text-sky-800 ring-sky-200',
  LEAVE: 'bg-violet-50 text-violet-800 ring-violet-200',
  EXCUSED: 'bg-slate-100 text-slate-700 ring-slate-200',
  SUBMITTED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
  LOCKED: 'bg-slate-800 text-white ring-slate-800',
  NOT_SUBMITTED: 'bg-amber-50 text-amber-800 ring-amber-200',
  GREEN: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  WARNING: 'bg-amber-50 text-amber-800 ring-amber-200',
  CRITICAL: 'bg-rose-50 text-rose-800 ring-rose-200',
};

export function StatusChip({ code }: { code: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
        STATUS_BADGE[code] ?? 'bg-slate-50 text-slate-600 ring-slate-200',
      )}
    >
      {code.replaceAll('_', ' ')}
    </span>
  );
}

export const QUICK_STATUSES = [
  'PRESENT',
  'ABSENT',
  'LATE',
  'HALF_DAY',
  'LEAVE',
  'EXCUSED',
] as const;
