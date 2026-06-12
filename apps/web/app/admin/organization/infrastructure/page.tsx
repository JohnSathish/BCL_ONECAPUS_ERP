'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InfrastructureWorkspace } from '@/components/infrastructure/infrastructure-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

export default function InfrastructurePage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Infrastructure">
      <InfrastructureWorkspace />
    </DashboardShell>
  );
}
