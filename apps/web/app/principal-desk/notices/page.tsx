'use client';

import { useQuery } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPrincipalDashboard } from '@/services/principal-desk';

export default function NoticesPage() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['principal-desk', 'dashboard'],
    queryFn: fetchPrincipalDashboard,
    enabled,
  });

  return (
    <PrincipalDeskShell title="Notices & Announcements" subtitle="Important college communications">
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      ) : (
        <SaaSCard>
          <SectionTitle title="Recent Announcements" />
          <ul className="space-y-3">
            {(data?.announcements ?? []).map((n, i) => (
              <li key={`${n.title}-${i}`} className="rounded-xl border px-4 py-3">
                <p className="font-semibold text-slate-900">{n.title}</p>
                <p className="text-xs text-slate-500">{n.date}</p>
              </li>
            ))}
            {!data?.announcements?.length && (
              <p className="text-sm text-slate-500">No announcements</p>
            )}
          </ul>
        </SaaSCard>
      )}
    </PrincipalDeskShell>
  );
}
