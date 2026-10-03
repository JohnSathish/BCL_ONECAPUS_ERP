'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Search,
  ShieldCheck,
  Ticket,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { fetchCycleDashboard } from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import { useDashboardFiltersStore } from '@/store/dashboard-filters-store';
import { cn } from '@/utils/cn';

type ReportItem = {
  label: string;
  href: string;
  soon?: boolean;
  icon: LucideIcon;
};

type ReportSection = {
  title: string;
  description: string;
  icon: LucideIcon;
  tone: Tone;
  items: ReportItem[];
};

type Tone = 'sky' | 'emerald' | 'violet' | 'amber' | 'rose' | 'indigo';

const USAGE_KEY = 'erp-reports-hub-usage';
const LAST_KEY = 'erp-reports-hub-last';

const TONE: Record<Tone, { card: string; icon: string; badge: string; row: string; kpi?: string }> =
  {
    sky: {
      card: 'border-sky-200/90 bg-white dark:border-sky-900/60 dark:bg-card',
      icon: 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300',
      badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-200',
      row: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300',
    },
    emerald: {
      card: 'border-emerald-200/90 bg-emerald-50/40 dark:border-emerald-900/60 dark:bg-emerald-950/20',
      icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
      badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
      row: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
      kpi: 'border-emerald-200/90 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30',
    },
    violet: {
      card: 'border-violet-200/90 bg-white dark:border-violet-900/60 dark:bg-card',
      icon: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300',
      badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200',
      row: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300',
    },
    amber: {
      card: 'border-amber-200/90 bg-white dark:border-amber-900/60 dark:bg-card',
      icon: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
      badge: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
      row: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
      kpi: 'border-amber-200/90 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30',
    },
    rose: {
      card: 'border-rose-200/90 bg-rose-50/30 dark:border-rose-900/60 dark:bg-rose-950/20',
      icon: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
      row: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
    },
    indigo: {
      card: 'border-indigo-200/90 bg-white dark:border-indigo-900/60 dark:bg-card',
      icon: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300',
      badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200',
      row: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300',
    },
  };

const SECTIONS: ReportSection[] = [
  {
    title: 'Student Reports',
    description: 'Registers, strength, and programme-wise student analytics.',
    icon: GraduationCap,
    tone: 'sky',
    items: [
      { label: 'Student Reports Hub', href: '/admin/reports/students', icon: Users },
      { label: 'Student Export Hub', href: '/admin/students/export', icon: FileSpreadsheet },
      { label: 'Admission Register', href: '/admin/reports/admissions', icon: ClipboardList },
      { label: 'Alumni Report', href: '/admin/students/archive', icon: Award },
      {
        label: 'Profile Completion Dashboard',
        href: '/admin/students/profile-verification/completion',
        icon: UserRound,
      },
      {
        label: 'Pending Profile Updates',
        href: '/admin/students/profile-verification/pending',
        icon: Clock3,
      },
    ],
  },
  {
    title: 'Attendance Reports',
    description: 'Student and staff attendance summaries and defaulter lists.',
    icon: CalendarDays,
    tone: 'emerald',
    items: [
      { label: 'Student Attendance', href: '/admin/academics/attendance', icon: Users },
      {
        label: 'Monthly Attendance',
        href: '/admin/reports/attendance/monthly',
        icon: CalendarDays,
      },
      {
        label: 'Cumulative Attendance',
        href: '/admin/reports/attendance/cumulative',
        icon: BarChart3,
      },
      {
        label: 'Defaulters & Eligibility',
        href: '/admin/reports/attendance/defaulters',
        icon: AlertTriangle,
      },
      {
        label: 'Staff Daily Report',
        href: '/admin/staff/attendance/reports/daily',
        icon: ClipboardList,
      },
      {
        label: 'Staff Monthly Report',
        href: '/admin/staff/attendance/reports/monthly',
        icon: CalendarDays,
      },
    ],
  },
  {
    title: 'Examination Reports',
    description: 'Internal marks, results, and university examination outputs.',
    icon: BookOpen,
    tone: 'violet',
    items: [
      { label: 'Examination Module', href: '/admin/academics/examinations', icon: BookOpen },
      { label: 'Hall Tickets', href: '/admin/academics/examinations', soon: true, icon: Ticket },
      {
        label: 'Results & Rankers',
        href: '/admin/academics/examinations',
        soon: true,
        icon: BarChart3,
      },
    ],
  },
  {
    title: 'Fee Reports',
    description: 'Collections, outstanding dues, and scholarship adjustments.',
    icon: Wallet,
    tone: 'amber',
    items: [
      { label: 'Fee Reports', href: '/admin/fees/reports', icon: Wallet },
      { label: 'Collection Console', href: '/admin/fees/collections', icon: Download },
      {
        label: 'Outstanding Summary',
        href: '/admin/reports/fees/outstanding',
        icon: FileSpreadsheet,
      },
      { label: 'Defaulter Intelligence', href: '/admin/fees/defaulters', icon: AlertTriangle },
    ],
  },
  {
    title: 'Certificate Reports',
    description: 'Issuance trends, verification activity, and audit trails.',
    icon: Award,
    tone: 'rose',
    items: [
      { label: 'Certificate Analytics', href: '/admin/certificates/analytics', icon: BarChart3 },
      { label: 'Certificate Audit Logs', href: '/admin/certificates/audit', icon: ClipboardList },
      { label: 'Verification Portal', href: '/admin/certificates/verification', icon: ShieldCheck },
    ],
  },
  {
    title: 'Academic Reports',
    description: 'Timetable, teaching load, and curriculum reporting.',
    icon: BookOpen,
    tone: 'indigo',
    items: [
      {
        label: 'Timetable Reports',
        href: '/admin/academics/timetable/reports',
        icon: CalendarDays,
      },
      { label: 'Staff Workload', href: '/admin/staff/workload', icon: Users },
      { label: 'Compliance Exports', href: '/admin/reports/compliance', icon: ShieldCheck },
    ],
  },
];

function formatAyLabel(name: string | undefined) {
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed.toUpperCase().startsWith('AY ') ? trimmed : `AY ${trimmed}`;
}

function formatOpenedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ReportsHubPage() {
  const session = useRequireAuth();
  const { branding } = useInstitutionBranding();
  const institutionIdFromFilters = useDashboardFiltersStore((s) => s.institutionId);
  const [query, setQuery] = useState('');
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [lastOpened, setLastOpened] = useState<{ label: string; at: string } | null>(null);

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  });
  const institutionId = institutionIdFromFilters ?? institutions.data?.[0]?.id;
  const institution = institutions.data?.find((row) => row.id === institutionId);
  const cycle = useQuery({
    queryKey: ['academic-lifecycle', 'dashboard', institutionId, 'reports-hub'],
    queryFn: () => fetchCycleDashboard(institutionId!),
    enabled: Boolean(session) && Boolean(institutionId),
    staleTime: 60_000,
  });

  useEffect(() => {
    try {
      const storedUsage = localStorage.getItem(USAGE_KEY);
      if (storedUsage) setUsage(JSON.parse(storedUsage) as Record<string, number>);
      const storedLast = localStorage.getItem(LAST_KEY);
      if (storedLast) setLastOpened(JSON.parse(storedLast) as { label: string; at: string });
    } catch {
      /* ignore a blocked or corrupt local store */
    }
  }, []);

  const needle = query.trim().toLowerCase();
  const visibleSections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            !needle ||
            item.label.toLowerCase().includes(needle) ||
            section.title.toLowerCase().includes(needle),
        ),
      })).filter((section) => section.items.length > 0),
    [needle],
  );

  const totalReports = SECTIONS.reduce((sum, section) => sum + section.items.length, 0);
  const liveReports = SECTIONS.reduce(
    (sum, section) => sum + section.items.filter((item) => !item.soon).length,
    0,
  );
  const mostUsed = useMemo(() => {
    const ranked = Object.entries(usage).sort((a, b) => b[1] - a[1]);
    if (ranked[0] && ranked[0][1] > 0) {
      return { label: ranked[0][0], count: ranked[0][1] };
    }
    return { label: 'Attendance Reports', count: 0 };
  }, [usage]);

  function rememberOpen(label: string) {
    const nextUsage = { ...usage, [label]: (usage[label] ?? 0) + 1 };
    const nextLast = { label, at: new Date().toISOString() };
    setUsage(nextUsage);
    setLastOpened(nextLast);
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(nextUsage));
      localStorage.setItem(LAST_KEY, JSON.stringify(nextLast));
    } catch {
      /* storage is optional */
    }
  }

  if (!session) return null;

  const collegeName =
    institution?.name ?? branding?.displayName ?? branding?.shortName ?? 'College';
  const ay = formatAyLabel(cycle.data?.primarySession?.name);
  const cycleName = cycle.data?.currentCycle ? `${cycle.data.currentCycle} Cycle` : null;
  const cycleActive = cycle.data?.primarySession?.status === 'ACTIVE';

  return (
    <DashboardShell role="admin" title="Reports" pageHeader={false}>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate font-medium text-foreground">{collegeName}</span>
              {ay ? (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <span>{ay}</span>
                </>
              ) : null}
              {cycleName ? (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <span>{cycleName}</span>
                  {cycleActive ? (
                    <span className="ml-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Active
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Central reporting hub for student, attendance, examination, fee, certificate, and
                  academic analytics.
                </p>
              </div>
            </div>
          </div>
          <label className="relative block w-full lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reports..."
              className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none ring-sky-500/30 placeholder:text-muted-foreground focus:ring-2"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={FileSpreadsheet}
            label="Total Reports"
            value={String(totalReports)}
            hint="Available reports"
          />
          <KpiCard
            icon={Users}
            label="Most Used"
            value={mostUsed.label}
            hint={
              mostUsed.count > 0
                ? `Opened ${mostUsed.count} time${mostUsed.count === 1 ? '' : 's'} on this browser`
                : 'Attendance is the default starting point'
            }
            className={TONE.emerald.kpi}
            valueClassName="text-base"
          />
          <KpiCard
            icon={Download}
            label="Reports Ready"
            value={String(liveReports)}
            hint="Live links in this hub"
          />
          <KpiCard
            icon={Clock3}
            label="Last Opened"
            value={lastOpened ? formatOpenedAt(lastOpened.at) : 'Not yet'}
            hint={lastOpened?.label ?? 'Open a report to record it here'}
            className={TONE.amber.kpi}
            valueClassName="text-base"
          />
        </div>

        {visibleSections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            No reports match “{query.trim()}”.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {visibleSections.map((section) => {
              const tone = TONE[section.tone];
              return (
                <section
                  key={section.title}
                  className={cn('rounded-2xl border p-4 shadow-sm', tone.card)}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn('rounded-xl p-2', tone.icon)}>
                        <section.icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-foreground">{section.title}</h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {section.description}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        tone.badge,
                      )}
                    >
                      {section.items.length} Report{section.items.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <ul className="divide-y divide-border/70">
                    {section.items.map((item) => (
                      <li key={item.label}>
                        {item.soon ? (
                          <div className="flex items-center gap-2 px-1 py-2.5 text-sm text-muted-foreground">
                            <span className={cn('rounded-lg p-1.5', tone.row)}>
                              <item.icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              Soon
                            </span>
                          </div>
                        ) : (
                          <Link
                            href={item.href}
                            onClick={() => rememberOpen(item.label)}
                            className="flex items-center gap-2 rounded-lg px-1 py-2.5 text-sm text-foreground transition hover:bg-white/70 dark:hover:bg-white/5"
                          >
                            <span className={cn('rounded-lg p-1.5', tone.row)}>
                              <item.icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <BarChart3 className="mt-0.5 h-4 w-4 shrink-0" />
            Institution-wide analytics and accreditation packs are grouped here instead of being
            scattered under individual modules.
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/admin/analytics"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics Dashboard
            </Link>
            <Link
              href="/admin/students/export"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-700"
            >
              <Download className="h-4 w-4" />
              Export All Reports
            </Link>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  className,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <article className={cn('rounded-2xl border border-border bg-card p-4 shadow-sm', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="rounded-xl bg-sky-50 p-2 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn('text-2xl font-bold tracking-tight text-foreground', valueClassName)}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}
