'use client';

import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchFeeReport } from '@/services/fees';

export default function FeeOutstandingReportPage() {
  const session = useRequireAuth();

  const report = useQuery({
    queryKey: ['reports', 'fee-outstanding'],
    queryFn: () => fetchFeeReport('outstanding'),
    enabled: Boolean(session),
  });

  if (!session) return null;

  const rows = (report.data?.rows ?? []) as Array<{
    id: string;
    studentId?: string;
    balanceAmount?: string | number;
    totalAmount?: string | number;
    demandType?: string;
    billingPeriod?: string;
  }>;

  return (
    <DashboardShell role="admin" title="Fee Outstanding Summary">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Outstanding fee demands sorted by balance amount.
        </p>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total outstanding</p>
          <p className="text-2xl font-semibold">
            ₹{Number(report.data?.total ?? 0).toLocaleString('en-IN')}
          </p>
        </div>
        <div className="overflow-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Demand</th>
                <th className="px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.studentId?.slice(0, 8) ?? '—'}…
                  </td>
                  <td className="px-3 py-2">{row.demandType ?? '—'}</td>
                  <td className="px-3 py-2">{row.billingPeriod ?? '—'}</td>
                  <td className="px-3 py-2">
                    ₹{Number(row.totalAmount ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    ₹{Number(row.balanceAmount ?? 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!report.isLoading && rows.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">No outstanding demands.</p>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
