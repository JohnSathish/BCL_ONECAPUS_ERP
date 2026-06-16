'use client';

import { CommitteeMembersWorkspace } from '@/components/governance-module/committee-members-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Committee Members">
      <CommitteeMembersWorkspace />
    </DashboardShell>
  );
}
