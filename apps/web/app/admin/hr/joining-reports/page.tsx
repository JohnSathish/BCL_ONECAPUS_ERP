'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HrJoiningReportsPage } from '@/components/hr-module/joining/hr-joining-reports-page';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Joining Reports">
      <HrJoiningReportsPage />
    </DashboardShell>
  );
}
