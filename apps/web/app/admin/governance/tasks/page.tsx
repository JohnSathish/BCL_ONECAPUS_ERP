'use client';

import { GovernanceWorkspace } from '@/components/governance-module/governance-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Tasks & Responsibilities">
      <GovernanceWorkspace page="tasks" />
    </DashboardShell>
  );
}
