'use client';

import { useQuery } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchFeeReport } from '@/services/fees';

type OutstandingRow = {
  demandNo?: string;
  rollNumber?: string | null;
  universityRollNumber?: string | null;
  studentName?: string | null;
  programme?: string | null;
  demandType?: string;
  billingPeriod?: string | null;
  balanceAmount?: string | number;
  totalAmount?: string | number;
};

export default function FeeOutstandingReportPage() {
  const session = useRequireAuth();

  const report = useQuery({
    queryKey: ['reports', 'fee-outstanding'],
    queryFn: () => fetchFeeReport('outstanding'),
    enabled: Boolean(session),
  });

  if (!session) return null;

  const rows = (report.data?.rows ?? []) as OutstandingRow[];
  const meta = report.data?.meta as
    | { orphanDemandsExcluded?: number; linkedDemands?: number }
    | undefined;

  return (
    <DashboardShell role="admin" title="Fee Outstanding Summary">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Outstanding fee demands for linked students only (orphan demands excluded by default).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total outstanding</p>
            <p className="text-2xl font-semibold">
              ₹{Number(report.data?.total ?? 0).toLocaleString('en-IN')}
            </p>
          </div>
          {meta?.orphanDemandsExcluded ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                {meta.orphanDemandsExcluded} orphan demand(s) excluded — clean up under Fees →
                Financial Reports.
              </p>
            </div>
          ) : null}
        </div>
        <div className="overflow-auto rounded-2xl border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Demand No.</th>
                <th className="px-3 py-2">Roll No.</th>
                <th className="px-3 py-2">NEHU Roll No.</th>
                <th className="px-3 py-2">Student Name</th>
                <th className="px-3 py-2">Programme</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.demandNo ?? 'row'}-${index}`} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{row.demandNo ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.rollNumber ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.universityRollNumber ?? '—'}</td>
                  <td className="px-3 py-2 font-medium">{row.studentName ?? '—'}</td>
                  <td className="px-3 py-2">{row.programme ?? '—'}</td>
                  <td className="px-3 py-2">{row.demandType ?? '—'}</td>
                  <td className="px-3 py-2">{row.billingPeriod ?? '—'}</td>
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
