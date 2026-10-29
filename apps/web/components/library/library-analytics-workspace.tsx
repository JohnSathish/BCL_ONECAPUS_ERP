'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Building2, Clock, Library, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchLibraryDepartmentHeatmap,
  fetchLibraryGenderTrends,
  fetchLibraryReadingAnalytics,
} from '@/services/library';
import { cn } from '@/utils/cn';

const PRESETS = [7, 30, 90, 180, 365];
const BAR_COLORS = ['#2563eb', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fb923c', '#94a3b8'];

export function LibraryAnalyticsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const [days, setDays] = useState(30);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showBooks, setShowBooks] = useState(false);
  const [showReaders, setShowReaders] = useState(false);
  const custom = Boolean(from && to);

  const reading = useQuery({
    queryKey: ['library', 'reading-analytics', custom ? from : days, custom ? to : ''],
    queryFn: () => fetchLibraryReadingAnalytics(custom ? { from, to } : { days }),
    enabled,
  });
  const heatmap = useQuery({
    queryKey: ['library', 'heatmap'],
    queryFn: fetchLibraryDepartmentHeatmap,
    enabled,
  });
  const gender = useQuery({
    queryKey: ['library', 'gender-trends'],
    queryFn: fetchLibraryGenderTrends,
    enabled,
  });

  const report = reading.data;
  const summary = report?.summary;
  const books = report?.topBooks ?? [];
  const readers = report?.topReaders ?? [];
  const departments = chartDepartments(report?.departmentUsage ?? []);
  const heatMax = Math.max(1, ...(heatmap.data?.grid ?? []).flatMap((row) => row.counts));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Library / Reading Analytics</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Library className="h-5 w-5 text-blue-600" />
            Reading Analytics
          </h1>
          <p className="text-sm text-slate-500">
            Insights on library usage, popular books, active readers and department-wise trends
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Card
          icon={BookOpen}
          label="Total Issues"
          value={summary ? summary.totalIssues.toLocaleString() : '—'}
          hint="Compared with the previous period"
          delta={summary?.deltas.totalIssues ?? null}
          tone="bg-blue-50 text-blue-700"
        />
        <Card
          icon={Users}
          label="Active Readers"
          value={summary ? summary.activeReaders.toLocaleString() : '—'}
          hint="Unique students and staff"
          delta={summary?.deltas.activeReaders ?? null}
          tone="bg-emerald-50 text-emerald-700"
        />
        <Card
          icon={Library}
          label="Books Read"
          value={summary ? summary.uniqueTitles.toLocaleString() : '—'}
          hint="Unique titles issued"
          delta={summary?.deltas.uniqueTitles ?? null}
          tone="bg-violet-50 text-violet-700"
        />
        <Card
          icon={Clock}
          label="Average Reading Time"
          value={summary?.averageLoanDays == null ? '—' : `${summary.averageLoanDays} days`}
          hint="Completed loans only"
          delta={summary?.deltas.averageLoanDays ?? null}
          tone="bg-amber-50 text-amber-700"
        />
        <Card
          icon={Building2}
          label="Departments Active"
          value={summary ? summary.departmentsActive.toLocaleString() : '—'}
          hint={summary ? `of ${summary.departmentsTotal} departments` : 'of total departments'}
          tone="bg-rose-50 text-rose-700"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Top 20 Books</h2>
            <button
              type="button"
              className="text-sm text-blue-600"
              onClick={() => setShowBooks((value) => !value)}
            >
              {showBooks ? 'Show less' : 'View all'}
            </button>
          </div>
          {books.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Book Title</th>
                    <th className="px-2 py-2">Author</th>
                    <th className="px-2 py-2">Accession No.</th>
                    <th className="px-2 py-2 text-right">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {books.slice(0, showBooks ? 20 : 8).map((book, index) => (
                    <tr key={book.bookId} className="border-t">
                      <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-2 py-2 font-medium">{book.title}</td>
                      <td className="px-2 py-2">{book.author || '—'}</td>
                      <td className="px-2 py-2">{book.accessionNo}</td>
                      <td className="px-2 py-2 text-right font-semibold">{book.issueCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              {reading.isLoading ? 'Loading issues…' : 'No issues in this period.'}
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Summary</h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="Period"
              value={summary ? `${formatDay(summary.from)} – ${formatDay(summary.to)}` : '—'}
            />
            <Row label="Total Issues" value={summary?.totalIssues.toLocaleString() ?? '—'} />
            <Row label="Active Readers" value={summary?.activeReaders.toLocaleString() ?? '—'} />
            <Row label="Unique Titles Used" value={summary?.uniqueTitles.toLocaleString() ?? '—'} />
            <Row
              label="Departments Active"
              value={summary?.departmentsActive.toLocaleString() ?? '—'}
            />
            <Row
              label="Average Loan Duration"
              value={summary?.averageLoanDays == null ? '—' : `${summary.averageLoanDays} days`}
            />
            <Row label="Most Active Day" value={summary?.mostActiveDay ?? '—'} />
            <Row label="Most Popular Category" value={summary?.mostPopularCategory ?? '—'} />
          </dl>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Top 10 Readers</h2>
            <button
              type="button"
              className="text-sm text-blue-600"
              onClick={() => setShowReaders((value) => !value)}
            >
              {showReaders ? 'Show less' : 'View all'}
            </button>
          </div>
          {readers.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Member Type</th>
                    <th className="px-2 py-2">Department / Course</th>
                    <th className="px-2 py-2 text-right">Books Read</th>
                  </tr>
                </thead>
                <tbody>
                  {readers.slice(0, showReaders ? 50 : 10).map((reader, index) => (
                    <tr key={`${reader.memberType}:${reader.memberId}`} className="border-t">
                      <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-2 py-2 font-medium">{reader.fullName}</td>
                      <td className="px-2 py-2">{labelMember(reader.memberType)}</td>
                      <td className="px-2 py-2">
                        {[reader.department, reader.programme].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">{reader.issueCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No readers in this period.</p>
          )}
          <Link href="/admin/library/members" className="mt-3 inline-block text-sm text-blue-600">
            Open members
          </Link>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Department Usage (Circulation)</h2>
            <Link href="/admin/library/reports" className="text-sm text-blue-600">
              View details
            </Link>
          </div>
          {departments.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departments}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    height={50}
                    textAnchor="end"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="issues" radius={[6, 6, 0, 0]}>
                    {departments.map((row, index) => (
                      <Cell key={row.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              No department issues in this period.
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Weekly Circulation (Last 7 Days)</h2>
            <Link href="/admin/library/circulation" className="text-sm text-blue-600">
              View details
            </Link>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={report?.weeklyIssues ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Visit Heatmap by Department (30 Days)</h2>
            <Link href="/admin/library/visits" className="text-sm text-blue-600">
              View details
            </Link>
          </div>
          {heatmap.data?.grid?.length ? (
            <div className="space-y-2">
              {heatmap.data.grid.map((row) => (
                <div
                  key={row.departmentName}
                  className="grid grid-cols-[88px_1fr] items-center gap-2"
                >
                  <p className="truncate text-xs text-slate-500">{row.departmentName}</p>
                  <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-0.5">
                    {row.counts.map((count, index) => (
                      <span
                        key={`${row.departmentName}-${index}`}
                        title={`${row.departmentName} day ${index + 1}: ${count}`}
                        className="h-3 rounded-sm"
                        style={{ backgroundColor: heatColor(count, heatMax) }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              No student visits in the last 30 days.
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Gender Trends (Weekly, 30 Days)</h2>
            <Link href="/admin/library/visits" className="text-sm text-blue-600">
              View details
            </Link>
          </div>
          <div className="mb-2 flex gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Male
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-400" /> Female
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(gender.data?.weekly ?? []).map((row) => ({
                  name: `Week ${row.week}`,
                  male: row.male,
                  female: row.female,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="male" stackId="gender" fill="#38bdf8" />
                <Bar dataKey="female" stackId="gender" fill="#fb7185" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Student visits whose gender is recorded as male or female.
          </p>
        </section>
      </div>
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
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">
        {delta == null ? null : (
          <span
            className={cn('mr-1 font-medium', delta >= 0 ? 'text-emerald-600' : 'text-rose-600')}
          >
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
        {hint}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function chartDepartments(rows: { departmentName: string; issueCount: number }[]) {
  const top = rows
    .slice(0, 7)
    .map((row) => ({ name: shortName(row.departmentName), issues: row.issueCount }));
  const rest = rows.slice(7).reduce((sum, row) => sum + row.issueCount, 0);
  if (rest > 0) top.push({ name: 'Others', issues: rest });
  return top;
}

function shortName(name: string) {
  return name.length > 14 ? `${name.slice(0, 12)}…` : name;
}

function labelMember(value: string) {
  if (value === 'FACULTY') return 'Faculty';
  if (value === 'STAFF') return 'Staff';
  if (value === 'STUDENT') return 'Student';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatDay(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en-GB');
}

function heatColor(count: number, max: number) {
  if (!count) return '#e2e8f0';
  const strength = 0.25 + (count / max) * 0.75;
  return `rgba(37, 99, 235, ${strength})`;
}
