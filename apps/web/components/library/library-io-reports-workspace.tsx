'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LogOut,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  User,
  Users,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useLibraryRealtime } from '@/hooks/use-library-realtime';
import { logoutClientSide } from '@/lib/auth/client-logout';
import { useRouter } from 'next/navigation';
import {
  downloadEntryExitExport,
  fetchEntryExitDepartments,
  fetchEntryExitFilters,
  fetchEntryExitHourly,
  fetchEntryExitInside,
  fetchEntryExitInsights,
  fetchEntryExitStudentHistory,
  fetchEntryExitSummary,
  fetchEntryExitVisits,
  fetchLibraryFines,
  fetchOverdueLoans,
  fetchLibraryReport,
} from '@/services/library';
import type { EntryExitPeriod, EntryExitVisitRow } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';
import { cn } from '@/utils/cn';

type ReportView =
  | 'detailed'
  | 'inside'
  | 'departments'
  | 'history'
  | 'overdue'
  | 'fines'
  | 'digital';

const PERIODS: { id: EntryExitPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Academic Year' },
  { id: 'custom', label: 'Custom Range' },
];

const EMPTY_FILTERS = {
  period: 'today' as EntryExitPeriod,
  from: '',
  to: '',
  departmentId: '',
  programId: '',
  semester: '',
  gender: 'ALL',
  memberType: 'ALL',
  visitStatus: 'ALL',
  timeRange: 'ALL',
  search: '',
  longStayMinutes: '180',
};

function durationNow(entryAt: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(entryAt).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function deltaText(pct: number | null) {
  if (pct == null) return 'No prior-period comparison';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}% compared with previous period`;
}

export function LibraryIoReportsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const enabled = useAuthQueryEnabled();
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [view, setView] = useState<ReportView>(
    searchParams.get('view') === 'inside' ? 'inside' : 'detailed',
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState('entryAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportError, setExportError] = useState('');
  const [historyStudentId, setHistoryStudentId] = useState<string | null>(null);
  const [deptFocus, setDeptFocus] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const params = useMemo(() => {
    const next: Record<string, string | number | undefined> = {
      period: applied.period,
      from: applied.period === 'custom' ? applied.from || undefined : undefined,
      to: applied.period === 'custom' ? applied.to || undefined : undefined,
      departmentId: applied.departmentId || undefined,
      programId: applied.programId || undefined,
      semester: applied.semester || undefined,
      gender: applied.gender,
      memberType: applied.memberType,
      visitStatus: applied.visitStatus,
      timeRange: applied.timeRange,
      search: applied.search || undefined,
      longStayMinutes: Number(applied.longStayMinutes) || 180,
      page,
      limit,
      sortBy,
      sortDir,
    };
    if (deptFocus) next.departmentId = deptFocus;
    return next;
  }, [applied, page, limit, sortBy, sortDir, deptFocus]);

  useLibraryRealtime({
    onOccupancy: () => {
      void qc.invalidateQueries({ queryKey: ['library', 'entry-exit'] });
    },
    onScanResult: () => {
      void qc.invalidateQueries({ queryKey: ['library', 'entry-exit'] });
    },
  });

  const filtersQ = useQuery({
    queryKey: ['library', 'entry-exit', 'filters'],
    queryFn: fetchEntryExitFilters,
    enabled,
  });
  const summaryQ = useQuery({
    queryKey: ['library', 'entry-exit', 'summary', params],
    queryFn: () => fetchEntryExitSummary(params),
    enabled,
  });
  const visitsQ = useQuery({
    queryKey: ['library', 'entry-exit', 'visits', params],
    queryFn: () => fetchEntryExitVisits(params),
    enabled: enabled && (view === 'detailed' || view === 'history'),
  });
  const insideQ = useQuery({
    queryKey: ['library', 'entry-exit', 'inside', applied],
    queryFn: () => fetchEntryExitInside(params),
    enabled,
    refetchInterval: 15_000,
  });
  const deptQ = useQuery({
    queryKey: ['library', 'entry-exit', 'departments', params],
    queryFn: () => fetchEntryExitDepartments(params),
    enabled,
  });
  const hourlyQ = useQuery({
    queryKey: ['library', 'entry-exit', 'hourly', params],
    queryFn: () => fetchEntryExitHourly(params),
    enabled,
  });
  const insightsQ = useQuery({
    queryKey: ['library', 'entry-exit', 'insights', params],
    queryFn: () => fetchEntryExitInsights(params),
    enabled,
  });
  const historyQ = useQuery({
    queryKey: ['library', 'entry-exit', 'history', historyStudentId, params],
    queryFn: () => fetchEntryExitStudentHistory(historyStudentId!, params),
    enabled: enabled && Boolean(historyStudentId),
  });
  const overdueQ = useQuery({
    queryKey: ['library', 'overdue'],
    queryFn: fetchOverdueLoans,
    enabled: enabled && view === 'overdue',
  });
  const finesQ = useQuery({
    queryKey: ['library', 'fines'],
    queryFn: () => fetchLibraryFines('ALL'),
    enabled: enabled && view === 'fines',
  });
  const digitalQ = useQuery({
    queryKey: ['library', 'report', 'digital'],
    queryFn: () => fetchLibraryReport('digital/downloads'),
    enabled: enabled && view === 'digital',
  });

  async function exportReport(format: 'xlsx' | 'csv' | 'pdf') {
    setExportError('');
    try {
      const blob = await downloadEntryExitExport(format, params);
      downloadBlob(blob, `library-entry-exit.${format === 'xlsx' ? 'xlsx' : format}`);
    } catch (err) {
      setExportError(apiErrorMessage(err, 'Could not export the report.'));
    }
  }

  const kpis = summaryQ.data?.kpis;
  const peak = hourlyQ.data?.peakHour ?? summaryQ.data?.peakHour;
  const totalPages = Math.max(1, Math.ceil((visitsQ.data?.total ?? 0) / limit));
  const loadError =
    summaryQ.isError || visitsQ.isError
      ? apiErrorMessage(summaryQ.error ?? visitsQ.error, 'Unable to load library reports.')
      : null;

  function openHistory(row: EntryExitVisitRow) {
    if (!row.studentId) return;
    setHistoryStudentId(row.studentId);
    setView('history');
  }

  function toggleSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir(key === 'name' || key === 'department' ? 'asc' : 'desc');
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0a0f1e] text-slate-100">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/10 bg-[#070b14] lg:flex">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-cyan-400" />
            <span className="text-sm font-bold">Library I/O</span>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          <Link
            href="/library-desk"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/library-desk"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <ScanLine className="h-4 w-4" />
            Live Entry/Exit
          </Link>
          <span className="flex items-center gap-3 rounded-lg bg-cyan-500/15 px-3 py-2.5 text-sm text-cyan-300">
            <BookOpen className="h-4 w-4" />
            Reports
          </span>
          <Link
            href="/admin/library/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </nav>
        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={() => logoutClientSide(router, { redirectTo: '/library-desk/login' })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d1324]/90 px-4 py-3">
          <div>
            <p className="text-xs text-slate-400">
              {summaryQ.data?.header.collegeName ?? 'Don Bosco College Tura'} · LIBRARY
            </p>
            <h1 className="text-lg font-bold tracking-tight">Library Reports</h1>
            <p className="text-xs text-slate-400">
              Analyze library usage, student visits, department activity, and entry/exit history.
            </p>
          </div>
          <div className="relative flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              onClick={() => setExportOpen((o) => !o)}
            >
              <Download className="mr-1 h-4 w-4" />
              Export
            </Button>
            {exportOpen ? (
              <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-white/10 bg-[#0d1324] p-2 shadow-xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => void exportReport('xlsx')}
                >
                  <FileSpreadsheet className="h-4 w-4 text-cyan-400" /> Excel
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => void exportReport('csv')}
                >
                  <FileText className="h-4 w-4 text-cyan-400" /> CSV
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => void exportReport('pdf')}
                >
                  <FileText className="h-4 w-4 text-cyan-400" /> PDF
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4 text-cyan-400" /> Print
                </button>
              </div>
            ) : null}
            <Link href="/library-desk" className="lg:hidden">
              <Button size="sm" variant="outline" className="border-white/10 bg-transparent">
                <ArrowLeft className="mr-1 h-4 w-4" /> Desk
              </Button>
            </Link>
          </div>
        </header>

        <main className="space-y-4 overflow-auto p-4 print:bg-white print:text-slate-900">
          {exportError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {exportError}
            </p>
          ) : null}
          {loadError ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {loadError}
            </p>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, period: p.id }))}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs',
                    draft.period === p.id
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-white/5 text-slate-400',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {draft.period === 'custom' ? (
                <>
                  <label className="text-xs text-slate-400">
                    From Date
                    <Input
                      type="date"
                      value={draft.from}
                      onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                      className="mt-1 border-white/10 bg-[#0a0f1e]"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    To Date
                    <Input
                      type="date"
                      value={draft.to}
                      onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                      className="mt-1 border-white/10 bg-[#0a0f1e]"
                    />
                  </label>
                </>
              ) : null}
              <label className="text-xs text-slate-400">
                Department
                <select
                  value={draft.departmentId}
                  onChange={(e) => setDraft((d) => ({ ...d, departmentId: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#0a0f1e] px-2 text-sm"
                >
                  <option value="">All</option>
                  {(filtersQ.data?.departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Course / Programme
                <select
                  value={draft.programId}
                  onChange={(e) => setDraft((d) => ({ ...d, programId: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#0a0f1e] px-2 text-sm"
                >
                  <option value="">All</option>
                  {(filtersQ.data?.programs ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Year / Semester
                <Input
                  value={draft.semester}
                  onChange={(e) => setDraft((d) => ({ ...d, semester: e.target.value }))}
                  placeholder="e.g. 3"
                  className="mt-1 border-white/10 bg-[#0a0f1e]"
                />
              </label>
              <label className="text-xs text-slate-400">
                Gender
                <select
                  value={draft.gender}
                  onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#0a0f1e] px-2 text-sm"
                >
                  <option value="ALL">All</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                User Type
                <select
                  value={draft.memberType}
                  onChange={(e) => setDraft((d) => ({ ...d, memberType: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#0a0f1e] px-2 text-sm"
                >
                  <option value="ALL">All</option>
                  <option value="STUDENT">Student</option>
                  <option value="STAFF">Staff</option>
                  <option value="VISITOR">Visitor</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Visit Status
                <select
                  value={draft.visitStatus}
                  onChange={(e) => setDraft((d) => ({ ...d, visitStatus: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#0a0f1e] px-2 text-sm"
                >
                  <option value="ALL">All</option>
                  <option value="INSIDE">Currently Inside</option>
                  <option value="EXITED">Exited</option>
                  <option value="INCOMPLETE">Incomplete</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Time Range
                <select
                  value={draft.timeRange}
                  onChange={(e) => setDraft((d) => ({ ...d, timeRange: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-[#0a0f1e] px-2 text-sm"
                >
                  <option value="ALL">All Day</option>
                  <option value="MORNING">Morning</option>
                  <option value="AFTERNOON">Afternoon</option>
                  <option value="EVENING">Evening</option>
                </select>
              </label>
              <label className="text-xs text-slate-400 sm:col-span-2">
                Search
                <div className="relative mt-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    value={draft.search}
                    onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                    placeholder="Student ID, name, or phone"
                    className="border-white/10 bg-[#0a0f1e] pl-8"
                  />
                </div>
              </label>
              <label className="text-xs text-slate-400">
                Long stay (minutes)
                <Input
                  value={draft.longStayMinutes}
                  onChange={(e) => setDraft((d) => ({ ...d, longStayMinutes: e.target.value }))}
                  className="mt-1 border-white/10 bg-[#0a0f1e]"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                onClick={() => {
                  setApplied(draft);
                  setPage(1);
                  setDeptFocus(null);
                }}
              >
                Generate Report
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 bg-transparent"
                onClick={() => {
                  setDraft(EMPTY_FILTERS);
                  setApplied(EMPTY_FILTERS);
                  setPage(1);
                  setDeptFocus(null);
                }}
              >
                Reset Filters
              </Button>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total Visits', kpi: kpis?.totalVisits, hint: 'All matching scans' },
              { label: 'Total Entries', kpi: kpis?.totalEntries, hint: 'Actual in-scans' },
              { label: 'Total Exits', kpi: kpis?.totalExits, hint: 'Actual out-scans' },
              { label: 'Currently Inside', kpi: kpis?.currentlyInside, hint: 'Open visits' },
              {
                label: 'Average Stay Time',
                kpi: kpis?.averageStayMinutes,
                hint: 'Minutes per visit',
                format: (n: number) => `${n} min`,
              },
              {
                label: 'Longest Stay',
                kpi: kpis?.longestStayMinutes,
                hint: 'Longest matching visit',
                format: (n: number) => `${n} min`,
              },
              {
                label: 'Male Visitors',
                kpi: kpis?.maleVisitors,
                hint: 'From student/staff records',
              },
              {
                label: 'Female Visitors',
                kpi: kpis?.femaleVisitors,
                hint: 'From student/staff records',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/10 bg-slate-900/80 p-4"
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {card.format && card.kpi
                    ? card.format(card.kpi.value)
                    : (card.kpi?.value ?? (summaryQ.isLoading ? '…' : 0))}
                </p>
                <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
                <p className="mt-1 text-xs text-cyan-300/80">
                  {deltaText(card.kpi?.deltaPct ?? null)}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['detailed', 'Detailed Entry & Exit'],
                ['inside', 'Currently Inside'],
                ['departments', 'Department-wise Usage'],
                ['history', 'Student Visit History'],
                ['overdue', 'Overdue Loans'],
                ['fines', 'Fine Report'],
                ['digital', 'Digital Downloads'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs',
                  view === id ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-400',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'detailed' || view === 'inside' || view === 'departments' ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Hourly footfall</h2>
                  {peak ? (
                    <span className="text-xs text-cyan-300">
                      Peak Hour: {peak.label} ({peak.entries} entries)
                    </span>
                  ) : null}
                </div>
                <HourBars buckets={hourlyQ.data?.buckets ?? []} />
                {!hourlyQ.data?.buckets?.some((b) => b.entries || b.exits) && !hourlyQ.isLoading ? (
                  <p className="pt-6 text-center text-sm text-slate-500">
                    No library visit records found for the selected filters.
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
                <h2 className="mb-2 text-sm font-semibold">Department occupancy</h2>
                <DeptBars rows={deptQ.data?.rows ?? []} onPick={(id) => setDeptFocus(id)} />
              </div>
            </div>
          ) : null}

          {view === 'inside' ? (
            <InsidePanel
              rows={insideQ.data?.items ?? []}
              loading={insideQ.isLoading}
              tick={tick}
              onRefresh={() => void insideQ.refetch()}
              onOpen={openHistory}
            />
          ) : null}

          {view === 'departments' ? (
            <div className="overflow-auto rounded-2xl border border-white/10 bg-slate-900/80">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="sticky top-0 bg-[#0d1324] text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Department</th>
                    <th className="p-3">Visits</th>
                    <th className="p-3">Entries</th>
                    <th className="p-3">Exits</th>
                    <th className="p-3">Inside</th>
                    <th className="p-3">Avg stay</th>
                    <th className="p-3">Max stay</th>
                  </tr>
                </thead>
                <tbody>
                  {(deptQ.data?.rows ?? []).map((row) => (
                    <tr
                      key={row.department}
                      className="cursor-pointer border-t border-white/5 hover:bg-white/5"
                      onClick={() => {
                        if (row.departmentId) {
                          setDeptFocus(row.departmentId);
                          setView('detailed');
                        }
                      }}
                    >
                      <td className="p-3 text-cyan-300">{row.department}</td>
                      <td className="p-3">{row.visits}</td>
                      <td className="p-3">{row.entries}</td>
                      <td className="p-3">{row.exits}</td>
                      <td className="p-3">{row.currentlyInside}</td>
                      <td className="p-3">{row.averageStayMinutes} min</td>
                      <td className="p-3">{row.maximumStayMinutes} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {view === 'detailed' ? (
            <VisitTable
              rows={visitsQ.data?.items ?? []}
              loading={visitsQ.isLoading}
              empty={!visitsQ.isLoading && !(visitsQ.data?.items.length ?? 0)}
              page={page}
              limit={limit}
              total={visitsQ.data?.total ?? 0}
              totalPages={totalPages}
              sortBy={sortBy}
              onSort={toggleSort}
              onPage={setPage}
              onLimit={(n) => {
                setLimit(n);
                setPage(1);
              }}
              onOpen={openHistory}
            />
          ) : null}

          {view === 'history' ? (
            <HistoryPanel
              data={historyQ.data as Record<string, unknown> | undefined}
              loading={historyQ.isLoading}
              onClose={() => {
                setHistoryStudentId(null);
                setView('detailed');
              }}
            />
          ) : null}

          {view === 'overdue' ? (
            <SimpleList
              title="Overdue loans"
              rows={(Array.isArray(overdueQ.data) ? overdueQ.data : []).map(
                (row: { copy?: { book?: { title?: string } }; dueAt?: string }) =>
                  `${row.copy?.book?.title ?? 'Loan'} · due ${row.dueAt ? new Date(row.dueAt).toLocaleDateString('en-IN') : ''}`,
              )}
            />
          ) : null}
          {view === 'fines' ? (
            <SimpleList
              title="Fines"
              rows={(Array.isArray(finesQ.data) ? finesQ.data : []).map(
                (row: { amount?: number; reason?: string }) =>
                  `${row.reason ?? 'Fine'} · ₹${row.amount ?? 0}`,
              )}
            />
          ) : null}
          {view === 'digital' ? (
            <SimpleList
              title="Digital downloads"
              rows={(Array.isArray(digitalQ.data) ? digitalQ.data : []).map(
                (row: { asset?: { title?: string }; createdAt?: string }) =>
                  `${row.asset?.title ?? 'Download'} · ${row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}`,
              )}
            />
          ) : null}

          <InsightsStrip insights={insightsQ.data} />
        </main>
      </div>
    </div>
  );
}

function HourBars({
  buckets,
}: {
  buckets: { hour: number; label: string; entries: number; exits: number; footfall: number }[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.footfall));
  return (
    <div className="flex h-32 items-end gap-1">
      {buckets.map((b) => (
        <div key={b.hour} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-gradient-to-t from-cyan-600 to-cyan-400"
            style={{ height: `${Math.max(6, (b.footfall / max) * 100)}%` }}
            title={`${b.label}: ${b.entries} in / ${b.exits} out`}
          />
          <span className="text-[9px] text-slate-500">{b.hour}</span>
        </div>
      ))}
    </div>
  );
}

function DeptBars({
  rows,
  onPick,
}: {
  rows: {
    departmentId: string | null;
    department: string;
    visits: number;
    currentlyInside: number;
    averageStayMinutes: number;
  }[];
  onPick: (id: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.visits));
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No library visit records found for the selected filters.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {rows.slice(0, 8).map((row) => (
        <button
          key={row.department}
          type="button"
          className="w-full text-left"
          onClick={() => row.departmentId && onPick(row.departmentId)}
        >
          <div className="mb-0.5 flex justify-between text-xs">
            <span className="text-slate-300">{row.department}</span>
            <span className="text-slate-500">
              {row.visits} · avg {row.averageStayMinutes}m · {row.currentlyInside} inside
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-cyan-400"
              style={{ width: `${(row.visits / max) * 100}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

function statusClass(status: string) {
  if (status === 'INSIDE') return 'bg-emerald-500/15 text-emerald-300';
  if (status === 'INCOMPLETE') return 'bg-amber-500/15 text-amber-300';
  return 'bg-slate-500/20 text-slate-300';
}

function VisitTable({
  rows,
  loading,
  empty,
  page,
  limit,
  total,
  totalPages,
  sortBy,
  onSort,
  onPage,
  onLimit,
  onOpen,
}: {
  rows: EntryExitVisitRow[];
  loading: boolean;
  empty: boolean;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sortBy: string;
  onSort: (key: string) => void;
  onPage: (page: number) => void;
  onLimit: (n: number) => void;
  onOpen: (row: EntryExitVisitRow) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
        <h2 className="font-semibold">Detailed entry / exit</h2>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{total} records</span>
          <select
            value={limit}
            onChange={(e) => onLimit(Number(e.target.value))}
            className="h-8 rounded-md border border-white/10 bg-[#0a0f1e] px-2"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="sticky top-0 bg-[#0d1324] text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Student ID</th>
              <th className="cursor-pointer p-3" onClick={() => onSort('name')}>
                Student Name {sortBy === 'name' ? '▾' : ''}
              </th>
              <th className="cursor-pointer p-3" onClick={() => onSort('department')}>
                Department
              </th>
              <th className="p-3">Course</th>
              <th className="p-3">Year</th>
              <th className="p-3">Gender</th>
              <th className="cursor-pointer p-3" onClick={() => onSort('entryAt')}>
                Date / In
              </th>
              <th className="cursor-pointer p-3" onClick={() => onSort('exitAt')}>
                Out
              </th>
              <th className="cursor-pointer p-3" onClick={() => onSort('duration')}>
                Duration
              </th>
              <th className="p-3">Status</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/5">
                <td className="p-3 text-slate-500">{row.slNo}</td>
                <td className="p-3 font-medium">{row.memberCode ?? '—'}</td>
                <td className="p-3">
                  <button
                    type="button"
                    className="text-left text-cyan-300 hover:underline"
                    onClick={() => onOpen(row)}
                  >
                    {row.memberName}
                  </button>
                </td>
                <td className="p-3">{row.department ?? '—'}</td>
                <td className="p-3">{row.programme ?? '—'}</td>
                <td className="p-3">{row.semester ?? '—'}</td>
                <td className="p-3">{row.gender ?? '—'}</td>
                <td className="p-3">
                  {row.date}
                  <div className="text-xs text-slate-500">{row.inTime}</div>
                </td>
                <td className="p-3">{row.outTime}</td>
                <td className="p-3">{row.stayLabel}</td>
                <td className="p-3">
                  <span
                    className={cn('rounded-full px-2 py-0.5 text-[11px]', statusClass(row.status))}
                  >
                    {row.statusLabel}
                  </span>
                </td>
                <td className="p-3">
                  {row.studentId ? (
                    <button
                      type="button"
                      className="text-xs text-cyan-300"
                      onClick={() => onOpen(row)}
                    >
                      History
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? <p className="p-6 text-center text-sm text-slate-500">Loading visits…</p> : null}
        {empty ? (
          <p className="p-6 text-center text-sm text-slate-500">
            No library visit records found for the selected filters.
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-white/10 p-3 text-xs text-slate-400">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 bg-transparent"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 bg-transparent"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function InsidePanel({
  rows,
  loading,
  tick,
  onRefresh,
  onOpen,
}: {
  rows: EntryExitVisitRow[];
  loading: boolean;
  tick: number;
  onRefresh: () => void;
  onOpen: (row: EntryExitVisitRow) => void;
}) {
  void tick;
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-cyan-400" /> Currently Inside Library
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="border-white/10 bg-transparent"
          onClick={onRefresh}
        >
          <RefreshCw className="mr-1 h-4 w-4" /> Refresh
        </Button>
      </div>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {!loading && !rows.length ? (
        <p className="text-sm text-slate-500">No one is currently inside.</p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpen(row)}
            className="rounded-xl border border-white/10 bg-[#0a0f1e] p-3 text-left"
          >
            <p className="font-medium text-white">{row.memberName}</p>
            <p className="text-xs text-slate-500">{row.memberCode}</p>
            <p className="mt-1 text-xs text-slate-400">
              {row.department} · {row.programme ?? '—'}
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-cyan-300">
              <Clock className="h-3.5 w-3.5" /> In {row.inTime} · Inside {durationNow(row.entryAt)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {row.zoneName ?? 'Zone —'} {row.seatLabel ? `· ${row.seatLabel}` : ''}
            </p>
            <span
              className={cn(
                'mt-2 inline-block rounded-full px-2 py-0.5 text-[11px]',
                statusClass(row.status),
              )}
            >
              {row.status === 'INCOMPLETE' ? 'Incomplete' : 'Inside'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HistoryPanel({
  data,
  loading,
  onClose,
}: {
  data?: Record<string, unknown>;
  loading: boolean;
  onClose: () => void;
}) {
  const student = data?.student as
    | {
        name?: string;
        studentId?: string;
        department?: string;
        programme?: string;
        semester?: number;
        gender?: string;
        mobile?: string | null;
      }
    | undefined;
  const summary = data?.summary as Record<string, number | string | null> | undefined;
  const visits = (data?.visits as EntryExitVisitRow[] | undefined) ?? [];
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-cyan-400" /> Student visit history
        </h2>
        <button type="button" onClick={onClose} className="text-slate-400">
          <X className="h-4 w-4" />
        </button>
      </div>
      {!student && !loading ? (
        <p className="text-sm text-slate-500">
          Click a student name in the detailed table to open history.
        </p>
      ) : null}
      {student ? (
        <div className="mb-4 grid gap-2 text-sm md:grid-cols-3">
          <p>
            {student.name} · {student.studentId}
          </p>
          <p>
            {student.department} · {student.programme} · Sem {student.semester ?? '—'}
          </p>
          <p>
            {student.gender}
            {student.mobile ? ` · ${student.mobile}` : ''}
          </p>
        </div>
      ) : null}
      {summary ? (
        <div className="mb-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
          <span>Visits {String(summary.totalVisits ?? 0)}</span>
          <span>Total {String(summary.totalMinutes ?? 0)} min</span>
          <span>Avg {String(summary.averageMinutes ?? 0)} min</span>
          <span>Longest {String(summary.longestMinutes ?? 0)} min</span>
        </div>
      ) : null}
      <div className="overflow-auto">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">In</th>
              <th className="p-2">Out</th>
              <th className="p-2">Duration</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((row) => (
              <tr key={row.id} className="border-t border-white/5">
                <td className="p-2">{row.date}</td>
                <td className="p-2">{row.inTime}</td>
                <td className="p-2">{row.outTime}</td>
                <td className="p-2">{row.stayLabel}</td>
                <td className="p-2">{row.statusLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimpleList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {!rows.length ? (
        <p className="text-sm text-slate-500">No records for this report.</p>
      ) : (
        <ul className="space-y-1 text-sm text-slate-300">
          {rows.slice(0, 50).map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InsightsStrip({ insights }: { insights?: Record<string, unknown> }) {
  const frequent =
    (insights?.frequentVisitors as { name: string; visits: number }[] | undefined) ?? [];
  const longStays = (insights?.longStays as EntryExitVisitRow[] | undefined) ?? [];
  if (!insights) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <h3 className="mb-2 text-sm font-semibold">Most frequent visitors</h3>
        {frequent.length ? (
          <ul className="space-y-1 text-sm">
            {frequent.map((row) => (
              <li key={row.name}>
                {row.name} · {row.visits} visits
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No visitors in this range.</p>
        )}
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <h3 className="mb-2 text-sm font-semibold">Unusually long stays</h3>
        {longStays.length ? (
          <ul className="space-y-1 text-sm">
            {longStays.slice(0, 6).map((row) => (
              <li key={row.id}>
                {row.memberName} · {row.stayLabel}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No long stays above the configured threshold.</p>
        )}
      </div>
    </div>
  );
}
