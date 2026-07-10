'use client';

import { ProposalGeneratorWorkspace } from '@/components/proposals/proposal-generator-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Proposal Studio" pageHeader={false}>
      <ProposalGeneratorWorkspace />
    </DashboardShell>
  );
}
