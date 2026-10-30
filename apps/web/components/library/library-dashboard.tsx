'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  Copy,
  Info,
  Monitor,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CircularProgress } from '@/components/dashboard/command-center-ui';
import { LibraryKnowledgeAssistant } from '@/components/library/library-knowledge-assistant';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useLibraryRealtime } from '@/hooks/use-library-realtime';
import { usePermissions } from '@/hooks/use-permissions';
import {
  fetchLibraryDashboard,
  fetchLibraryDashboardActivity,
  fetchLibraryDashboardUsage,
} from '@/services/library';
import type { LibraryHealthComponent } from '@/types/library';
import { cn } from '@/utils/cn';

type Period = 'today' | 'week' | 'month';
type ActivityAction = 'ISSUE' | 'RETURN' | 'RENEW' | 'RESERVE';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'month', label: 'Last 30 Days' },
];

const HEALTH_DOT: Record<string, string> = {
  coverage: 'bg-amber-400',
  circulation: 'bg-blue-500',
  digital: 'bg-violet-500',
  overdueControl: 'bg-emerald-500',
  engagement: 'bg-orange-400',
};

function num(value?: number | null) {
  if (value == null) return '—';
  return value.toLocaleString('en-IN');
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function changeLabel(value?: number | null) {
  if (value == null) return null;
  const text = `${value > 0 ? '+' : ''}${value}%`;
  return { text, up: value >= 0 };
}

function StatCard({
  label,
  value,
  hint,
  change,
  changeTitle,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  change?: { text: string; up: boolean } | null;
  changeTitle?: string;
  icon: LucideIcon;
  href?: string;
  tone: string;
}) {
  const body = (
    <>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="flex items-baseline gap-2 text-2xl font-semibold tracking-tight text-slate-900">
          {value}
          {change ? (
            <span
              title={changeTitle}
              className={cn(
                'text-xs font-medium',
                change.up ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {change.text}
            </span>
          ) : null}
        </p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
    </>
  );
  const className =
    'flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={cn(className, 'transition hover:border-blue-200')}>
      {body}
    </Link>
  );
}

function actionChip(action: string) {
  if (action === 'ISSUE') return 'bg-blue-50 text-blue-700';
  if (action === 'RETURN') return 'bg-emerald-50 text-emerald-700';
  if (action === 'RENEW') return 'bg-violet-50 text-violet-700';
  if (action === 'RESERVE') return 'bg-orange-50 text-orange-700';
  return 'bg-slate-100 text-slate-600';
}

function actionText(action: string) {
  if (action === 'ISSUE') return 'Issued';
  if (action === 'RETURN') return 'Returned';
  if (action === 'RENEW') return 'Renewed';
  if (action === 'RESERVE') return 'Reserved';
  return action;
}

export function LibraryDashboard() {
  const enabled = useAuthQueryEnabled();
  const { canAny } = usePermissions();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [activityAction, setActivityAction] = useState<ActivityAction | ''>('');
  const [usageDays, setUsageDays] = useState<7 | 30>(7);
  const [usageFrom, setUsageFrom] = useState('');
  const [usageTo, setUsageTo] = useState('');
  const [topDays, setTopDays] = useState<7 | 30>(7);
  const customUsage = Boolean(usageFrom && usageTo);

  const dashboard = useQuery({
    queryKey: ['library', 'dashboard', period],
    queryFn: () => fetchLibraryDashboard(period),
    enabled,
  });
  const activityPoll = useQuery({
    queryKey: ['library', 'dashboard', 'activity', activityAction || 'all'],
    queryFn: () => fetchLibraryDashboardActivity(12, 'today', activityAction || undefined),
    enabled,
    refetchInterval: () => (document.hidden ? false : 30_000),
  });
  const usage = useQuery({
    queryKey: [
      'library',
      'dashboard',
      'usage',
      customUsage ? usageFrom : usageDays,
      customUsage ? usageTo : '',
    ],
    queryFn: () =>
      fetchLibraryDashboardUsage(
        customUsage ? { from: usageFrom, to: usageTo } : { days: usageDays },
      ),
    enabled,
  });
  const topBooks = useQuery({
    queryKey: ['library', 'dashboard', 'top-books', topDays],
    queryFn: () => fetchLibraryDashboardUsage({ days: topDays }),
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
  const digitalTotal =
    d == null ? null : (d.digitalViewsToday ?? 0) + (d.digitalDownloadsToday ?? 0);
  const canCirculate = canAny('library:circulate', 'library:manage');
  const canRead = canAny('library:read', 'library:manage', 'library:circulate');
  const canManage = canAny('library:manage');
  const canReport = canAny('library:reports', 'library:manage');
  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const actions = [
    canCirculate
      ? {
          href: '/admin/library/circulation?tab=issue',
          icon: BookOpen,
          title: 'Issue Book',
          tone: 'bg-blue-50 text-blue-700',
        }
      : null,
    canCirculate
      ? {
          href: '/admin/library/circulation?tab=return',
          icon: RotateCcw,
          title: 'Return Book',
          tone: 'bg-orange-50 text-orange-700',
        }
      : null,
    canCirculate
      ? {
          href: '/admin/library/circulation?tab=renew',
          icon: RefreshCw,
          title: 'Renew Book',
          tone: 'bg-emerald-50 text-emerald-700',
        }
      : null,
    canRead
      ? {
          href: '/admin/library/catalogue',
          icon: Search,
          title: 'Search Catalogue',
          tone: 'bg-violet-50 text-violet-700',
        }
      : null,
    canManage
      ? {
          href: '/admin/library/accession',
          icon: Plus,
          title: 'Add New Book',
          tone: 'bg-sky-50 text-sky-700',
        }
      : null,
    canRead
      ? {
          href: '/admin/library/members',
          icon: Users,
          title: 'View Members',
          tone: 'bg-rose-50 text-rose-700',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  function refresh() {
    void dashboard.refetch();
    void activityPoll.refetch();
    void usage.refetch();
    void topBooks.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Library Dashboard</h1>
            <p className="text-sm text-slate-500">
              Library operations, usage statistics and knowledge centre overview.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {todayLabel}
          </span>
          <Button variant="outline" disabled={dashboard.isFetching} onClick={refresh}>
            <RefreshCw className={cn('mr-2 h-4 w-4', dashboard.isFetching && 'animate-spin')} />
            Refresh
          </Button>
          {canReport ? (
            <Button asChild>
              <Link href="/admin/library/reports">View Reports</Link>
            </Button>
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total Book Copies"
          value={num(d?.totalBooks)}
          change={changeLabel(d?.copiesGrowth)}
          changeTitle="Copies with an acquisition date in the last 30 days, compared with dated stock before that."
          hint="Total physical book copies"
          icon={Copy}
          href="/admin/library/collection-reports?report=total-copies"
          tone="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Unique Titles"
          value={num(d?.totalTitles)}
          change={changeLabel(d?.titlesGrowth)}
          changeTitle="Titles whose first dated copy was acquired in the last 30 days, compared with titles that already had a dated copy."
          hint="Different book titles"
          icon={BookOpen}
          href="/admin/library/collection-reports?report=total-titles"
          tone="bg-emerald-50 text-emerald-700"
        />
        <StatCard
          label="Issued Today"
          value={num(d?.issuedToday)}
          change={changeLabel(d?.issuedChange)}
          changeTitle="Compared with yesterday's successful issues."
          hint="Books issued today"
          icon={BookOpen}
          href={canCirculate ? '/admin/library/circulation?tab=issue' : undefined}
          tone="bg-violet-50 text-violet-700"
        />
        <StatCard
          label="Returned Today"
          value={num(d?.returnedToday)}
          change={changeLabel(d?.returnedChange)}
          changeTitle="Compared with yesterday's returns."
          hint="Books returned today"
          icon={RotateCcw}
          href={canCirculate ? '/admin/library/circulation?tab=return' : undefined}
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
          label="Digital Resource Views"
          value={num(digitalTotal)}
          hint={
            d && d.digitalAssets === 0 && digitalTotal === 0
              ? 'No published digital resources'
              : `${num(d?.digitalViewsToday)} views and ${num(d?.digitalDownloadsToday)} downloads today`
          }
          icon={Monitor}
          href="/admin/library/digital"
          tone="bg-sky-50 text-sky-700"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Library Activity</h2>
              <p className="text-sm text-slate-500">Today's issue, return and renewal activity.</p>
            </div>
            {canCirculate ? (
              <Link
                href="/admin/library/circulation?tab=history"
                className="text-sm font-medium text-blue-700"
              >
                View all transactions
              </Link>
            ) : null}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ['', `All (${allCount})`],
                ['ISSUE', `Issued (${counts?.issued ?? 0})`],
                ['RETURN', `Returned (${counts?.returned ?? 0})`],
                ['RENEW', `Renewed (${counts?.renewed ?? 0})`],
                ['RESERVE', `Reserved (${counts?.reserved ?? 0})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={label}
                type="button"
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm',
                  activityAction === key ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600',
                )}
                onClick={() => setActivityAction(key)}
              >
                {label}
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
            <p className="py-16 text-center text-sm text-slate-500">Loading activity…</p>
          ) : activity.length === 0 ? (
            <div className="py-10 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-medium text-slate-800">No matching activity today.</p>
              <p className="mt-1 text-sm text-slate-500">
                Issue, return, renewal and reservation records appear here after they are saved.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    {['Time', 'Member', 'Action', 'Book Title', 'Accession', 'Staff'].map(
                      (header) => (
                        <th key={header} className="py-2 pr-3 font-medium">
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activity.map((item, index) => (
                    <tr
                      key={`${item.at}-${item.action}-${item.accessionNumber ?? index}`}
                      className="border-t"
                    >
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-500">
                        {timeLabel(item.at)}
                      </td>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-800">{item.memberName}</p>
                        {item.memberCode ? (
                          <p className="text-xs text-slate-500">{item.memberCode}</p>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            actionChip(item.action),
                          )}
                        >
                          {item.status || actionText(item.action)}
                        </span>
                      </td>
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
            Showing the latest {activity.length} transaction{activity.length === 1 ? '' : 's'}.
            Refreshes every 30 seconds while this page is open.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-2">
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
              {health.components.map((item) => (
                <HealthRow key={item.key} item={item} />
              ))}
              <p className="flex items-start gap-1 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                The overall score averages the components that have a source. Weights are collection
                25%, circulation 25%, digital 15%, overdue control 20%, and member engagement 15%. A
                missing source is left out. Overdue control uses loans that are open now, not the
                selected period.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Usage Statistics</h2>
            <div className="flex flex-wrap gap-1">
              {([7, 30] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  className={cn(
                    'rounded-lg px-2 py-1 text-xs',
                    !customUsage && usageDays === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-50 text-slate-600',
                  )}
                  onClick={() => {
                    setUsageDays(days);
                    setUsageFrom('');
                    setUsageTo('');
                  }}
                >
                  Last {days} Days
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Input
              type="date"
              aria-label="Usage from"
              value={usageFrom}
              onChange={(event) => setUsageFrom(event.target.value)}
            />
            <Input
              type="date"
              aria-label="Usage to"
              value={usageTo}
              onChange={(event) => setUsageTo(event.target.value)}
            />
          </div>
          {usage.isError ? (
            <QueryErrorPanel
              title="Unable to load usage"
              error={usage.error}
              onRetry={() => void usage.refetch()}
              isRetrying={usage.isFetching}
            />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage.data?.series ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="issued" name="Books Issued" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  <Bar
                    dataKey="returned"
                    name="Books Returned"
                    fill="#22C55E"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Membership registration dates are not stored, so new members are not on this chart.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Top Books (Issued)</h2>
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
              aria-label="Top books period"
              value={topDays}
              onChange={(event) => setTopDays(Number(event.target.value) as 7 | 30)}
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
          {topBooks.isError ? (
            <QueryErrorPanel
              title="Unable to load top books"
              error={topBooks.error}
              onRetry={() => void topBooks.refetch()}
              isRetrying={topBooks.isFetching}
            />
          ) : !topBooks.data?.topBooks.length ? (
            <p className="py-10 text-center text-sm text-slate-500">
              {topBooks.isLoading ? 'Loading issues…' : 'No books were issued in this period.'}
            </p>
          ) : (
            <ol className="space-y-3">
              {topBooks.data.topBooks.map((book, index) => (
                <li key={book.bookId}>
                  <Link
                    href={`/admin/library/catalogue?search=${encodeURIComponent(book.title)}`}
                    className="block"
                  >
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <span className="w-5 text-slate-400">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                        {book.title}
                      </span>
                      <span className="tabular-nums text-slate-600">{book.issues}</span>
                    </div>
                    <div className="ml-7 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${book.share}%` }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        {actions.length ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-semibold text-slate-900">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 px-2 py-4 text-center text-sm font-medium text-slate-700 hover:border-blue-200"
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl',
                      action.tone,
                    )}
                  >
                    <action.icon className="h-5 w-5" />
                  </span>
                  {action.title}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <p className="text-xs text-slate-400">
        Today follows the server clock. A change beside copies or titles is the last 30 days of
        dated stock. A change beside issues or returns is compared with yesterday, and only when
        yesterday had a count.
      </p>
      <LibraryKnowledgeAssistant />
    </div>
  );
}

function HealthRow({ item }: { item: LibraryHealthComponent }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 text-slate-700" title={item.formula}>
          <span
            className={cn('h-2.5 w-2.5 rounded-full', HEALTH_DOT[item.key] ?? 'bg-slate-300')}
          />
          {item.label}
        </span>
        <span className="font-medium tabular-nums text-slate-900">
          {item.score === null ? 'Unavailable' : `${item.score}%`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-400"
          style={{ width: `${item.score ?? 0}%` }}
        />
      </div>
    </div>
  );
}
