'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

export const EXAM_LINKS = [
  { href: '/admin/school-sis/exams', label: 'Dashboard', exact: true },
  { href: '/admin/school-sis/exams/schedule', label: 'Schedule' },
  { href: '/admin/school-sis/exams/marks', label: 'Marks Entry' },
  { href: '/admin/school-sis/exams/grades', label: 'Grades' },
  { href: '/admin/school-sis/exams/results', label: 'Results' },
  { href: '/admin/school-sis/exams/report-cards', label: 'Report Cards' },
  { href: '/admin/school-sis/exams/settings', label: 'Configuration' },
];

export function ExamShell({
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
            Examination
          </p>
          <h1 className="text-xl font-semibold text-[#1e3a8a]">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {extra}
      </div>
      <nav className="flex flex-wrap gap-2">
        {EXAM_LINKS.map((item) => {
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

export function examStatusClass(status: string) {
  const map: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
    SCHEDULED: 'bg-sky-50 text-sky-800 ring-sky-200',
    ONGOING: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    MARKS_ENTRY: 'bg-amber-50 text-amber-800 ring-amber-200',
    UNDER_REVIEW: 'bg-orange-50 text-orange-800 ring-orange-200',
    EVALUATION_COMPLETE: 'bg-violet-50 text-violet-800 ring-violet-200',
    RESULT_GENERATED: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
    COMPLETED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    PUBLISHED: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    ARCHIVED: 'bg-slate-100 text-slate-500 ring-slate-200',
    PASS: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    FAIL: 'bg-rose-50 text-rose-800 ring-rose-200',
    ABSENT: 'bg-slate-100 text-slate-600 ring-slate-200',
    WITHHELD: 'bg-amber-50 text-amber-800 ring-amber-200',
    INCOMPLETE: 'bg-orange-50 text-orange-800 ring-orange-200',
    COMPARTMENT: 'bg-violet-50 text-violet-800 ring-violet-200',
    EXEMPTED: 'bg-sky-50 text-sky-800 ring-sky-200',
    PROMOTED: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
    NOT_PROMOTED: 'bg-rose-50 text-rose-800 ring-rose-200',
  };
  return map[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200';
}

export function ExamBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1',
        examStatusClass(value),
      )}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
}

export function ExamCard({
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

export const examField =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/15';

export function fmtDate(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function num(v: unknown) {
  return Number(v ?? 0);
}
