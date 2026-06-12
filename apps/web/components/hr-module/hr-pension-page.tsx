'use client';

import { useQuery } from '@tanstack/react-query';

import { GlassCard } from '@/components/erp/glass-card';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPensionEnrollments, fetchPensionLedger, fetchPensionStats } from '@/services/hr';
import { formatInr } from '@/components/hr-module/pay-scale-utils';

export function HrPensionPage() {
  const enabled = useAuthQueryEnabled();
  const statsQ = useQuery({
    queryKey: ['hr', 'pension', 'stats'],
    queryFn: fetchPensionStats,
    enabled,
  });
  const enrollQ = useQuery({
    queryKey: ['hr', 'pension', 'enrollments'],
    queryFn: () => fetchPensionEnrollments(),
    enabled,
  });
  const ledgerQ = useQuery({
    queryKey: ['hr', 'pension', 'ledger', new Date().getFullYear()],
    queryFn: () => fetchPensionLedger(undefined, new Date().getFullYear()),
    enabled,
  });

  const stats = statsQ.data;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Pension Management</h2>
        <p className="text-sm text-muted-foreground">
          Retirement planning, enrollments, and pension accrual history.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
          <p className="text-[11px] uppercase text-muted-foreground">Enrolled Staff</p>
          <p className="text-2xl font-bold">{stats?.enrolled ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
          <p className="text-[11px] uppercase text-muted-foreground">Retiring Soon</p>
          <p className="text-2xl font-bold">{stats?.retiringSoon ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
          <p className="text-[11px] uppercase text-muted-foreground">YTD Accrual</p>
          <p className="text-2xl font-bold">{stats ? formatInr(stats.ytdAccrual) : '—'}</p>
        </div>
      </div>

      <GlassCard className="p-4">
        <h3 className="mb-3 font-semibold">Pension Enrollments</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Staff</th>
              <th>Scheme</th>
              <th>Last Basic</th>
              <th>Retirement</th>
            </tr>
          </thead>
          <tbody>
            {(enrollQ.data ?? []).map((e) => (
              <tr key={e.id} className="border-b border-border/60">
                <td className="py-2">
                  {e.staffProfile?.fullName}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {e.staffProfile?.employeeCode}
                  </span>
                </td>
                <td className="py-2">{e.schemeType}</td>
                <td className="py-2">
                  {e.lastDrawnBasic ? formatInr(Number(e.lastDrawnBasic)) : '—'}
                </td>
                <td className="py-2">{e.staffProfile?.retirementDate?.slice(0, 10) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!enrollQ.data?.length ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No enrollments yet. Enroll staff nearing superannuation via API or staff profile.
          </p>
        ) : null}
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="mb-3 font-semibold">Pension Ledger ({new Date().getFullYear()})</h3>
        <ul className="space-y-1 text-sm">
          {(ledgerQ.data ?? [])
            .slice(0, 50)
            .map(
              (row: {
                id: string;
                month: number;
                year: number;
                accrualAmount: string | number;
                staffProfile?: { fullName: string };
              }) => (
                <li key={row.id} className="flex justify-between border-b border-border/40 py-1">
                  <span>
                    {row.staffProfile?.fullName} · {row.month}/{row.year}
                  </span>
                  <span className="font-medium">{formatInr(Number(row.accrualAmount))}</span>
                </li>
              ),
            )}
        </ul>
      </GlassCard>
    </div>
  );
}
