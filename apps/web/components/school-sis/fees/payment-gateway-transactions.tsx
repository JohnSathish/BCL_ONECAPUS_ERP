'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchSchoolGatewayTransactions } from '@/services/school-sis';
import { rs, MonthlyFeeSubnav } from './monthly-fee-ui';

const STATUSES = ['CREATED', 'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'];

export function PaymentGatewayTransactions() {
  const enabled = useAuthQueryEnabled();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [student, setStudent] = useState('');
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['school-gateway-txns', from, to, status, student, q],
    queryFn: () => fetchSchoolGatewayTransactions({ from, to, status, student, q }),
    enabled,
  });
  const items = query.data?.items ?? [];

  return (
    <div className="space-y-5">
      <MonthlyFeeSubnav />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Gateway transactions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Server-verified online fee payments. Browser redirects are never trusted on their own.
        </p>
      </div>
      <div className="grid gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:grid-cols-2 lg:grid-cols-5">
        <input
          className="h-10 rounded-xl border px-3 text-sm"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          className="h-10 rounded-xl border px-3 text-sm"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <select
          className="h-10 rounded-xl border px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          className="h-10 rounded-xl border px-3 text-sm"
          placeholder="Student / admission no."
          value={student}
          onChange={(e) => setStudent(e.target.value)}
        />
        <input
          className="h-10 rounded-xl border px-3 text-sm"
          placeholder="Transaction / order ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Transaction</th>
              <th className="px-3 py-3">Gateway</th>
              <th className="px-3 py-3">Student</th>
              <th className="px-3 py-3">Amount</th>
              <th className="px-3 py-3">Fee ref.</th>
              <th className="px-3 py-3">Order / Payment</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-mono text-xs">{row.id.slice(0, 8)}</td>
                <td className="px-3 py-2">{row.gateway}</td>
                <td className="px-3 py-2">
                  <div>{row.student}</div>
                  <div className="text-xs text-slate-400">{row.admissionNumber}</div>
                </td>
                <td className="px-3 py-2 tabular-nums">{rs(row.amount)}</td>
                <td className="px-3 py-2">{row.feeReference}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {row.orderId}
                  {row.paymentId ? <div>{row.paymentId}</div> : null}
                </td>
                <td className="px-3 py-2 text-xs font-semibold">{row.status}</td>
                <td className="px-3 py-2 text-xs">
                  {new Date(row.createdAt).toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length ? (
          <p className="p-8 text-center text-sm text-slate-500">No gateway transactions yet.</p>
        ) : null}
      </div>
    </div>
  );
}
