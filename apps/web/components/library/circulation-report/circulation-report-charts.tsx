'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CirculationAnalytics } from '@/types/library-circulation-report';

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

function RankList({
  rows,
  empty,
}: {
  rows: { label: string; sub?: string | null; count: number }[];
  empty: string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ol className="space-y-2">
      {rows.map((row, i) => (
        <li key={`${row.label}-${i}`} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">
              <span className="mr-1.5 text-xs text-slate-400">{i + 1}.</span>
              {row.label}
              {row.sub ? <span className="ml-1 text-xs text-slate-500">· {row.sub}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums font-medium">{row.count}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-blue-500"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CirculationReportCharts({ data }: { data: CirculationAnalytics }) {
  const monthly = data.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Monthly issues vs returns">
        <div className="h-60">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 320, height: 180 }}
          >
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="issues"
                name="Issues"
                stroke="#2563eb"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="returns"
                name="Returns"
                stroke="#16a34a"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Monthly renewals and overdue books">
        <div className="h-60">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 320, height: 180 }}
          >
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Legend />
              <Bar dataKey="renewals" name="Renewals" fill="#7c3aed" radius={[3, 3, 0, 0]} />
              <Bar dataKey="overdue" name="Became overdue" fill="#e11d48" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Department-wise circulation">
        <div className="h-72">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 320, height: 180 }}
          >
            <BarChart data={data.departments} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="department" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="issues" name="Issues" fill="#2563eb" />
              <Bar dataKey="returns" name="Returns" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Circulation by member type">
        <div className="h-72">
          <ResponsiveContainer
            width="100%"
            height="100%"
            initialDimension={{ width: 320, height: 180 }}
          >
            <BarChart data={data.byMemberType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
              <Tooltip />
              <Bar dataKey="count" name="Issues" fill="#0891b2" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Most borrowed books">
        <RankList
          rows={data.mostBorrowedBooks.map((b) => ({
            label: b.title,
            sub: b.author,
            count: b.count,
          }))}
          empty="No issues in this period."
        />
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Most active students">
          <RankList
            rows={data.topStudents.map((s) => ({
              label: s.name ?? 'Unknown',
              sub: s.code,
              count: s.count,
            }))}
            empty="No student issues."
          />
        </Panel>
        <Panel title="Most active staff">
          <RankList
            rows={data.topStaff.map((s) => ({
              label: s.name ?? 'Unknown',
              sub: s.code,
              count: s.count,
            }))}
            empty="No staff issues."
          />
        </Panel>
      </div>
    </div>
  );
}
