'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { collectMonthlyFee, fetchMonthlyFeePending } from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { MonthlyFeeSubnav, currentFeeMonth, rs } from './monthly-fee-ui';

export function MonthlyFeePending() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const [month, setMonth] = useState(currentFeeMonth());
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['monthly-fee-pending', month],
    queryFn: () => fetchMonthlyFeePending(month),
    enabled,
  });
  return (
    <div className="space-y-5">
      <MonthlyFeeSubnav />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pending monthly fees</h1>
          <p className="text-sm text-slate-500">{query.data?.monthLabel} · Nursery–Class IV</p>
        </div>
        <input
          type="month"
          className="h-10 rounded-xl border px-3"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {query.isLoading ? <p className="text-sm text-slate-500">Loading pending list…</p> : null}
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Class</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Outstanding</th>
              <th className="px-3 py-2">Arrears</th>
              <th className="px-3 py-2">Late fee</th>
              <th className="px-3 py-2">Total due</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows ?? []).map((row) => (
              <tr key={row.studentId} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{row.fullName}</div>
                  <div className="text-xs text-slate-400">{row.admissionNumber}</div>
                </td>
                <td className="px-3 py-2">
                  {row.className} {row.sectionName}
                </td>
                <td className="px-3 py-2">{query.data?.monthLabel}</td>
                <td className="px-3 py-2 tabular-nums">{rs(row.tuitionAmount)}</td>
                <td className="px-3 py-2 tabular-nums">{rs(row.previousBalance ?? 0)}</td>
                <td className="px-3 py-2 tabular-nums">{rs(row.lateFeeAmount)}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">{rs(row.totalDue)}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--school-erp-primary)] px-3 py-1.5 text-xs text-white"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Collect ${rs(row.totalDue)} in cash for ${row.fullName}?`,
                          )
                        )
                          return;
                        void collectMonthlyFee({
                          studentId: row.studentId,
                          feeMonth: month,
                          paymentMode: 'CASH',
                        })
                          .then(() => {
                            setError(null);
                            void qc.invalidateQueries({ queryKey: ['monthly-fee-pending'] });
                          })
                          .catch((err) => setError(apiErrorMessage(err)));
                      }}
                    >
                      Collect
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!query.isLoading && !query.data?.rows.length ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No pending monthly fees for this month.
          </p>
        ) : null}
      </div>
    </div>
  );
}
