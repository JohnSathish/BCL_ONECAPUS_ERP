'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchMonthlyFeeDashboard } from '@/services/school-sis';
import { MonthlyFeeSubnav, rs } from './monthly-fee-ui';
import { SlsKpiCard } from '@/components/school-sis/school-sis-saas';
import { AlertTriangle, IndianRupee, Receipt, Wallet } from 'lucide-react';

export function MonthlyFeeDashboard() {
  const enabled = useAuthQueryEnabled();
  const query = useQuery({
    queryKey: ['monthly-fee-dashboard'],
    queryFn: fetchMonthlyFeeDashboard,
    enabled,
  });
  const d = query.data;
  return (
    <div className="space-y-5">
      <MonthlyFeeSubnav />
      <div>
        <h1 className="text-2xl font-semibold text-[var(--school-erp-text)]">
          Monthly fees · Nursery–X
        </h1>
        <p className="text-sm text-slate-500">
          Session {d?.academicYear.name ?? '—'}. Collection uses the same students, classes and
          academic year as the rest of the school ERP.
        </p>
      </div>
      {query.isLoading ? <p className="text-sm text-slate-500">Loading dashboard…</p> : null}
      <div className="sls-stat-grid is-4">
        <SlsKpiCard
          tone="sky"
          icon={Receipt}
          label="Today's collection"
          value={rs(d?.todayCollection ?? 0)}
          hint={`${d?.todayCount ?? 0} receipts`}
          loading={query.isLoading}
        />
        <SlsKpiCard
          tone="emerald"
          icon={Wallet}
          label="This month's collection"
          value={rs(d?.monthCollection ?? 0)}
          hint={`${d?.monthPaid ?? 0} students paid`}
          loading={query.isLoading}
        />
        <SlsKpiCard
          tone="amber"
          icon={IndianRupee}
          label="Total pending fees"
          value={rs(d?.pendingFees ?? 0)}
          hint={`${d?.monthPending ?? 0} students pending`}
          loading={query.isLoading}
        />
        <SlsKpiCard
          tone="rose"
          icon={AlertTriangle}
          label="Late payments"
          value={String(d?.latePayments ?? 0)}
          hint={`${d?.enrolled ?? 0} enrolled Nursery–X`}
          loading={query.isLoading}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Month-wise collection</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d?.byMonth ?? []}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="amount" fill="#1a365d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">Class-wise this month</h2>
          <ul className="space-y-2 text-sm">
            {(d?.byClass ?? []).map((row) => (
              <li key={row.name} className="flex justify-between border-b border-slate-50 py-1">
                <span>{row.name}</span>
                <span className="tabular-nums">
                  {rs(row.amount)} · {row.paid} paid
                </span>
              </li>
            ))}
            {!d?.byClass.length ? (
              <li className="text-slate-500">No collections yet this month.</li>
            ) : null}
          </ul>
        </section>
      </div>
      <Link
        href="/admin/school-sis/fees/collect"
        className="inline-flex h-11 items-center rounded-xl bg-[var(--school-erp-primary)] px-4 text-sm font-medium text-white"
      >
        Collect a payment
      </Link>
    </div>
  );
}
