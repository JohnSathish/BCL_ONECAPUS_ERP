'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  Bookmark,
  CalendarClock,
  Info,
  Library,
  Monitor,
  Plus,
  RefreshCw,
  RotateCcw,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

import { CircularProgress } from '@/components/dashboard/command-center-ui';
import { LibraryKnowledgeAssistant } from '@/components/library/library-knowledge-assistant';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useLibraryRealtime } from '@/hooks/use-library-realtime';
import { usePermissions } from '@/hooks/use-permissions';
import {
  fetchLibraryDashboard,
  fetchLibraryDashboardActivity,
  fetchLibraryDashboardUsage,
} from '@/services/library';
import type { LibraryCollectionSlice, LibraryHealthComponent } from '@/types/library';
import { cn } from '@/utils/cn';

type Period = 'today' | 'week' | 'month' | 'year';
type ActivityAction = 'ISSUE' | 'RETURN' | 'RENEW' | 'RESERVE';
type Trend = 7 | 30 | 90 | 'year';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
];

const TRENDS: { id: Trend; label: string }[] = [
  { id: 7, label: 'Last 7 Days' },
  { id: 30, label: 'Last 30 Days' },
  { id: 90, label: 'Last 3 Months' },
  { id: 'year', label: 'This Year' },
];

const SLICE_COLOR: Record<LibraryCollectionSlice['key'], string> = {
  textbooks: '#3B82F6',
  reference: '#22C55E',
  journals: '#8B5CF6',
  other: '#F59E0B',
};

const HEALTH_TONE: Record<string, { icon: LucideIcon; tone: string; bar: string }> = {
  coverage: { icon: Library, tone: 'text-amber-500', bar: 'bg-amber-400' },
  circulation: { icon: RefreshCw, tone: 'text-blue-500', bar: 'bg-blue-500' },
  digital: { icon: Monitor, tone: 'text-violet-500', bar: 'bg-violet-500' },
  overdueControl: { icon: AlertTriangle, tone: 'text-emerald-500', bar: 'bg-emerald-500' },
  engagement: { icon: Users, tone: 'text-rose-500', bar: 'bg-rose-400' },
};

function num(value?: number | null) {
  if (value == null) return '—';
  return value.toLocaleString('en-IN');
}

function useCountUp(value?: number | null) {
  const [shown, setShown] = useState(value ?? 0);
  useEffect(() => {
    if (value == null) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 650);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return value == null ? null : shown;
}

function changeLabel(value?: number | null) {
  if (value == null) return null;
  return `${value > 0 ? '+' : ''}${value}%`;
}

function actionText(action: string) {
  if (action === 'ISSUE') return 'Issued';
  if (action === 'RETURN') return 'Returned';
  if (action === 'RENEW') return 'Renewed';
  if (action === 'RESERVE') return 'Reserved';
  return action;
}

function actionChip(action: string) {
  if (action === 'ISSUE') return 'bg-emerald-50 text-emerald-700';
  if (action === 'RETURN') return 'bg-orange-50 text-orange-700';
  if (action === 'RENEW') return 'bg-violet-50 text-violet-700';
  if (action === 'RESERVE') return 'bg-rose-50 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

export function LibraryDashboard() {
  const enabled = useAuthQueryEnabled();
  const router = useRouter();
  const { canAny } = usePermissions();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [activityAction, setActivityAction] = useState<ActivityAction | ''>('');
  const [trend, setTrend] = useState<Trend>(7);

  const dashboard = useQuery({
    queryKey: ['library', 'dashboard', period],
    queryFn: () => fetchLibraryDashboard(period),
    enabled,
  });
  const activityPoll = useQuery({
    queryKey: ['library', 'dashboard', 'activity', activityAction || 'all'],
    queryFn: () => fetchLibraryDashboardActivity(8, 'today', activityAction || undefined),
    enabled,
    refetchInterval: () => (document.hidden ? false : 30_000),
  });
  const returnedRecent = useQuery({
    queryKey: ['library', 'dashboard', 'activity', 'returned-recent'],
    queryFn: () => fetchLibraryDashboardActivity(5, 'recent', 'RETURN'),
    enabled,
    refetchInterval: () => (document.hidden ? false : 30_000),
  });
  const usage = useQuery({
    queryKey: ['library', 'dashboard', 'usage', trend],
    queryFn: () =>
      trend === 'year'
        ? fetchLibraryDashboardUsage({ span: 'year' })
        : fetchLibraryDashboardUsage({ days: trend }),
    enabled,
  });

  const onCirculationActivity = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['library', 'dashboard'] });
  }, [qc]);
  useLibraryRealtime({ onCirculationActivity });

  const d = dashboard.data;
  const health = d?.healthScore;
  const activity = activityPoll.data ?? d?.activity ?? [];
  const counts = d?.activityCounts;
  const allCount =
    (counts?.issued ?? 0) +
    (counts?.returned ?? 0) +
    (counts?.renewed ?? 0) +
    (counts?.reserved ?? 0);
  const canCirculate = canAny('library:circulate', 'library:manage');
  const canRead = canAny('library:read', 'library:manage', 'library:circulate');
  const canManage = canAny('library:manage');
  const canReport = canAny('library:reports', 'library:manage');
  const canBarcode = canAny(
    'library:manage',
    'library:circulate',
    'library:reports',
    'library:settings',
  );
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const slices = d?.collection?.slices ?? [];
  const pie = slices.filter((slice) => slice.copies > 0);

  function refresh() {
    void dashboard.refetch();
    void activityPoll.refetch();
    void returnedRecent.refetch();
    void usage.refetch();
  }

  const actions = [
    canCirculate
      ? {
          href: '/admin/library/circulation?tab=issue',
          icon: BookOpen,
          title: 'Issue Book',
          tone: 'from-blue-50 to-blue-100 text-blue-700',
        }
      : null,
    canCirculate
      ? {
          href: '/admin/library/circulation?tab=return',
          icon: RotateCcw,
          title: 'Return Book',
          tone: 'from-orange-50 to-orange-100 text-orange-700',
        }
      : null,
    canCirculate
      ? {
          href: '/admin/library/circulation?tab=renew',
          icon: RefreshCw,
          title: 'Renew Book',
          tone: 'from-emerald-50 to-emerald-100 text-emerald-700',
        }
      : null,
    canCirculate
      ? {
          href: '/admin/library/reservations',
          icon: Bookmark,
          title: 'Reserve Book',
          tone: 'from-rose-50 to-rose-100 text-rose-700',
        }
      : null,
    canRead
      ? {
          href: '/admin/library/members',
          icon: Plus,
          title: 'Add Member',
          tone: 'from-amber-50 to-amber-100 text-amber-700',
        }
      : null,
    canBarcode
      ? {
          href: '/admin/library/barcodes',
          icon: Library,
          title: 'Print Barcode',
          tone: 'from-indigo-50 to-indigo-100 text-indigo-700',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#155EEF] text-white shadow-sm">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Library Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              Library operations, usage statistics and knowledge centre overview.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <CalendarClock className="h-4 w-4 text-slate-400" />
            {todayLabel}
          </span>
          <button
            type="button"
            disabled={dashboard.isFetching}
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={cn('h-4 w-4', dashboard.isFetching && 'animate-spin')} />
            Refresh
          </button>
          {canReport ? (
            <Link
              href="/admin/library/reports"
              className="inline-flex items-center rounded-xl bg-[#155EEF] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
            >
              View Reports
            </Link>
          ) : null}
        </div>
      </div>

      {dashboard.isError ? (
        <QueryErrorPanel
          title="Unable to load the library dashboard"
          error={dashboard.error}
          onRetry={() => void dashboard.refetch()}
          isRetrying={dashboard.isFetching}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi
          label="Total Book Copies"
          hint="Total physical book copies"
          value={d?.totalBooks}
          change={changeLabel(d?.copiesGrowth)}
          changeTitle="Copies with an acquisition date in the last 30 days, compared with dated stock before that."
          icon={Library}
          href="/admin/library/collection-reports?report=total-copies"
          className="bg-gradient-to-br from-[#2563EB] to-[#1D4ED8]"
          loading={dashboard.isLoading}
        />
        <Kpi
          label="Unique Titles"
          hint="Different book titles"
          value={d?.totalTitles}
          change={changeLabel(d?.titlesGrowth)}
          changeTitle="Titles whose first dated copy was acquired in the last 30 days."
          icon={BookOpen}
          href="/admin/library/collection-reports?report=total-titles"
          className="bg-gradient-to-br from-[#16A34A] to-[#15803D]"
          loading={dashboard.isLoading}
        />
        <Kpi
          label="Issued Today"
          hint="Books issued today"
          value={d?.issuedToday}
          change={changeLabel(d?.issuedChange)}
          changeTitle="Compared with yesterday's successful issues."
          icon={BookOpen}
          href={canCirculate ? '/admin/library/circulation?tab=issue' : undefined}
          className="bg-gradient-to-br from-[#7C3AED] to-[#6D28D9]"
          loading={dashboard.isLoading}
        />
        <Kpi
          label="Returned Today"
          hint="Books returned today"
          value={d?.returnedToday}
          change={changeLabel(d?.returnedChange)}
          changeTitle="Compared with yesterday's returns."
          icon={RotateCcw}
          href={canCirculate ? '/admin/library/circulation?tab=return' : undefined}
          className="bg-gradient-to-br from-[#F97316] to-[#EA580C]"
          loading={dashboard.isLoading}
        />
        <Kpi
          label="Overdue Books"
          hint="Books not yet returned"
          value={d?.overdueLoans}
          icon={AlertTriangle}
          href="/admin/library/collection-reports?report=overdue"
          className="col-span-2 bg-gradient-to-br from-[#EF4444] to-[#DC2626] xl:col-span-1"
          loading={dashboard.isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] xl:col-span-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Library Activity</h2>
              <p className="text-sm text-slate-500">
                Today&apos;s issue, return, renewal and reservation activity.
              </p>
            </div>
            {canCirculate ? (
              <Link
                href="/admin/library/circulation?tab=history"
                className="text-sm font-medium text-[#155EEF]"
              >
                View All Transactions
              </Link>
            ) : null}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ['', 'All', allCount, 'bg-[#155EEF] text-white'],
                ['ISSUE', 'Issued', counts?.issued ?? 0, 'bg-emerald-600 text-white'],
                ['RETURN', 'Returned', counts?.returned ?? 0, 'bg-orange-500 text-white'],
                ['RENEW', 'Renewed', counts?.renewed ?? 0, 'bg-violet-600 text-white'],
                ['RESERVE', 'Reserved', counts?.reserved ?? 0, 'bg-rose-500 text-white'],
              ] as const
            ).map(([key, label, count, activeTone]) => (
              <button
                key={label}
                type="button"
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium',
                  activityAction === key
                    ? activeTone
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
                onClick={() => setActivityAction(key)}
              >
                {label} ({count})
              </button>
            ))}
          </div>
          {activityPoll.isError ? (
            <QueryErrorPanel
              title="Unable to load activity"
              error={activityPoll.error}
              onRetry={() => void activityPoll.refetch()}
              isRetrying={activityPoll.isFetching}
            />
          ) : activityPoll.isLoading && !activity.length ? (
            <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
          ) : activity.length === 0 ? (
            <EmptyActivity />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    {[
                      'Book Title',
                      'Accession Number',
                      'Member Name',
                      'Transaction Type',
                      'Transaction Date',
                      'Status',
                    ].map((header) => (
                      <th key={header} className="py-2 pr-3 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item, index) => (
                    <tr
                      key={`${item.at}-${item.action}-${item.accessionNumber ?? index}`}
                      className="border-t border-slate-100"
                    >
                      <td className="max-w-[180px] truncate py-2 pr-3 font-medium text-slate-800">
                        {item.bookTitle}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{item.accessionNumber || '—'}</td>
                      <td className="py-2 pr-3">{item.memberName}</td>
                      <td className="py-2 pr-3">{actionText(item.action)}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-500">
                        {new Date(item.at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            actionChip(item.action),
                          )}
                        >
                          {item.status || actionText(item.action)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Refreshes every 30 seconds while this page is open.
          </p>
        </section>

        <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] xl:col-span-2">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Library Health</h2>
              <p className="text-sm text-slate-500">Overall library performance and usage.</p>
            </div>
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
              aria-label="Health period"
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              {PERIODS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {dashboard.isLoading ? (
            <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
          ) : health ? (
            <div className="space-y-3">
              <div className="flex justify-center">
                <CircularProgress
                  value={health.overall ?? 0}
                  size={148}
                  stroke={12}
                  label={health.overall === null ? '—' : `${health.overall.toFixed(1)}%`}
                  sublabel="Overall Score"
                  color={health.overall === null ? '#94A3B8' : '#155EEF'}
                />
              </div>
              {health.components.map((item) => (
                <HealthRow key={item.key} item={item} />
              ))}
              <p
                className="flex items-start gap-1 text-xs text-slate-500"
                title="Weighted average of the components that have a source. Collection 25%, circulation 25%, digital 15%, overdue control 20%, member engagement 15%. A missing source is left out."
              >
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Overall score uses only components with a source. Weights: collection 25%,
                circulation 25%, digital 15%, overdue control 20%, engagement 15%.
              </p>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              Health score is unavailable until the library figures load.
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <h2 className="font-semibold text-slate-900">Book Collection Overview</h2>
          {dashboard.isLoading ? (
            <div className="mt-4 h-52 animate-pulse rounded-xl bg-slate-100" />
          ) : !pie.length ? (
            <p className="py-16 text-center text-sm text-slate-500">
              No physical copies are registered.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-[160px_minmax(0,1fr)] items-center gap-2">
              <div className="relative h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pie}
                      dataKey="copies"
                      nameKey="label"
                      innerRadius={48}
                      outerRadius={68}
                      paddingAngle={2}
                      stroke="none"
                      onClick={(slice) => {
                        const categoryId =
                          slice && typeof slice === 'object' && 'categoryId' in slice
                            ? slice.categoryId
                            : null;
                        const href =
                          typeof categoryId === 'string'
                            ? `/admin/library/catalogue?categoryId=${encodeURIComponent(categoryId)}`
                            : '/admin/library/catalogue';
                        router.push(href);
                      }}
                    >
                      {pie.map((slice) => (
                        <Cell
                          key={slice.key}
                          fill={SLICE_COLOR[slice.key]}
                          className="cursor-pointer"
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => num(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-semibold text-slate-900">
                    {num(d?.collection?.totalCopies)}
                  </span>
                  <span className="text-[10px] text-slate-500">Total Books</span>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                {slices.map((slice) => (
                  <li key={slice.key}>
                    <Link
                      href={
                        slice.categoryId
                          ? `/admin/library/catalogue?categoryId=${encodeURIComponent(slice.categoryId)}`
                          : '/admin/library/catalogue'
                      }
                      className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-slate-50"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: SLICE_COLOR[slice.key] }}
                      />
                      <span className="min-w-0 flex-1 truncate text-slate-700">{slice.label}</span>
                      <span className="tabular-nums text-slate-500">{slice.percent}%</span>
                      <span className="w-14 text-right tabular-nums font-medium text-slate-800">
                        {num(slice.copies)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Circulation Trend</h2>
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
              aria-label="Circulation trend period"
              value={String(trend)}
              onChange={(event) => {
                const value = event.target.value;
                setTrend(value === 'year' ? 'year' : (Number(value) as 7 | 30 | 90));
              }}
            >
              {TRENDS.map((item) => (
                <option key={item.label} value={String(item.id)}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-2 flex gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-[#3B82F6]" /> Issued
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-[#22C55E]" /> Returned
            </span>
          </div>
          {usage.isError ? (
            <QueryErrorPanel
              title="Unable to load circulation"
              error={usage.error}
              onRetry={() => void usage.refetch()}
              isRetrying={usage.isFetching}
            />
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage.data?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                  <Tooltip />
                  <Bar dataKey="issued" name="Issued" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="returned" name="Returned" fill="#22C55E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {actions.length ? (
          <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <h2 className="mb-3 font-semibold text-slate-900">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br px-2 py-4 text-center text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-md',
                    action.tone,
                  )}
                >
                  <action.icon className="h-6 w-6" />
                  {action.title}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <h2 className="mb-3 font-semibold text-slate-900">Most borrowed</h2>
          {!usage.data?.topBooks.length ? (
            <p className="py-6 text-sm text-slate-500">
              {usage.isLoading ? 'Loading issues…' : 'No books were issued in this period.'}
            </p>
          ) : (
            <ol className="space-y-2">
              {usage.data.topBooks.map((book, index) => (
                <li key={book.bookId}>
                  <Link
                    href={`/admin/library/catalogue?search=${encodeURIComponent(book.title)}`}
                    className="block text-sm"
                  >
                    <div className="mb-1 flex gap-2">
                      <span className="w-4 text-slate-400">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                        {book.title}
                      </span>
                      <span className="tabular-nums text-slate-600">{book.issues}</span>
                    </div>
                    <div className="ml-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#155EEF]"
                        style={{ width: `${book.share}%` }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <h2 className="mb-3 font-semibold text-slate-900">Books requiring attention</h2>
          <ul className="space-y-2 text-sm">
            <AttentionLink
              href="/admin/library/barcodes"
              label="Missing accession number"
              value={d?.attention?.missingAccession}
            />
            <AttentionLink
              href="/admin/library/barcodes"
              label="Duplicate accession groups"
              value={d?.attention?.duplicateGroups}
            />
            <AttentionLink
              href="/admin/library/barcodes"
              label="Not yet printed"
              value={d?.attention?.unprintedLocal}
            />
            <AttentionLink
              href="/admin/library/collection-reports?report=overdue"
              label="Overdue loans"
              value={d?.overdueLoans}
            />
          </ul>
        </section>
        <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <h2 className="mb-3 font-semibold text-slate-900">Recently returned</h2>
          {returnedRecent.isError ? (
            <p className="text-sm text-slate-500">Returned books could not be loaded.</p>
          ) : !returnedRecent.data?.length ? (
            <p className="py-6 text-sm text-slate-500">
              {returnedRecent.isLoading ? 'Loading returns…' : 'No returns are recorded yet.'}
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {returnedRecent.data.map((item, index) => (
                <li key={`${item.at}-${index}`} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">
                      {item.bookTitle}
                    </span>
                    <span className="text-xs text-slate-500">{item.memberName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(item.at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <LibraryKnowledgeAssistant />
    </div>
  );
}

function Kpi({
  label,
  hint,
  value,
  change,
  changeTitle,
  icon: Icon,
  href,
  className,
  loading,
}: {
  label: string;
  hint: string;
  value?: number | null;
  change?: string | null;
  changeTitle?: string;
  icon: LucideIcon;
  href?: string;
  className: string;
  loading: boolean;
}) {
  const shown = useCountUp(loading ? null : value);
  const body = (
    <div
      className={cn(
        'relative overflow-hidden rounded-[18px] p-4 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white/90">{label}</p>
        <Icon className="h-5 w-5 text-white/80" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">
        {loading || shown == null ? '—' : shown.toLocaleString('en-IN')}
        {change ? (
          <span title={changeTitle} className="ml-2 text-xs font-medium text-white/90">
            {change}
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-white/80">{hint}</p>
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block transition hover:-translate-y-0.5">
      {body}
    </Link>
  );
}

function HealthRow({ item }: { item: LibraryHealthComponent }) {
  const tone = HEALTH_TONE[item.key] ?? {
    icon: Monitor,
    tone: 'text-slate-400',
    bar: 'bg-slate-400',
  };
  const Icon = tone.icon;
  return (
    <div title={item.formula}>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 text-slate-700">
          <Icon className={cn('h-3.5 w-3.5', tone.tone)} />
          {item.label}
        </span>
        <span className="font-medium tabular-nums text-slate-900">
          {item.score === null ? 'Unavailable' : `${item.score}%`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full', tone.bar)}
          style={{ width: `${item.score ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function AttentionLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value?: number | null;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 hover:bg-slate-50"
      >
        <span className="text-slate-700">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">{num(value)}</span>
      </Link>
    </li>
  );
}

function EmptyActivity() {
  return (
    <div className="py-8 text-center">
      <svg viewBox="0 0 140 80" className="mx-auto h-16 w-28" aria-hidden>
        <rect x="18" y="28" width="28" height="36" rx="3" fill="#93C5FD" />
        <rect x="50" y="16" width="24" height="48" rx="3" fill="#6EE7B7" />
        <rect x="78" y="24" width="30" height="40" rx="3" fill="#FDBA74" />
        <path d="M108 18l8 6-8 6" fill="none" stroke="#FBBF24" strokeWidth="3" />
      </svg>
      <p className="mt-2 font-medium text-slate-800">No matching activity today.</p>
      <p className="mt-1 text-sm text-slate-500">
        Issue, return, renewal and reservation records appear here after they are saved.
      </p>
    </div>
  );
}
