'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

export const CAL_LINKS = [
  { href: '/admin/school-sis/holidays', label: 'Holiday Calendar', exact: true },
  { href: '/admin/school-sis/academic/calendar', label: 'Academic Calendar' },
];

export function CalendarShell({
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
            Holidays
          </p>
          <h1 className="text-xl font-semibold text-[#1e3a8a]">{title}</h1>
          {subtitle ? <p className="mt-0.5 max-w-3xl text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {extra}
      </div>
      <nav className="flex flex-wrap gap-2">
        {CAL_LINKS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 sm:text-sm',
                active
                  ? 'bg-[#2563eb] text-white ring-[#2563eb] shadow-sm'
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

export const calField =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15';

export function CalCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function kindClass(kind: string) {
  const map: Record<string, string> = {
    WORKING_DAY: 'bg-white text-slate-700',
    WEEKLY_OFF: 'bg-slate-100 text-slate-500',
    HOLIDAY: 'bg-rose-50 text-rose-800',
    VACATION: 'bg-orange-50 text-orange-800',
    SPECIAL_WORKING_DAY: 'bg-emerald-50 text-emerald-800',
    EXAMINATION: 'bg-violet-50 text-violet-800',
  };
  return map[kind] ?? 'bg-white text-slate-700';
}

export function fmtCalDate(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function weekdayName(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
}

export function durationDays(start?: string, end?: string) {
  if (!start) return 1;
  const a = new Date(start.slice(0, 10) + 'T00:00:00Z').getTime();
  const b = new Date((end || start).slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const blob = new Blob(
    [
      [
        header.join(','),
        ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      ].join('\n'),
    ],
    {
      type: 'text/csv',
    },
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
