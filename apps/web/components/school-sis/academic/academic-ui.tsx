'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowUpRight,
  BookMarked,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Clock3,
  GitBranch,
  Home,
  IdCard,
  LayoutDashboard,
  School,
  Trophy,
  Users,
} from 'lucide-react';
import { cn } from '@/utils/cn';

export const ACADEMIC_LINKS = [
  { href: '/admin/school-sis/academic', label: 'Overview', exact: true },
  { href: '/admin/school-sis/academic/years', label: 'Academic Year' },
  { href: '/admin/school-sis/academic/calendar', label: 'Academic Calendar' },
  { href: '/admin/school-sis/academic/classes', label: 'Classes' },
  { href: '/admin/school-sis/academic/subjects', label: 'Subjects' },
  { href: '/admin/school-sis/academic/class-subjects', label: 'Class-wise Subjects' },
  { href: '/admin/school-sis/academic/staff', label: 'Class-wise Staff' },
  { href: '/admin/school-sis/timetable', label: 'Timetable' },
  { href: '/admin/school-sis/academic/optionals', label: 'Optional Mapping' },
  { href: '/admin/school-sis/academic/houses', label: 'Houses' },
  { href: '/admin/school-sis/academic/clubs', label: 'Clubs' },
  { href: '/admin/school-sis/academic/promotion', label: 'Promotion' },
  { href: '/admin/school-sis/academic/id-cards', label: 'ID Cards' },
  { href: '/admin/school-sis/academic/attendance-settings', label: 'Attendance Settings' },
] as const;

const ACADEMIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Overview: LayoutDashboard,
  'Academic Year': CalendarRange,
  'Academic Calendar': CalendarDays,
  Classes: School,
  Subjects: BookOpen,
  'Class-wise Subjects': BookMarked,
  'Class-wise Staff': Users,
  Timetable: Clock3,
  'Optional Mapping': GitBranch,
  Houses: Home,
  Clubs: Trophy,
  Promotion: ArrowUpRight,
  'ID Cards': IdCard,
  'Attendance Settings': ClipboardCheck,
};

export function AcademicPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--school-erp-muted)]">
          Academic Configuration
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--school-erp-text)]">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--school-erp-muted)]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function AcademicSubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Academic configuration"
      className="-mx-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-max min-w-full gap-1.5 px-1 py-0.5">
        {ACADEMIC_LINKS.map((item) => {
          const active =
            'exact' in item && item.exact
              ? pathname === item.href
              : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = ACADEMIC_ICONS[item.label];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm',
                active
                  ? 'bg-[var(--school-erp-primary,#1e3a8a)] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone: Record<string, string> = {
    CURRENT: 'bg-emerald-50 text-emerald-800',
    ACTIVE: 'bg-emerald-50 text-emerald-800',
    UPCOMING: 'bg-sky-50 text-sky-800',
    DRAFT: 'bg-slate-100 text-slate-600',
    ARCHIVED: 'bg-amber-50 text-amber-800',
    INACTIVE: 'bg-slate-100 text-slate-500',
    PROMOTED: 'bg-indigo-50 text-indigo-800',
    HELD_BACK: 'bg-amber-50 text-amber-800',
    WITHDRAWN: 'bg-rose-50 text-rose-800',
  };
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        tone[value] ?? 'bg-slate-100 text-slate-600',
      )}
    >
      {value.replace(/_/g, ' ')}
    </span>
  );
}

export function AcademicCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--school-erp-border)] bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AcademicTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--school-erp-border)] bg-white">
      <table className="w-full min-w-[40rem] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2.5 align-middle', className)}>{children}</td>;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const fieldClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none ring-[var(--school-erp-accent)] focus:ring-2';

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('sls-btn sls-btn-primary', props.className)} />;
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('sls-btn sls-btn-secondary', props.className)} />;
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-2xl border bg-white p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function confirmAction(message: string) {
  return typeof window !== 'undefined' ? window.confirm(message) : false;
}
