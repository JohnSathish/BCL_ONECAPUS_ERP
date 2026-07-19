'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { fetchCenterDashboard } from '@/services/fee-collection-centers';

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function FeeCollectionDashboardPage() {
  const dashQ = useQuery({
    queryKey: ['fcc', 'dashboard'],
    queryFn: fetchCenterDashboard,
  });

  if (dashQ.isLoading) {
    return <p className="text-sm text-slate-400">Loading dashboard…</p>;
  }
  if (dashQ.isError) {
    return <QueryErrorPanel title="Unable to load dashboard" error={dashQ.error} />;
  }

  const data = dashQ.data!;
  const cards = [
    { label: 'Today collections', value: inr(data.today.collections) },
    { label: 'Transactions', value: String(data.today.transactions) },
    { label: 'Successful', value: String(data.today.successful) },
    { label: 'Failed', value: String(data.today.failed) },
    { label: 'Pending', value: String(data.today.pending) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">{data.center.businessName}</h2>
          <p className="text-sm text-slate-400">Operator: {data.center.operatorName}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/fee-collection-portal/pay"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400"
          >
            Collect fee
          </Link>
          <Link
            href="/fee-collection-portal/transactions"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            History
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="mt-2 text-xl font-semibold text-white">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-medium text-white">Recent today</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="py-2">Txn</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No collections yet today.
                  </td>
                </tr>
              ) : (
                data.recent.map((t) => (
                  <tr key={t.id} className="border-t border-white/5 text-slate-200">
                    <td className="py-2 font-mono text-xs">{t.transactionNo}</td>
                    <td>{inr(t.amount)}</td>
                    <td>{t.status}</td>
                    <td>{t.receipts?.[0]?.receiptNo ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
