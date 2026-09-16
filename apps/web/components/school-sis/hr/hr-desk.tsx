'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchHrDashboard } from '@/services/school-sis';
import { HrCard, HrShell, inrPaise } from './hr-ui';

export function HrDashboardDesk() {
  const enabled = useAuthQueryEnabled();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const q = useQuery({
    queryKey: ['hr-dash', month],
    queryFn: () => fetchHrDashboard(month),
    enabled,
  });
  const k = q.data?.kpis;
  return (
    <HrShell
      title="HR Dashboard"
      subtitle={month}
      extra={
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
        />
      }
    >
      {q.isLoading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {q.error ? <p className="text-sm text-rose-600">Could not load HR dashboard.</p> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <HrCard label="Total employees" value={k?.total ?? '—'} />
        <HrCard label="Teaching" value={k?.teaching ?? '—'} />
        <HrCard label="Non-teaching" value={k?.nonTeaching ?? '—'} />
        <HrCard label="Active" value={k?.active ?? '—'} />
        <HrCard label="On leave today" value={k?.onLeaveToday ?? '—'} />
        <HrCard label="Present today" value={k?.presentToday ?? '—'} />
        <HrCard label="Absent today" value={k?.absentToday ?? '—'} />
        <HrCard label="Late today" value={k?.lateToday ?? '—'} />
        <HrCard label="Payroll (net)" value={inrPaise(k?.payrollNet)} />
        <HrCard label="Salary paid" value={inrPaise(k?.salaryPaid)} />
        <HrCard label="Salary pending" value={inrPaise(k?.salaryPending)} />
        <HrCard
          label="Expiring documents"
          value={k?.expiringDocuments ?? '—'}
          hint="Within 30 days"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Employee distribution</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(q.data?.byType ?? []).map((r: { name: string; value: number }) => (
              <li key={r.name} className="flex justify-between">
                <span className="text-slate-600">{r.name}</span>
                <span className="font-medium">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">Department distribution</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(q.data?.byDept ?? []).map((r: { name: string; value: number }) => (
              <li key={r.name} className="flex justify-between">
                <span className="text-slate-600">{r.name}</span>
                <span className="font-medium">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold text-slate-800">Attendance today</h2>
          <p className="mt-2 text-slate-600">
            Present {q.data?.attendance?.PRESENT ?? 0} · Absent {q.data?.attendance?.ABSENT ?? 0} ·
            Late {q.data?.attendance?.LATE ?? 0} · Half day {q.data?.attendance?.HALF_DAY ?? 0} ·
            Leave {q.data?.attendance?.LEAVE ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold text-slate-800">Leave overview</h2>
          <p className="mt-2 text-slate-600">
            Pending {q.data?.leave?.pending ?? 0} · Approved {q.data?.leave?.approved ?? 0} ·
            Rejected {q.data?.leave?.rejected ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="font-semibold text-slate-800">Payroll status</h2>
          <p className="mt-2 text-slate-600">{q.data?.payrollStatus ?? 'NOT_STARTED'}</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Upcoming birthdays</h2>
          <ul className="mt-2 text-sm text-slate-600">
            {(q.data?.birthdays ?? []).map((s: { id: string; fullName: string }) => (
              <li key={s.id}>{s.fullName}</li>
            ))}
            {!q.data?.birthdays?.length ? <li>None this month</li> : null}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Work anniversaries</h2>
          <ul className="mt-2 text-sm text-slate-600">
            {(q.data?.anniversaries ?? []).map((s: { id: string; fullName: string }) => (
              <li key={s.id}>{s.fullName}</li>
            ))}
            {!q.data?.anniversaries?.length ? <li>None this month</li> : null}
          </ul>
        </div>
      </div>
    </HrShell>
  );
}
