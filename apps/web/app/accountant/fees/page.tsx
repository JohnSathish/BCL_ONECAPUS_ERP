'use client';

import { FeesWorkspace } from '@/components/fees-module/fees-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AccountantFeesPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="accountant" title="Fees">
      <FeesWorkspace page="dashboard" portal="accountant" />
    </DashboardShell>
  );
}
