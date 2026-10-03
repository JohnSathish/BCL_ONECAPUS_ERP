'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CloudUpload,
  Database,
  Download,
  FileText,
  FolderOpen,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { formatBytes, StatusBadge } from './qb-shared';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { fetchCycleDashboard } from '@/services/academic-lifecycle';
import { fetchInstitutions } from '@/services/organization';
import { useDashboardFiltersStore } from '@/store/dashboard-filters-store';
import type { QuestionBankDashboard } from '@/types/question-bank';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Props = {
  data?: QuestionBankDashboard;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
};

const DEPT_COLORS = [
  '#2563eb',
  '#16a34a',
  '#eab308',
  '#f97316',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
  '#0ea5e9',
  '#84cc16',
];

const STATUS_BUCKETS = [
  { key: 'Published', color: '#22c55e', match: ['PUBLISHED'] },
  { key: 'Approved', color: '#8b5cf6', match: ['APPROVED'] },
  {
    key: 'Pending',
    color: '#3b82f6',
    match: [
      'SUBMITTED',
      'IN_REVIEW',
      'PENDING_HOD',
      'PENDING_EXAM_CELL',
      'PENDING_REVIEW',
      'PENDING_APPROVAL',
    ],
  },
  { key: 'Rejected', color: '#f97316', match: ['REJECTED'] },
  { key: 'Draft', color: '#94a3b8', match: ['DRAFT', 'ARCHIVED', 'UNKNOWN'] },
] as const;

function formatAyLabel(name: string | undefined) {
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed.toUpperCase().startsWith('AY ') ? trimmed : `AY ${trimmed}`;
}

function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-IN');
}

export function QuestionBankDashboardPanel({ data, isLoading, isError, error }: Props) {
  const { branding } = useInstitutionBranding();
  const institutionIdFromFilters = useDashboardFiltersStore((s) => s.institutionId);
  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    staleTime: 5 * 60_000,
  });
  const institutionId = institutionIdFromFilters ?? institutions.data?.[0]?.id;
  const institution = institutions.data?.find((row) => row.id === institutionId);
  const cycle = useQuery({
    queryKey: ['academic-lifecycle', 'dashboard', institutionId, 'question-bank'],
    queryFn: () => fetchCycleDashboard(institutionId!),
    enabled: Boolean(institutionId),
    staleTime: 60_000,
  });

  const kpis = data?.kpis;
  const total = kpis?.totalPapers ?? 0;
  const collegeName =
    institution?.name ?? branding?.displayName ?? branding?.shortName ?? 'College';
  const ay = formatAyLabel(cycle.data?.primarySession?.name);
  const cycleName = cycle.data?.currentCycle ? `${cycle.data.currentCycle} Cycle` : null;
  const cycleActive = cycle.data?.primarySession?.status === 'ACTIVE';
  const departments = data?.papersByDepartment ?? [];
  const deptTotal = departments.reduce((sum, row) => sum + row.value, 0);
  const years = examYearBars(data?.papersByYear ?? []);
  const yearMax = Math.max(1, ...years.map((row) => row.value));
  const statusSlices = statusBuckets(data?.statusMix ?? [], total);
  const storageBytes = kpis?.storageUsedBytes ?? 0;
  const topShare =
    kpis?.topStorage && storageBytes > 0
      ? Math.max(2, Math.round((kpis.topStorage.bytes / storageBytes) * 100))
      : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
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
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Question Paper Repository
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Manage question paper uploads, approvals, storage, and downloads across departments.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ay ? (
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              {ay}
              {cycle.data?.currentCycle ? ` (${cycle.data.currentCycle})` : ''}
            </span>
          ) : null}
          <Link
            href="/admin/academics/question-bank/papers"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-muted"
          >
            <FolderOpen className="h-4 w-4" />
            Browse Papers
          </Link>
          <Link
            href="/admin/academics/question-bank/upload"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200"
          >
            <Upload className="h-4 w-4" />
            Upload Paper
          </Link>
          <Link
            href="/admin/academics/question-bank/workflow"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-semibold text-white hover:bg-sky-700"
          >
            <ShieldCheck className="h-4 w-4" />
            Manage & Approve
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={FileText}
          label="Total Papers"
          value={displayCount(kpis?.totalPapers, isLoading)}
          hint="All uploaded papers"
          tone="sky"
        />
        <Metric
          icon={CheckCircle2}
          label="Published"
          value={displayCount(kpis?.publishedPapers, isLoading)}
          hint="Available for download"
          tone="emerald"
        />
        <Metric
          icon={ShieldCheck}
          label="Approved"
          value={displayCount(kpis?.approvedPapers, isLoading)}
          hint="Approved by moderator"
          tone="violet"
        />
        <Metric
          icon={Clock3}
          label="Pending"
          value={displayCount(kpis?.pendingPapers ?? kpis?.pendingApprovals, isLoading)}
          hint="Awaiting approval"
          tone="amber"
        />
        <Metric
          icon={CloudUpload}
          label="Uploaded Today"
          value={displayCount(kpis?.uploadedToday, isLoading)}
          hint="New uploads"
          tone="rose"
        />
        <Metric
          icon={Download}
          label="Downloads This Month"
          value={displayCount(kpis?.downloadsThisMonth, isLoading)}
          hint="Total downloads"
          tone="indigo"
        />
        <Metric
          icon={Building2}
          label="Departments"
          value={displayCount(kpis?.departments, isLoading)}
          hint="Active departments"
          tone="sky"
        />
        <article className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-4 shadow-sm dark:border-sky-900 dark:bg-sky-950/20">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Storage Used</p>
            <Database className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-2xl font-bold tracking-tight">{formatBytes(storageBytes)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {kpis?.topStorage
              ? `Top: ${kpis.topStorage.label} (${formatBytes(kpis.topStorage.bytes)})`
              : 'No files stored yet'}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${topShare}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {topShare > 0 ? `${topShare}% in the largest department` : '0% stored'}
          </p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="h-4 w-4 text-sky-600" />
              Papers by Department
            </h2>
            <span className="text-xs text-muted-foreground">Top 10</span>
          </div>
          {!departments.length ? (
            <Empty note="No department papers yet." />
          ) : (
            <ul className="space-y-2.5">
              {departments.slice(0, 10).map((row, index) => {
                const pct = deptTotal ? Math.round((row.value / deptTotal) * 1000) / 10 : 0;
                return (
                  <li
                    key={row.label}
                    className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-xs"
                  >
                    <span className="truncate text-foreground">{row.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(4, (row.value / Math.max(1, departments[0]?.value ?? 1)) * 100)}%`,
                          backgroundColor: DEPT_COLORS[index % DEPT_COLORS.length],
                        }}
                      />
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.value} {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/admin/academics/question-bank/papers"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline"
          >
            View All Departments ({kpis?.departments ?? departments.length})
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-sky-600" />
              Papers by Exam Year
            </h2>
            <span className="text-xs text-muted-foreground">Last 5 Years</span>
          </div>
          <div className="flex h-52 items-end gap-3">
            {years.map((row) => (
              <div
                key={row.label}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="text-xs font-semibold text-foreground">{row.value}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-sky-600"
                    style={{
                      height: `${Math.max(row.value ? 8 : 2, (row.value / yearMax) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{row.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-sky-600" />
            Status Mix
          </h2>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-center">
            <div
              className="relative h-40 w-40 shrink-0 rounded-full"
              style={{ background: donutBackground(statusSlices) }}
            >
              <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-card">
                <span className="text-3xl font-bold">{isLoading && !data ? '—' : total}</span>
                <span className="text-xs text-muted-foreground">Total Papers</span>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              {statusSlices.map((slice) => (
                <li key={slice.key} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="w-20 text-muted-foreground">{slice.key}</span>
                  <span className="font-semibold tabular-nums">
                    {slice.value} ({slice.percent}%)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Download className="h-4 w-4 text-sky-600" />
              Most Downloaded Papers
            </h2>
            <Link
              href="/admin/academics/question-bank/papers"
              className="text-sm font-medium text-sky-600 hover:underline"
            >
              View All
            </Link>
          </div>
          {!data?.mostDownloaded?.length ? (
            <Empty note="No downloads recorded yet." />
          ) : (
            <ol className="space-y-2">
              {data.mostDownloaded.slice(0, 5).map((row, index) => (
                <li key={row.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-semibold">{row.paperCode}</span>
                    <span className="text-muted-foreground"> — {row.paperName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.downloads} download{row.downloads === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Upload className="h-4 w-4 text-sky-600" />
              Recent Uploads
            </h2>
            <Link
              href="/admin/academics/question-bank/papers"
              className="text-sm font-medium text-sky-600 hover:underline"
            >
              View All
            </Link>
          </div>
          {!data?.recentUploads?.length ? (
            <Empty note={isLoading ? 'Loading uploads…' : 'No uploads yet.'} />
          ) : (
            <ul className="space-y-2">
              {data.recentUploads.map((row) => (
                <li key={row.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-[10px] font-bold text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                    PDF
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {row.fileName || `${row.paperCode}.pdf`}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.departmentName || row.paperName}
                    </span>
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {timeAgo(row.createdAt)}
                  </span>
                  <StatusBadge status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isError ? <p className="text-sm text-destructive">{apiErrorMessage(error)}</p> : null}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  hint: string;
  tone: 'sky' | 'emerald' | 'violet' | 'amber' | 'rose' | 'indigo';
}) {
  const toneClass = {
    sky: 'border-sky-200/80 bg-sky-50/40 dark:border-sky-900 dark:bg-sky-950/20',
    emerald:
      'border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20',
    violet: 'border-violet-200/80 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20',
    amber: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20',
    rose: 'border-rose-200/80 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20',
    indigo: 'border-indigo-200/80 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/20',
  }[tone];
  return (
    <article className={cn('rounded-2xl border p-4 shadow-sm', toneClass)}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-sky-600" />
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}

function Empty({ note }: { note: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{note}</p>;
}

function displayCount(value: number | undefined, isLoading?: boolean) {
  if (isLoading && value == null) return '—';
  return String(value ?? 0);
}

function examYearBars(rows: { label: string; value: number }[]) {
  const current = new Date().getFullYear();
  const labels = Array.from({ length: 5 }, (_, index) => String(current - 4 + index));
  return labels.map((label) => ({
    label,
    value: rows.find((row) => row.label === label)?.value ?? 0,
  }));
}

function statusBuckets(rows: { label: string; value: number }[], total: number) {
  const known = new Set<string>(STATUS_BUCKETS.flatMap((bucket) => [...bucket.match]));
  const buckets = STATUS_BUCKETS.map((bucket) => {
    const value = rows
      .filter((row) => (bucket.match as readonly string[]).includes(row.label))
      .reduce((sum, row) => sum + row.value, 0);
    return { key: bucket.key, color: bucket.color, value };
  });
  const leftover = rows
    .filter((row) => !known.has(row.label))
    .reduce((sum, row) => sum + row.value, 0);
  const draft = buckets.find((bucket) => bucket.key === 'Draft');
  if (draft) draft.value += leftover;
  return buckets
    .filter((bucket) => bucket.key !== 'Approved' || bucket.value > 0)
    .map((bucket) => ({
      ...bucket,
      percent: total ? Math.round((bucket.value / total) * 100) : 0,
    }));
}

function donutBackground(slices: { color: string; value: number }[]) {
  const sum = slices.reduce((total, slice) => total + slice.value, 0);
  if (!sum) return 'conic-gradient(#e2e8f0 0 100%)';
  let cursor = 0;
  const stops = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const start = cursor;
      cursor += (slice.value / sum) * 100;
      return `${slice.color} ${start}% ${cursor}%`;
    });
  return `conic-gradient(${stops.join(', ')})`;
}
