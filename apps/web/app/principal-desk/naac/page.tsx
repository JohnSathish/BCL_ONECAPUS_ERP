'use client';

import { useQuery } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { CircularProgress, SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchNaacReadiness } from '@/services/principal-desk';

export default function NaacPage() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['principal-desk', 'naac'],
    queryFn: fetchNaacReadiness,
    enabled,
  });

  return (
    <PrincipalDeskShell title="NAAC Readiness" subtitle="Criteria-wise accreditation preparedness">
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            <CircularProgress value={data.overallReadiness ?? 0} size={120} label="Readiness" />
            <div>
              <p className="text-sm text-slate-500">Overall Readiness</p>
              <p className="text-3xl font-black text-indigo-600">{data.overallReadiness ?? 0}%</p>
              <p className="text-sm">
                AQAR: {data.aqarStatus} · {data.aqarCompletionPct}% complete
              </p>
              <p className="text-xs text-slate-500">Academic year {data.academicYear}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data.criterionStatus ?? []).map((c: Record<string, unknown>) => (
              <SaaSCard key={String(c.criterion)}>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Criteria {String(c.criterion)}
                </p>
                <p className="text-2xl font-black">{String(c.score)}%</p>
                <p className="text-xs text-slate-500">{String(c.label ?? '')}</p>
              </SaaSCard>
            ))}
          </div>
        </div>
      ) : null}
    </PrincipalDeskShell>
  );
}
