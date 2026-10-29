'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, BookOpen, Clock, Download, Library, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  downloadEntryExitExport,
  downloadLibraryReportCsv,
  fetchLibraryReport,
  fetchLibraryReportsDesk,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download-blob';

const PRESETS = [7, 30, 90, 180, 365];
const COLORS = ['#2563eb', '#34d399', '#f59e0b', '#a78bfa', '#94a3b8'];

export function LibraryReportsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const [days, setDays] = useState(30);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [year, setYear] = useState<number | undefined>();
  const [metric, setMetric] = useState<'issues' | 'titles'>('issues');
  const [message, setMessage] = useState('');
  const custom = Boolean(from && to);

  const desk = useQuery({
    queryKey: ['library', 'reports-desk', custom ? from : days, custom ? to : '', year ?? ''],
    queryFn: () =>
      fetchLibraryReportsDesk({
        ...(custom ? { from, to } : { days }),
        year,
      }),
    enabled,
  });

  const report = desk.data;
  const summary = report?.summary;
  const slices = (report?.categories ?? []).map((row) => ({
    name: row.name,
    value: metric === 'issues' ? row.issues : row.titles,
    share: metric === 'issues' ? row.issueShare : row.titleShare,
  }));
  const period = report ? { from: report.from, to: report.to } : undefined;

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Library / Reports</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Library Reports
          </h1>
          <p className="text-sm text-slate-500">
            Generate reports on library usage, circulation, members and resources
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="From"
            className="w-36"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Input
            type="date"
            aria-label="To"
            className="w-36"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={!custom && days === preset ? 'default' : 'outline'}
              onClick={() => {
                setDays(preset);
                setFrom('');
                setTo('');
              }}
            >
              {preset}d
            </Button>
          ))}
        </div>
      </div>
      {message ? (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card
          icon={BookOpen}
          label="Total Book Issues"
          value={num(summary?.totalIssues)}
          hint="Compared with the previous period"
          delta={summary?.deltas.totalIssues ?? null}
          tone="bg-blue-50 text-blue-700"
        />
        <Card
          icon={Users}
          label="Active Members"
          value={num(summary?.activeMembers)}
          hint="Students and staff who borrowed"
          delta={summary?.deltas.activeMembers ?? null}
          tone="bg-emerald-50 text-emerald-700"
        />
        <Card
          icon={Library}
          label="New Readers"
          value={num(summary?.newReaders)}
          hint="First loan in this period"
          delta={summary?.deltas.newReaders ?? null}
          tone="bg-violet-50 text-violet-700"
        />
        <Card
          icon={Clock}
          label="Avg. Loan Duration"
          value={summary?.averageLoanDays == null ? '—' : `${summary.averageLoanDays} days`}
          hint="Completed loans only"
          delta={summary?.deltas.averageLoanDays ?? null}
          tone="bg-amber-50 text-amber-700"
        />
        <Card
          icon={AlertTriangle}
          label="Overdue Items"
          value={num(summary?.overdue)}
          hint="Open loans past the due date"
          delta={summary?.deltas.overdue ?? null}
          tone="bg-rose-50 text-rose-700"
          worse
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Quick Reports</h2>
            <p className="text-sm text-slate-500">Each file is generated when you click it</p>
          </div>
          <button
            type="button"
            className="text-sm text-blue-600"
            onClick={() =>
              document.getElementById('report-downloads')?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            View all reports
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Quick
            title="Entry / Exit Reports"
            detail="Footfall export for this period"
            action="Generate report"
            onClick={() => void run(() => downloadVisit(period))}
          />
          <Quick
            title="Department Visitors"
            detail="Student visits by department"
            action="Export CSV"
            onClick={() =>
              void run(() => saveCsv('department-visitors.csv', 'department-visitors.csv', period))
            }
          />
          <Quick
            title="Accession Register"
            detail="Current accessioned books"
            action="Export CSV"
            onClick={() => void run(() => saveCsv('accession.csv', 'accession-register.csv'))}
          />
          <Quick
            title="Overdue Loans"
            detail="Copies still out past the due date"
            action="Export CSV"
            onClick={() => void run(() => saveCsv('overdue.csv', 'overdue-loans.csv'))}
          />
          <Quick
            title="Fines Collection"
            detail="Fines in the selected period"
            action="Export CSV"
            onClick={() => void run(() => saveCsv('fines.csv', 'library-fines.csv', period))}
          />
          <Quick
            title="Digital Downloads"
            detail="Download log for this period"
            action="Generate report"
            onClick={() =>
              void run(() =>
                saveJsonReport('digital/downloads', 'digital-downloads.csv', period, (rows) =>
                  rows.map((row) => [text(row, 'asset.title'), text(row, 'createdAt')]),
                ),
              )
            }
          />
          <Quick
            title="Research Repository"
            detail="Research access in this period"
            action="Generate report"
            onClick={() =>
              void run(() =>
                saveJsonReport('research/usage', 'research-usage.csv', period, (rows) =>
                  rows.map((row) => [
                    text(row, 'item.title'),
                    text(row, 'action'),
                    text(row, 'createdAt'),
                  ]),
                ),
              )
            }
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Monthly Circulation Trend</h2>
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={report?.year ?? ''}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {(report?.years ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report?.months ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="issued" name="Books issued" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="returned"
                  name="Books returned"
                  fill="#34d399"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Resource Type Distribution</h2>
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={metric}
              onChange={(event) => setMetric(event.target.value as 'issues' | 'titles')}
            >
              <option value="issues">By issues</option>
              <option value="titles">By titles</option>
            </select>
          </div>
          {slices.length ? (
            <div className="grid items-center gap-3 sm:grid-cols-[180px_1fr]">
              <div className="relative h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={slices}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={72}
                    >
                      {slices.map((row, index) => (
                        <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-lg font-semibold">
                    {slices.reduce((sum, row) => sum + row.value, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">
                    {metric === 'issues' ? 'Issues' : 'Titles'}
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-sm">
                {slices.map((row, index) => (
                  <li key={row.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      {row.name}
                    </span>
                    <span className="text-slate-500">
                      {row.share}% ({row.value})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              {desk.isLoading ? 'Loading circulation…' : 'No issues in this period.'}
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Rank
          title="Top 10 Books"
          href="/admin/library/analytics"
          rows={(report?.topBooks ?? []).map((book) => ({
            key: book.bookId,
            label: book.title,
            meta: book.author || '—',
            value: book.issues,
          }))}
        />
        <Rank
          title="Top 10 Readers"
          href="/admin/library/analytics"
          rows={(report?.topReaders ?? []).map((reader) => ({
            key: reader.memberId,
            label: reader.fullName,
            meta: labelMember(reader.memberType),
            value: reader.issues,
          }))}
        />
        <Rank
          title="Department Usage (Top 5)"
          href="/admin/library/analytics"
          rows={(report?.departments ?? []).map((row) => ({
            key: row.name,
            label: row.name,
            meta: 'Issues',
            value: row.issues,
          }))}
        />
      </div>

      <section
        id="report-downloads"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="mb-1 font-semibold">Report downloads</h2>
        <p className="mb-3 text-sm text-slate-500">
          Saved export history is not recorded. Download the current file when you need it.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Report</th>
                <th className="px-2 py-2">Contents</th>
                <th className="px-2 py-2">Format</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              <DownloadRow
                name="Entry / exit"
                detail="Visits in the selected period"
                format="Excel"
                onClick={() => void run(() => downloadVisit(period))}
              />
              <DownloadRow
                name="Department visitors"
                detail="Student visits by department"
                format="CSV"
                onClick={() =>
                  void run(() =>
                    saveCsv('department-visitors.csv', 'department-visitors.csv', period),
                  )
                }
              />
              <DownloadRow
                name="Accession register"
                detail="All accessioned books"
                format="CSV"
                onClick={() => void run(() => saveCsv('accession.csv', 'accession-register.csv'))}
              />
              <DownloadRow
                name="Overdue loans"
                detail="Copies past the due date now"
                format="CSV"
                onClick={() => void run(() => saveCsv('overdue.csv', 'overdue-loans.csv'))}
              />
              <DownloadRow
                name="Fines"
                detail="Fines in the selected period"
                format="CSV"
                onClick={() => void run(() => saveCsv('fines.csv', 'library-fines.csv', period))}
              />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  tone,
  worse,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  hint: string;
  delta: number | null;
  tone: string;
  worse?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  const positive = worse ? !up : up;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">
        {delta == null ? null : (
          <span className={cn('mr-1 font-medium', positive ? 'text-emerald-600' : 'text-rose-600')}>
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
        {hint}
      </p>
    </div>
  );
}

function Quick({
  title,
  detail,
  action,
  onClick,
}: {
  title: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onClick}>
        {action}
      </Button>
    </div>
  );
}

function Rank({
  title,
  href,
  rows,
}: {
  title: string;
  href: string;
  rows: { key: string; label: string; meta: string; value: number }[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="text-sm text-blue-600">
          View all
        </Link>
      </div>
      {rows.length ? (
        <ol className="space-y-2 text-sm">
          {rows.map((row, index) => (
            <li key={row.key || index} className="flex items-center justify-between gap-2">
              <span>
                <span className="mr-2 text-slate-400">{index + 1}</span>
                {row.label}
                <span className="ml-2 text-xs text-slate-500">{row.meta}</span>
              </span>
              <span className="font-semibold">{row.value}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-6 text-center text-sm text-slate-500">Nothing in this period.</p>
      )}
    </section>
  );
}

function DownloadRow({
  name,
  detail,
  format,
  onClick,
}: {
  name: string;
  detail: string;
  format: string;
  onClick: () => void;
}) {
  return (
    <tr className="border-t">
      <td className="px-2 py-2 font-medium">{name}</td>
      <td className="px-2 py-2 text-slate-500">{detail}</td>
      <td className="px-2 py-2">{format}</td>
      <td className="px-2 py-2">
        <Button type="button" size="sm" variant="outline" onClick={onClick}>
          <Download className="mr-1 h-3.5 w-3.5" />
          Download
        </Button>
      </td>
    </tr>
  );
}

function num(value?: number) {
  return value == null ? '—' : value.toLocaleString();
}

function labelMember(value: string) {
  if (value === 'FACULTY') return 'Faculty';
  if (value === 'STAFF') return 'Staff';
  if (value === 'STUDENT') return 'Student';
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : '—';
}

async function saveCsv(path: string, filename: string, period?: { from: string; to: string }) {
  const csv = await downloadLibraryReportCsv(path, period);
  downloadBlob(new Blob([csv], { type: 'text/csv' }), filename);
}

async function downloadVisit(period?: { from: string; to: string }) {
  const blob = await downloadEntryExitExport(
    'xlsx',
    period ? { ...period, period: 'custom' } : { period: 'month' },
  );
  downloadBlob(blob, 'library-entry-exit.xlsx');
}

async function saveJsonReport(
  path: string,
  filename: string,
  period: { from: string; to: string } | undefined,
  map: (rows: Record<string, unknown>[]) => string[][],
) {
  const data = await fetchLibraryReport(path, period);
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const lines = map(rows).map((cols) =>
    cols.map((value) => `"${value.replace(/"/g, '""')}"`).join(','),
  );
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv' }), filename);
}

function text(row: Record<string, unknown>, path: string) {
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, row);
  return value == null ? '' : String(value);
}
