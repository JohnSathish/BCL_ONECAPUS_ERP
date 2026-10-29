'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpRight,
  Barcode,
  BookOpen,
  Copy,
  HeartPulse,
  IndianRupee,
  Info,
  Library,
  Monitor,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { CircularProgress } from '@/components/dashboard/command-center-ui';
import { LibraryKnowledgeAssistant } from '@/components/library/library-knowledge-assistant';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useLibraryRealtime } from '@/hooks/use-library-realtime';
import { usePermissions } from '@/hooks/use-permissions';
import { fetchLibraryDashboard, fetchLibraryDashboardActivity } from '@/services/library';
import type { LibraryActivityItem, LibraryHealthComponent } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Period = 'today' | 'week' | 'month';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

function num(value?: number | null) {
  if (value == null) return '—';
  return value.toLocaleString('en-IN');
}

function rupee(value?: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function actionLabel(action: string) {
  if (action === 'ISSUE') return 'Issued';
  if (action === 'RETURN') return 'Returned';
  if (action === 'RENEW') return 'Renewed';
  return action;
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  href?: string;
  tone: string;
}) {
  const body = (
    <>
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
    </>
  );
  const className =
    'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200';
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm hover:border-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-700">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </Link>
  );
}

function AttentionCard({
  href,
  label,
  value,
  hint,
  alert,
}: {
  href: string;
  label: string;
  value?: number;
  hint: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm hover:border-blue-200',
        alert ? 'border-rose-200' : 'border-slate-200',
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold', alert ? 'text-rose-600' : 'text-slate-900')}>
        {num(value)}
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Link>
  );
}

function HealthBar({ item }: { item: LibraryHealthComponent }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-700" title={item.formula}>
          {item.label}
        </span>
        <span className="font-medium tabular-nums text-slate-900">
          {item.score === null ? 'Unavailable' : `${item.score}%`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            'h-full rounded-full',
            item.key === 'overdueControl' ? 'bg-emerald-500' : 'bg-blue-600',
          )}
          style={{ width: `${item.score ?? 0}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
    </div>
  );
}

export function LibraryDashboard() {
  const enabled = useAuthQueryEnabled();
  const { canAny } = usePermissions();
  const [period, setPeriod] = useState<Period>('today');
  const [showRecent, setShowRecent] = useState(false);
  const [liveActivity, setLiveActivity] = useState<LibraryActivityItem[] | null>(null);

  const dashboard = useQuery({
    queryKey: ['library', 'dashboard', period],
    queryFn: () => fetchLibraryDashboard(period),
    enabled,
    refetchInterval: () => (document.hidden ? false : 30_000),
  });
  const activityPoll = useQuery({
    queryKey: ['library', 'dashboard', 'activity', showRecent ? 'recent' : 'today'],
    queryFn: () => fetchLibraryDashboardActivity(20, showRecent ? 'recent' : 'today'),
    enabled,
    refetchInterval: () => (document.hidden ? false : 30_000),
  });

  const onCirculationActivity = useCallback((item: LibraryActivityItem) => {
    setLiveActivity((prev) => [item, ...(prev ?? [])].slice(0, 20));
  }, []);
  useLibraryRealtime({ onCirculationActivity });

  const d = dashboard.data;
  const health = d?.healthScore;
  const activity = liveActivity ?? activityPoll.data ?? d?.activity ?? [];
  const attention = d?.attention;
  const departmentRows = chartRows(d?.departments?.rows ?? []);
  const maxCopies = Math.max(1, ...departmentRows.map((row) => row.copies));

  const actions = [
    canAny('library:manage')
      ? {
          href: '/admin/library/accession',
          icon: Plus,
          title: 'Add Book',
          description: 'Register a new book',
        }
      : null,
    canAny('library:manage', 'library:settings')
      ? {
          href: '/admin/library/koha-import',
          icon: Upload,
          title: 'Import Books',
          description: 'Import from Excel',
        }
      : null,
    canAny('library:circulate', 'library:manage')
      ? {
          href: '/admin/library/circulation',
          icon: ArrowUpRight,
          title: 'Issue / Return',
          description: 'Circulation desk',
        }
      : null,
    canAny('library:read', 'library:manage')
      ? {
          href: '/admin/library/members',
          icon: Users,
          title: 'Manage Members',
          description: 'Students and staff',
        }
      : null,
    canAny('library:manage', 'library:circulate', 'library:reports', 'library:settings')
      ? {
          href: '/admin/library/barcodes',
          icon: Barcode,
          title: 'Barcode Printing',
          description: 'Print book labels',
        }
      : null,
    canAny('library:read', 'library:manage', 'library:circulate')
      ? {
          href: '/admin/library/search',
          icon: Search,
          title: 'Open Catalogue',
          description: 'Search OPAC',
        }
      : null,
    canAny('library:reports', 'library:manage')
      ? {
          href: '/admin/library/reports',
          icon: Library,
          title: 'Reports',
          description: 'View library reports',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Library Dashboard</h1>
            <p className="text-sm text-slate-500">
              Library operations and knowledge centre overview
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={dashboard.isFetching}
            onClick={() => {
              setLiveActivity(null);
              void dashboard.refetch();
              void activityPoll.refetch();
            }}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', dashboard.isFetching && 'animate-spin')} />
            Refresh
          </Button>
          {canAny('library:reports', 'library:manage') ? (
            <Button asChild>
              <Link href="/admin/library/reports">View Reports</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {dashboard.isError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {apiErrorMessage(dashboard.error)}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Book Copies"
          value={num(d?.totalBooks)}
          hint="Total physical book copies"
          icon={Copy}
          href="/admin/library/collection-reports?report=total-copies"
          tone="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Unique Titles"
          value={num(d?.totalTitles)}
          hint="Different book titles"
          icon={BookOpen}
          href="/admin/library/collection-reports?report=total-titles"
          tone="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Issued Today"
          value={num(d?.issuedToday)}
          hint="Books issued today"
          icon={ArrowUpRight}
          href="/admin/library/circulation"
          tone="bg-violet-50 text-violet-700"
        />
        <StatCard
          label="Returned Today"
          value={num(d?.returnedToday)}
          hint="Books returned today"
          icon={RotateCcw}
          href="/admin/library/circulation"
          tone="bg-orange-50 text-orange-700"
        />
        <StatCard
          label="Overdue Books"
          value={num(d?.overdueLoans)}
          hint="Books not yet returned"
          icon={AlertTriangle}
          href="/admin/library/collection-reports?report=overdue"
          tone="bg-rose-50 text-rose-700"
        />
        <StatCard
          label="Fine Collection Today"
          value={rupee(d?.fineCollectedToday)}
          hint="Total fine collected today"
          icon={IndianRupee}
          href="/admin/library/collection-reports?report=fines"
          tone="bg-teal-50 text-teal-700"
        />
        <StatCard
          label="Library Visitors Today"
          value={num(d?.todayVisitors)}
          hint={
            d?.entryAnalytics?.active
              ? `CAMS entries today: ${num(d.entryAnalytics.total)}`
              : 'Walk-in members and visitors'
          }
          icon={Users}
          href="/admin/library/visits"
          tone="bg-sky-50 text-sky-700"
        />
        <StatCard
          label="Digital Resource Views"
          value={num(d?.digitalViewsToday)}
          hint={
            d && d.digitalAssets === 0
              ? 'No published digital resources'
              : 'E-books and online resources'
          }
          icon={Monitor}
          href="/admin/library/digital"
          tone="bg-indigo-50 text-indigo-700"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Library Activity</h2>
              <p className="text-sm text-slate-500">
                {showRecent
                  ? 'Latest issue, return and renewal records'
                  : "Today's issue, return and renewal activity"}
              </p>
            </div>
            <button
              type="button"
              className="text-sm font-medium text-blue-700"
              onClick={() => {
                setLiveActivity(null);
                setShowRecent((value) => !value);
              }}
            >
              {showRecent ? 'Show today' : 'View recent transactions'}
            </button>
          </div>
          {activityPoll.isError ? (
            <p className="text-sm text-rose-700">{apiErrorMessage(activityPoll.error)}</p>
          ) : activityPoll.isLoading && !activity.length ? (
            <p className="py-16 text-center text-sm text-slate-500">Loading activity…</p>
          ) : activity.length === 0 ? (
            <div className="py-10 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-slate-800">No circulation activity yet today.</p>
              <p className="mt-1 text-sm text-slate-500">
                Books issue, return and renew records will appear here once library operations are
                started for today.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button asChild>
                  <Link href="/admin/library/circulation">Go to Circulation</Link>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setLiveActivity(null);
                    setShowRecent(true);
                  }}
                >
                  View recent transactions
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Member</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                    <th className="py-2 pr-3 font-medium">Book</th>
                    <th className="py-2 pr-3 font-medium">Accession</th>
                    <th className="py-2 font-medium">Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item, index) => (
                    <tr key={`${item.at}-${item.action}-${index}`} className="border-t">
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                        {timeLabel(item.at)}
                      </td>
                      <td className="py-2 pr-3">{item.memberName}</td>
                      <td className="py-2 pr-3">{item.status || actionLabel(item.action)}</td>
                      <td className="py-2 pr-3">{item.bookTitle}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{item.accessionNumber || '—'}</td>
                      <td className="py-2">{item.staffName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Refreshes every 30 seconds while this tab is open.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <HeartPulse className="h-4 w-4 text-rose-500" />
                Library Health
              </h2>
              <p className="text-sm text-slate-500">Overall library performance and usage</p>
            </div>
            <label className="text-xs text-slate-500">
              <span className="sr-only">Health period</span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
              >
                {PERIODS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {dashboard.isLoading ? (
            <p className="text-sm text-slate-500">Loading health score…</p>
          ) : health ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <CircularProgress
                  value={health.overall ?? 0}
                  label={health.overall === null ? '—' : `${health.overall}%`}
                  sublabel="Overall Score"
                  color={health.overall === null ? '#94A3B8' : '#2563EB'}
                />
              </div>
              <p className="flex items-start gap-1 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The overall score averages the available components. Collection coverage is 25%,
                circulation 25%, digital engagement 15%, overdue control 20%, and weekly engagement
                15%. A component with no source data is left out of the average.
              </p>
              {health.components.map((item) => (
                <HealthBar key={item.key} item={item} />
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {actions.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Quick Actions</h2>
          <p className="mb-3 text-sm text-slate-500">Common library operations</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {actions.map((action) => (
              <QuickAction key={action.href} {...action} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Needs Attention
              </h2>
              <p className="text-sm text-slate-500">Items that require your action</p>
            </div>
            <Link
              href="/admin/library/collection-reports"
              className="text-sm font-medium text-blue-700"
            >
              View All
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <AttentionCard
              href="/admin/library/collection-reports?report=missing-accession"
              label="Missing Accession No."
              value={d ? attention?.missingAccession : undefined}
              hint="Books without an accession number"
              alert={(attention?.missingAccession ?? 0) > 0}
            />
            <AttentionCard
              href="/admin/library/collection-reports?report=duplicates"
              label="Duplicate Accession No."
              value={d ? attention?.duplicateGroups : undefined}
              hint="Accession numbers used by more than one copy"
              alert={(attention?.duplicateGroups ?? 0) > 0}
            />
            <AttentionCard
              href="/admin/library/collection-reports?report=overdue"
              label="Overdue Books"
              value={d?.overdueLoans}
              hint="Books not yet returned"
              alert={(d?.overdueLoans ?? 0) > 0}
            />
            <AttentionCard
              href="/admin/library/barcodes?printStatus=LOCAL_UNPRINTED"
              label="Unprinted Barcode Labels"
              value={d ? attention?.unprintedLocal : undefined}
              hint={
                attention?.printHistoryUnknown
                  ? `${num(attention.printHistoryUnknown)} imported copies have no print record in this ERP`
                  : 'Copies added here whose labels are not confirmed'
              }
              alert={(attention?.unprintedLocal ?? 0) > 0}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Collection by Department</h2>
              <p className="text-sm text-slate-500">Top departments by book count</p>
            </div>
            <Link
              href="/admin/library/collection-reports?report=department-summary"
              className="text-sm font-medium text-blue-700"
            >
              View Detailed Report
            </Link>
          </div>
          {departmentRows.length === 0 ? (
            <p className="py-8 text-sm text-slate-500">No physical copies are registered.</p>
          ) : (
            <ul className="space-y-3">
              {departmentRows.map((row) => (
                <li key={`${row.department}-${row.departmentId ?? 'none'}`}>
                  <Link
                    href={
                      row.department === 'Unassigned'
                        ? '/admin/library/collection-reports?report=unmapped'
                        : row.departmentId
                          ? `/admin/library/collection-reports?report=department-detail&departmentId=${row.departmentId}`
                          : '/admin/library/collection-reports?report=department-summary'
                    }
                    className="block"
                  >
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-700">{row.department}</span>
                      <span className="font-medium tabular-nums">{num(row.copies)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.max(4, (row.copies / maxCopies) * 100)}%` }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <Printer className="h-3.5 w-3.5" />
        Counts use the server clock for today. A confirmed barcode is a closed browser print dialog,
        not proof that the label left the printer.
      </p>

      <LibraryKnowledgeAssistant />
    </div>
  );
}

function chartRows(
  rows: Array<{
    departmentId: string | null;
    department: string;
    copies: number;
    percent: number;
  }>,
) {
  const top = rows.slice(0, 6);
  const unassigned = rows.find((row) => row.department === 'Unassigned');
  if (unassigned && !top.some((row) => row.department === 'Unassigned')) {
    return [...top.slice(0, 5), unassigned];
  }
  return top;
}
