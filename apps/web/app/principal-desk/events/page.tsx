'use client';

import { useQuery } from '@tanstack/react-query';
import { PrincipalDeskShell } from '@/components/principal-desk/principal-desk-shell';
import { PrincipalEventsWorkspace } from '@/components/principal-desk/principal-events-workspace';
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
      subtitle="Institutional calendar, deadlines, and committee pulse"
      className="max-w-[1400px]"
    >
      <PrincipalEventsWorkspace data={data} isLoading={isLoading} />
    </PrincipalDeskShell>
  );
}
