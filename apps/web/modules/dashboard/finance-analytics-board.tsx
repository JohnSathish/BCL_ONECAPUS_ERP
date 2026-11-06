'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  GraduationCap,
  Lightbulb,
  Star,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import type { DashboardKpiMetric, FinanceBoard } from '@/types/dashboard-analytics';
import { cn } from '@/utils/cn';

const KPI_STYLE: Record<string, { icon: LucideIcon; wrap: string; stroke: string }> = {
  students: { icon: Users, wrap: 'bg-sky-100 text-sky-700', stroke: '#0284c7' },
  applications: { icon: ClipboardList, wrap: 'bg-violet-100 text-violet-700', stroke: '#7c3aed' },
  attendance: { icon: UserCheck, wrap: 'bg-orange-100 text-orange-700', stroke: '#ea580c' },
  fees: { icon: Wallet, wrap: 'bg-emerald-100 text-emerald-700', stroke: '#059669' },
  placement: { icon: TrendingUp, wrap: 'bg-blue-100 text-blue-700', stroke: '#2563eb' },
  pending: { icon: Clock, wrap: 'bg-rose-100 text-rose-700', stroke: '#e11d48' },
  faculty: { icon: GraduationCap, wrap: 'bg-cyan-100 text-cyan-700', stroke: '#0891b2' },
  completion: { icon: CheckCircle2, wrap: 'bg-fuchsia-100 text-fuchsia-700', stroke: '#c026d3' },
};

const SLICE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function downloadCsv(kpis: DashboardKpiMetric[], board: FinanceBoard) {
  const lines = [
    ['Metric', 'Value', 'Detail'],
    ...kpis.map((metric) => [
      metric.label,
      `${metric.value}${metric.suffix ?? ''}`,
      metric.context,
    ]),
    ['Fee demanded', String(board.fee.demanded), ''],
    ['Fee collected', String(board.fee.collected), ''],
    ['Fee pending', String(board.fee.pending), ''],
    ...board.studentsByProgramme.map((row) => ['Students', row.label, String(row.value)]),
    ...board.fee.byHead.map((row) => ['Fee head collected', row.label, String(row.value)]),
  ];
  const csv = lines
    .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'finance-analytics.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FinanceAnalyticsBoard({
  kpis,
  board,
  onRefresh,
  refreshing,
}: {
  kpis: DashboardKpiMetric[];
  board: FinanceBoard;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const critical = board.insights.filter((item) => item.level === 'critical').length;
  const positive = board.insights.filter((item) => item.level === 'positive').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Finance & Analytics
          </h2>
          <p className="text-sm text-slate-500">
            Enrolment, attendance, fees, and placements for the filters below. Figures come from
            published records, not estimates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/fees/reports">
              <CalendarClock className="mr-1.5 h-4 w-4" /> Schedule Report
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadCsv(kpis, board)}>
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
          <Button size="sm" onClick={onRefresh} disabled={refreshing}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {kpis.map((metric) => (
          <KpiCard key={metric.id} metric={metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <InsightsCard insights={board.insights} />
        <FeeTrendCard monthly={board.fee.monthly} />
        <ProgrammeCard
          slices={board.studentsByProgramme}
          total={kpis.find((item) => item.id === 'students')?.value ?? 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <AttendanceCard attendance={board.attendance} />
        <DepartmentCard rows={board.attendance.byDepartment} />
        <FeeHeadCard board={board} />
        <ActivityCard activities={board.activities} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <FooterStat icon={Lightbulb} label="Insights" value={String(board.insights.length)} />
        <FooterStat
          icon={AlertTriangle}
          label="Critical"
          value={String(critical)}
          tone="text-rose-600"
        />
        <FooterStat icon={Wallet} label="Fee pending" value={inr(board.fee.pending)} />
        <FooterStat
          icon={CheckCircle2}
          label="Positive signals"
          value={String(positive)}
          tone="text-emerald-600"
        />
        <FooterStat
          icon={Clock}
          label="Approvals waiting"
          value={String(kpis.find((item) => item.id === 'pending')?.value ?? 0)}
        />
        <FooterStat
          icon={Star}
          label="Below 75% attendance"
          value={String(board.attendance.below75)}
        />
      </div>
    </div>
  );
}

function KpiCard({ metric }: { metric: DashboardKpiMetric }) {
  const style = KPI_STYLE[metric.id] ?? KPI_STYLE.students;
  const Icon = style.icon;
  const flat = metric.changePct === 0;
  const up = metric.trend === 'up';
  const chart =
    metric.sparkline.length > 1 ? metric.sparkline.map((value, index) => ({ index, value })) : [];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', style.wrap)}>
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            flat
              ? 'bg-slate-100 text-slate-500'
              : up
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700',
          )}
        >
          {flat ? null : up ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {flat ? '0%' : `${metric.changePct > 0 ? '+' : ''}${metric.changePct}%`}
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{metric.label}</p>
      <p className="text-2xl font-semibold tracking-tight text-slate-900">
        {metric.suffix === '%'
          ? metric.value.toFixed(1)
          : Math.round(metric.value).toLocaleString('en-IN')}
        {metric.suffix ?? ''}
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{metric.context}</p>
      {chart.length > 1 ? (
        <div className="mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <Bar dataKey="value" fill={style.stroke} radius={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </article>
  );
}

function InsightsCard({ insights }: { insights: FinanceBoard['insights'] }) {
  const tone = {
    critical: 'border-rose-200 bg-rose-50 text-rose-800',
    high: 'border-orange-200 bg-orange-50 text-orange-800',
    normal: 'border-sky-200 bg-sky-50 text-sky-800',
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
        <Lightbulb className="h-4 w-4 text-amber-500" /> Key insights
      </h3>
      <div className="space-y-2">
        {insights.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing needs attention in this filter.</p>
        ) : (
          insights.map((item) => (
            <div key={item.id} className={cn('rounded-xl border px-3 py-2', tone[item.level])}>
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs opacity-80">{item.detail}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function FeeTrendCard({ monthly }: { monthly: FinanceBoard['fee']['monthly'] }) {
  const hasMoney = monthly.some((month) => month.collected > 0);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-800">Fee collection trend</h3>
      <p className="mb-2 text-xs text-slate-500">Successful payments recorded in each month.</p>
      {hasMoney ? (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => inr(Number(value))}
                width={72}
              />
              <Tooltip formatter={(value) => inr(Number(value ?? 0))} />
              <Bar dataKey="collected" fill="#60a5fa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-slate-500">
          No payments in the last six months.
        </p>
      )}
    </section>
  );
}

function ProgrammeCard({
  slices,
  total,
}: {
  slices: FinanceBoard['studentsByProgramme'];
  total: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-800">Students by programme</h3>
      {slices.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">No students in this filter.</p>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={48}
                  outerRadius={68}
                  stroke="none"
                >
                  {slices.map((slice, index) => (
                    <Cell key={slice.label} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold">
                {Math.round(total).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500">Students</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1 text-xs">
            {slices.map((slice, index) => (
              <li key={slice.label} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
                  />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="shrink-0 text-slate-500">
                  {slice.value} · {slice.share}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AttendanceCard({ attendance }: { attendance: FinanceBoard['attendance'] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Attendance overview</h3>
        <span className="text-sm font-semibold text-blue-700">
          {attendance.average == null ? '—' : `${attendance.average}%`}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {attendance.markedStudents
          ? `${attendance.markedStudents} students have marked sessions. ${attendance.below75} are under 75%.`
          : 'Attendance appears after class sessions are marked.'}
      </p>
      <p className="mt-3 text-xs text-slate-400">Target used for the shortage check: 75%.</p>
    </section>
  );
}

function DepartmentCard({ rows }: { rows: FinanceBoard['attendance']['byDepartment'] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-slate-800">Department attendance</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No department attendance yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span className="truncate">{row.label}</span>
                <span>{row.percentage == null ? '—' : `${row.percentage}%`}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.max(0, Math.min(100, row.percentage ?? 0))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FeeHeadCard({ board }: { board: FinanceBoard }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-slate-800">Fee collection by head</h3>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{inr(board.fee.collected)}</p>
      <p className="text-xs text-slate-500">
        Collected · {inr(board.fee.pending)} still due · {board.fee.rate}% of published demands
      </p>
      {board.fee.byHead.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No collected amount on published demands.</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm">
          {board.fee.byHead.map((row, index) => (
            <li key={row.label} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
                />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 text-slate-500">
                {inr(row.value)} · {row.share}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityCard({ activities }: { activities: FinanceBoard['activities'] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-slate-800">Recent finance activity</h3>
      {activities.length === 0 ? (
        <p className="text-sm text-slate-500">No recent demands or payments.</p>
      ) : (
        <ul className="space-y-2">
          {activities.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-slate-700">{item.title}</span>
              <span className="shrink-0 text-xs text-slate-400">{when(item.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FooterStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <Icon className={cn('h-5 w-5 text-slate-500', tone)} />
      <div>
        <p className={cn('text-lg font-semibold text-slate-900', tone)}>{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
