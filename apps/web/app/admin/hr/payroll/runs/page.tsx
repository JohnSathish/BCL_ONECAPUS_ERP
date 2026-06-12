'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HrWorkspace } from '@/components/hr-module/hr-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Payroll Runs">
      <HrWorkspace page="payroll-runs" />
    </DashboardShell>
  );
}
