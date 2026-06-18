'use client';

import { useQuery } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { SaaSCard, SectionTitle, money } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPrincipalFeeDefaulters } from '@/services/principal-desk';

export default function FeesPage() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['principal-desk', 'fees'],
    queryFn: () => fetchPrincipalFeeDefaulters(),
    enabled,
  });

  return (
    <PrincipalDeskShell
      title="Fee & Defaulter Monitor"
      subtitle="Outstanding fees across the college"
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <SaaSCard>
              <p className="text-xs text-slate-500">Total Outstanding</p>
              <p className="text-2xl font-black text-rose-600">
                {money(data.cards.totalOutstanding)}
              </p>
            </SaaSCard>
            <SaaSCard>
              <p className="text-xs text-slate-500">Admission Fee Pending</p>
              <p className="text-2xl font-black">{data.cards.admissionFeePending}</p>
            </SaaSCard>
            <SaaSCard>
              <p className="text-xs text-slate-500">Monthly Dues</p>
              <p className="text-2xl font-black">{data.cards.monthlyDuesPending}</p>
            </SaaSCard>
          </div>
          <SaaSCard>
            <SectionTitle title="Defaulter List" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2">Student</th>
                    <th>Department</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.rows ?? []).map((row: Record<string, unknown>) => (
                    <tr key={String(row.studentId)} className="border-b border-slate-100">
                      <td className="py-2">
                        <p className="font-semibold">{String(row.fullName)}</p>
                        <p className="text-xs text-slate-500">{String(row.enrollmentNumber)}</p>
                      </td>
                      <td>{String(row.department ?? '—')}</td>
                      <td className="font-bold text-rose-600">
                        {money(Number(row.totalOutstanding ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SaaSCard>
        </div>
      ) : null}
    </PrincipalDeskShell>
  );
}
