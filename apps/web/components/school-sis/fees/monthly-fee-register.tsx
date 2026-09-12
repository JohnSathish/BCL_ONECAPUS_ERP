'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  downloadMonthlyFeeRegisterXlsx,
  fetchMonthlyFeeConfig,
  fetchMonthlyFeeRegister,
  voidMonthlyFee,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { MonthlyFeeSubnav, currentFeeMonth, rs } from './monthly-fee-ui';

export function MonthlyFeeRegister() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentFeeMonth());
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const config = useQuery({
    queryKey: ['monthly-fee-config'],
    queryFn: fetchMonthlyFeeConfig,
    enabled,
  });
  const params = {
    month: month || undefined,
    status: status || undefined,
    paymentMode: mode || undefined,
    gradeId: gradeId || undefined,
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
  };
  const query = useQuery({
    queryKey: ['monthly-fee-register', params],
    queryFn: () => fetchMonthlyFeeRegister(params),
    enabled,
  });
  return (
    <div className="space-y-5">
      <MonthlyFeeSubnav />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monthly collection register</h1>
          <p className="text-sm text-slate-500">{query.data?.academicYear.name}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            className="rounded-xl border bg-white px-3 py-2 text-sm"
            onClick={() => window.print()}
          >
            Print / PDF
          </button>
          <button
            type="button"
            className="rounded-xl border bg-white px-3 py-2 text-sm"
            onClick={() =>
              downloadMonthlyFeeRegisterXlsx(params).catch((err) => setError(apiErrorMessage(err)))
            }
          >
            Export Excel
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <input
          type="month"
          className="h-10 rounded-xl border px-3"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <select
          className="h-10 rounded-xl border px-3"
          value={gradeId}
          onChange={(e) => setGradeId(e.target.value)}
        >
          <option value="">All classes</option>
          {(config.data?.plans ?? []).map((p) => (
            <option key={p.gradeId} value={p.gradeId}>
              {p.grade.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border px-3"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All status</option>
          <option value="PAID">Paid</option>
          <option value="VOIDED">Voided</option>
        </select>
        <select
          className="h-10 rounded-xl border px-3"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="">All modes</option>
          {['CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER'].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input
          type="date"
          className="h-10 rounded-xl border px-3"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          className="h-10 rounded-xl border px-3"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <input
          className="h-10 rounded-xl border px-3"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {query.isLoading ? <p className="text-sm text-slate-500">Loading register…</p> : null}
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[64rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Late</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Receipt</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 print:hidden">Action</th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows ?? []).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2">{row.student.fullName}</td>
                <td className="px-3 py-2">
                  {row.className} {row.sectionName}
                </td>
                <td className="px-3 py-2">{row.monthLabel}</td>
                <td className="px-3 py-2 tabular-nums">{rs(row.tuitionAmount)}</td>
                <td className="px-3 py-2 tabular-nums">{rs(row.lateFeeAmount)}</td>
                <td className="px-3 py-2 font-medium tabular-nums">{rs(row.totalAmount)}</td>
                <td className="px-3 py-2">{row.paymentMode}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.receiptNumber}</td>
                <td className="px-3 py-2">{new Date(row.paidAt).toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${row.status === 'PAID' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-2 print:hidden">
                  <Link
                    className="mr-2 text-[var(--school-erp-primary)]"
                    href={`/admin/school-sis/fees/receipts/${row.id}`}
                  >
                    View
                  </Link>
                  {canManage && row.status === 'PAID' ? (
                    <button
                      type="button"
                      className="text-rose-700"
                      onClick={() => {
                        const reason = window.prompt('Void reason (audit trail required)');
                        if (!reason) return;
                        void voidMonthlyFee(row.id, reason)
                          .then(() => {
                            setError(null);
                            void qc.invalidateQueries({ queryKey: ['monthly-fee-register'] });
                          })
                          .catch((err) => setError(apiErrorMessage(err)));
                      }}
                    >
                      Void
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!query.isLoading && !query.data?.rows.length ? (
          <p className="p-8 text-center text-sm text-slate-500">No payments match these filters.</p>
        ) : null}
      </div>
    </div>
  );
}
