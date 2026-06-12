'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HrDashboardPage } from '@/components/hr-module/hr-dashboard-page';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Human Resources">
      <HrDashboardPage />
    </DashboardShell>
  );
}
