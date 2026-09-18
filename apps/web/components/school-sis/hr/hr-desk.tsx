'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Gift,
  GraduationCap,
  Hourglass,
  Info,
  Play,
  Star,
  Timer,
  Umbrella,
  UserMinus,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchHrDashboard } from '@/services/school-sis';
import { cn } from '@/utils/cn';
import { HrShell, inrPaise } from './hr-ui';

type Slice = { name: string; value: number; color: string };

function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function fmtDay(value?: string | Date | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function pct(part: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const sum = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = slices.map((s) => {
    const start = (acc / sum) * 100;
    acc += s.value;
    const end = (acc / sum) * 100;
    return `${s.color} ${start}% ${end}%`;
  });
  return (
    <div
      className="relative h-[132px] w-[132px] shrink-0 rounded-full"
      style={{ background: `conic-gradient(${stops.join(',')})` }}
    >
      <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white">
        <p className="text-2xl font-bold text-slate-800">{total}</p>
        <p className="text-[11px] text-slate-400">Total</p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  delta?: string;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,76,140,0.06)]">
      <span
        className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', tone)}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-[22px] font-bold leading-tight text-slate-800">{value}</p>
          {delta ? <span className="text-xs font-semibold text-emerald-500">{delta}</span> : null}
        </div>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  href,
  linkLabel,
  children,
  className,
}: {
  title: string;
  icon: typeof Users;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white bg-white p-4 shadow-[0_8px_24px_rgba(15,76,140,0.06)]',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Icon className="h-4 w-4 text-[#2563eb]" />
          {title}
        </h2>
        {href ? (
          <Link href={href} className="text-xs font-semibold text-[#2563eb] hover:underline">
            {linkLabel ?? 'View all'} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function HrDashboardDesk() {
  const enabled = useAuthQueryEnabled();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const q = useQuery({
    queryKey: ['hr-dash', month],
    queryFn: () => fetchHrDashboard(month),
    enabled,
  });
  const k = q.data?.kpis;
  const total = Number(k?.total ?? 0);
  const teaching = Number(k?.teaching ?? 0);
  const nonTeaching = Number(k?.nonTeaching ?? 0);
  const byType = (q.data?.byType ?? []) as Array<{ name: string; value: number }>;
  const management = byType.filter((r) => /manage/i.test(r.name)).reduce((s, r) => s + r.value, 0);
  const typeSlices: Slice[] = [
    { name: 'Teaching', value: teaching, color: '#2563eb' },
    {
      name: 'Non-Teaching',
      value: Math.max(0, nonTeaching - management),
      color: '#a78bfa',
    },
    { name: 'Management', value: management, color: '#facc15' },
    {
      name: 'Others',
      value: Math.max(0, total - teaching - nonTeaching),
      color: '#cbd5e1',
    },
  ];
  const deptRaw = (q.data?.byDept ?? []) as Array<{ name: string; value: number }>;
  const deptColors = ['#2563eb', '#38bdf8', '#a78bfa', '#34d399', '#f59e0b', '#fb7185'];
  const deptSlices: Slice[] = (
    deptRaw.length ? deptRaw : [{ name: 'Unassigned', value: total || 1 }]
  ).map((r, i) => ({
    name: r.name,
    value: r.value,
    color: deptColors[i % deptColors.length],
  }));
  const status = q.data?.staffStatus ?? {
    active: k?.active ?? 0,
    onLeave: k?.onLeaveToday ?? 0,
    absent: k?.absentToday ?? 0,
    inactive: 0,
  };
  const statusMax = Math.max(status.active, status.onLeave, status.absent, status.inactive, 1);
  const att = q.data?.attendance ?? {};
  const leave = q.data?.leave ?? {};
  const payrollStatus = String(q.data?.payrollStatus ?? 'NOT_STARTED');
  const payrollLabel =
    payrollStatus === 'NOT_STARTED'
      ? 'Payroll not started'
      : payrollStatus
          .replaceAll('_', ' ')
          .toLowerCase()
          .replace(/^\w/, (c) => c.toUpperCase());

  const birthdays = (q.data?.birthdays ?? []) as Array<{
    id: string;
    fullName: string;
    designation?: string;
    date?: string;
    initials?: string;
  }>;
  const anniversaries = (q.data?.anniversaries ?? []) as Array<{
    id: string;
    fullName: string;
    designation?: string;
    date?: string;
    initials?: string;
  }>;

  const kpis = useMemo(
    () => [
      {
        label: 'Total Employees',
        value: k?.total ?? '—',
        hint: 'All staff members',
        delta: '↑ 0%',
        icon: Users,
        tone: 'bg-sky-100 text-sky-600',
      },
      {
        label: 'Teaching Staff',
        value: k?.teaching ?? '—',
        hint: 'Teaching faculty',
        delta: '↑ 0%',
        icon: GraduationCap,
        tone: 'bg-cyan-100 text-cyan-600',
      },
      {
        label: 'Non-Teaching Staff',
        value: k?.nonTeaching ?? '—',
        hint: 'Administrative & support',
        delta: '—',
        icon: Users,
        tone: 'bg-violet-100 text-violet-600',
      },
      {
        label: 'Active Employees',
        value: k?.active ?? '—',
        hint: 'Currently active',
        delta: total ? `↑ ${pct(Number(k?.active ?? 0), total)}` : '—',
        icon: UserRound,
        tone: 'bg-emerald-100 text-emerald-600',
      },
      {
        label: 'On Leave Today',
        value: k?.onLeaveToday ?? 0,
        hint: 'Employees on leave',
        delta: '—',
        icon: CalendarDays,
        tone: 'bg-amber-100 text-amber-600',
      },
      {
        label: 'Present Today',
        value: k?.presentToday ?? 0,
        hint: 'Marked present',
        delta: total ? `${pct(Number(k?.presentToday ?? 0), total)}` : '0%',
        icon: CheckCircle2,
        tone: 'bg-emerald-100 text-emerald-600',
      },
      {
        label: 'Absent Today',
        value: k?.absentToday ?? 0,
        hint: 'Employees absent',
        delta: '0%',
        icon: UserMinus,
        tone: 'bg-rose-100 text-rose-500',
      },
      {
        label: 'Late Today',
        value: k?.lateToday ?? 0,
        hint: 'Employees late',
        delta: '0%',
        icon: Clock3,
        tone: 'bg-orange-100 text-orange-500',
      },
      {
        label: 'Payroll (Net)',
        value: inrPaise(k?.payrollNet),
        hint: 'This month',
        delta: '—',
        icon: Banknote,
        tone: 'bg-violet-100 text-violet-600',
      },
      {
        label: 'Salary Paid',
        value: inrPaise(k?.salaryPaid),
        hint: 'This month',
        delta: '—',
        icon: Wallet,
        tone: 'bg-emerald-100 text-emerald-600',
      },
      {
        label: 'Salary Pending',
        value: inrPaise(k?.salaryPending),
        hint: 'Pending disbursement',
        delta: '—',
        icon: Hourglass,
        tone: 'bg-rose-100 text-rose-500',
      },
      {
        label: 'Expiring Documents',
        value: k?.expiringDocuments ?? 0,
        hint: 'Within 30 days',
        delta: '—',
        icon: FileText,
        tone: 'bg-sky-100 text-sky-600',
      },
    ],
    [k, total],
  );

  return (
    <HrShell
      title="HR Dashboard"
      subtitle={`Overview of your staff, attendance, leave, payroll and key HR activities for ${monthLabel(month)}.`}
      extra={
        <label className="relative inline-flex h-10 items-center rounded-xl bg-white pl-9 pr-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <span className="mr-2 hidden sm:inline">{monthLabel(month)}</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      }
    >
      {q.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {q.error ? <p className="text-sm text-rose-600">Could not load HR dashboard.</p> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((card) => (
          <Kpi key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Employee distribution" icon={Users}>
          <div className="flex items-center gap-6">
            <Donut slices={typeSlices} total={total} />
            <ul className="space-y-2 text-sm">
              {typeSlices.map((s) => (
                <li key={s.name} className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="w-28">{s.name}</span>
                  <span className="font-medium text-slate-800">
                    {s.value} ({pct(s.value, total)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Department distribution" icon={Users}>
          <div className="flex items-center gap-6">
            <Donut slices={deptSlices} total={deptSlices.reduce((s, x) => s + x.value, 0)} />
            <ul className="space-y-2 text-sm">
              {deptSlices.map((s) => (
                <li key={s.name} className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="max-w-[7.5rem] truncate">{s.name}</span>
                  <span className="font-medium text-slate-800">
                    {s.value} ({pct(s.value, total)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel title="Staff status" icon={UserRound}>
          <ul className="space-y-3 text-sm">
            {[
              { label: 'Active', value: status.active, color: 'bg-emerald-400' },
              { label: 'On Leave', value: status.onLeave, color: 'bg-amber-300' },
              { label: 'Absent', value: status.absent, color: 'bg-rose-400' },
              { label: 'Inactive', value: status.inactive, color: 'bg-slate-300' },
            ].map((row) => (
              <li key={row.label} className="grid grid-cols-[5.5rem_1fr_1.5rem] items-center gap-2">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className={cn('h-2.5 w-2.5 rounded-full', row.color)} />
                  {row.label}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={cn('block h-full rounded-full', row.color)}
                    style={{
                      width: `${row.value ? Math.max(8, (row.value / statusMax) * 100) : 0}%`,
                    }}
                  />
                </span>
                <span className="text-right font-medium text-slate-700">{row.value}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Attendance today"
          icon={CalendarDays}
          href="/admin/school-sis/hr/attendance"
          linkLabel="View Attendance"
        >
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Present', value: att.PRESENT ?? 0, box: 'bg-emerald-50 text-emerald-700' },
              { label: 'Absent', value: att.ABSENT ?? 0, box: 'bg-rose-50 text-rose-600' },
              { label: 'Late', value: att.LATE ?? 0, box: 'bg-orange-50 text-orange-600' },
              { label: 'Half Day', value: att.HALF_DAY ?? 0, box: 'bg-violet-50 text-violet-600' },
              { label: 'On Leave', value: att.LEAVE ?? 0, box: 'bg-fuchsia-50 text-fuchsia-600' },
            ].map((cell) => (
              <div key={cell.label} className={cn('rounded-xl px-1 py-3 text-center', cell.box)}>
                <p className="text-lg font-bold">{cell.value}</p>
                <p className="text-[11px]">{cell.label}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Leave overview"
          icon={Umbrella}
          href="/admin/school-sis/hr/leave"
          linkLabel="View Leave"
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-amber-50 px-2 py-3 text-center text-amber-700">
              <Timer className="mx-auto mb-1 h-4 w-4" />
              <p className="text-lg font-bold">{leave.pending ?? 0}</p>
              <p className="text-[11px]">Pending</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-2 py-3 text-center text-emerald-700">
              <CheckCircle2 className="mx-auto mb-1 h-4 w-4" />
              <p className="text-lg font-bold">{leave.approved ?? 0}</p>
              <p className="text-[11px]">Approved</p>
            </div>
            <div className="rounded-xl bg-rose-50 px-2 py-3 text-center text-rose-600">
              <XCircle className="mx-auto mb-1 h-4 w-4" />
              <p className="text-lg font-bold">{leave.rejected ?? 0}</p>
              <p className="text-[11px]">Rejected</p>
            </div>
          </div>
        </Panel>
        <Panel
          title="Payroll status"
          icon={Wallet}
          href="/admin/school-sis/hr/payroll"
          linkLabel="View Payroll"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <p className="font-semibold text-slate-800">{payrollLabel}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Process payroll to see salary details, payslips and disbursement status.
                </p>
              </div>
            </div>
            <Link
              href="/admin/school-sis/hr/payroll"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1d4ed8] px-3 py-2 text-xs font-semibold text-white"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Process Payroll
            </Link>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Upcoming birthdays"
          icon={Gift}
          href="/admin/school-sis/hr/employees"
          linkLabel="View All"
        >
          {!birthdays.length ? (
            <p className="text-sm text-slate-500">None this month</p>
          ) : (
            <ul className="space-y-2">
              {birthdays.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbeafe] text-xs font-bold text-[#1d4ed8]">
                      {row.initials || row.fullName.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{row.fullName}</p>
                      <p className="text-xs text-slate-500">{row.designation || 'Staff'}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {fmtDay(row.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Work anniversaries"
          icon={Star}
          href="/admin/school-sis/hr/employees"
          linkLabel="View All"
        >
          {!anniversaries.length ? (
            <p className="text-sm text-slate-500">None this month</p>
          ) : (
            <ul className="space-y-2">
              {anniversaries.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbeafe] text-xs font-bold text-[#1d4ed8]">
                      {row.initials || row.fullName.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{row.fullName}</p>
                      <p className="text-xs text-slate-500">{row.designation || 'Staff'}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {fmtDay(row.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-[#e8f3ff] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#2563eb] shadow-sm">
            <Info className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#1d4ed8]">
              Keep your staff information up to date
            </p>
            <p className="text-xs text-slate-500">
              Update employee records, documents and department details to ensure smooth HR and
              payroll processing.
            </p>
          </div>
        </div>
        <Link
          href="/admin/school-sis/hr/employees"
          className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold text-[#1d4ed8] shadow-sm ring-1 ring-sky-100"
        >
          View Employees
        </Link>
      </div>
    </HrShell>
  );
}
