'use client';

import { useQuery } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPrincipalDashboard } from '@/services/principal-desk';

export default function EventsPage() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['principal-desk', 'dashboard'],
    queryFn: fetchPrincipalDashboard,
    enabled,
  });

  return (
    <PrincipalDeskShell
      title="Events & Meetings"
      subtitle="Today's and upcoming college activities"
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SaaSCard>
            <SectionTitle title="Upcoming Events" />
            <ul className="space-y-2">
              {(data?.upcomingEvents ?? []).map((e, i) => (
                <li key={`${e.date}-${i}`} className="rounded-lg border px-3 py-2 text-sm">
                  <span className="font-semibold text-indigo-600">{e.date}</span>
                  <p>{e.label}</p>
                </li>
              ))}
              {!data?.upcomingEvents?.length && (
                <p className="text-sm text-slate-500">No upcoming events</p>
              )}
            </ul>
          </SaaSCard>
          <SaaSCard>
            <SectionTitle title="Action Items" />
            <ul className="space-y-2">
              {(data?.actions ?? []).map((a) => (
                <li key={a.id} className="rounded-lg border px-3 py-2 text-sm">
                  <p>{a.message}</p>
                  <p className="text-xs capitalize text-slate-500">{a.priority} priority</p>
                </li>
              ))}
            </ul>
          </SaaSCard>
        </div>
      )}
    </PrincipalDeskShell>
  );
}
