'use client';

import { AccountsWorkspace } from '@/components/accounts-module/accounts-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Audit Trail" pageHeader={false}>
      <AccountsWorkspace page="audit-logs" />
    </DashboardShell>
  );
}
