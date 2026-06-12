'use client';

import { FeesWorkspace } from '@/components/fees-module/fees-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Fees Reports">
      <FeesWorkspace page="reports" portal="admin" />
    </DashboardShell>
  );
}
