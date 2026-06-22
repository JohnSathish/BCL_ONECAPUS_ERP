'use client';

import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/erp/glass-card';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchRecruitmentAnalytics } from '@/services/hr';

export function HrRecruitmentAnalytics() {
  const enabled = useAuthQueryEnabled();
  const analyticsQ = useQuery({
    queryKey: ['hr', 'recruitment', 'analytics'],
    queryFn: fetchRecruitmentAnalytics,
    enabled,
  });
  const data = analyticsQ.data;

  if (analyticsQ.isLoading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  }
  if (!data) return null;

  const maxFunnel = Math.max(...data.funnel.map((f) => f.count), 1);
  const maxDept = Math.max(...data.byVacancy.map((v) => v.applications), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ['Total Applications', data.totals.applications, 'from-sky-500 to-blue-600'],
          ['Hired / Appointed', data.totals.hired, 'from-emerald-500 to-teal-600'],
          ['Conversion Rate', `${data.totals.conversionRate}%`, 'from-violet-500 to-purple-600'],
          ['Portal (30 days)', data.totals.publicLast30Days, 'from-amber-500 to-orange-500'],
        ].map(([label, value, grad]) => (
          <div
            key={label as string}
            className={`rounded-2xl bg-gradient-to-br ${grad as string} p-4 text-white shadow-md`}
          >
            <p className="text-[11px] font-medium uppercase text-white/80">{label as string}</p>
            <p className="mt-2 text-3xl font-bold">{value as string | number}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h3 className="mb-4 font-semibold">Interview Conversion Funnel</h3>
          <div className="space-y-3">
            {data.funnel
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((row) => (
                <div key={row.status}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{row.status.replace(/_/g, ' ')}</span>
                    <span className="font-semibold">{row.count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-[#1e3a5f] to-[#c8102e]"
                      style={{ width: `${(row.count / maxFunnel) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="mb-4 font-semibold">Applications by Department / Vacancy</h3>
          <div className="space-y-3">
            {data.byVacancy.slice(0, 8).map((v) => (
              <div key={v.id}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="truncate pr-2">{v.title}</span>
                  <span className="shrink-0 font-semibold">{v.applications}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(v.applications / maxDept) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!data.byVacancy.length ? (
              <p className="text-sm text-muted-foreground">No vacancy data yet.</p>
            ) : null}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h3 className="mb-3 font-semibold">Source Breakdown</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            <strong>{data.totals.publicApplications}</strong> careers portal
          </span>
          <span>
            <strong>{data.totals.internalApplications}</strong> internal
          </span>
          <span>
            <strong>{data.totals.rejected}</strong> rejected
          </span>
        </div>
      </GlassCard>
    </div>
  );
}
