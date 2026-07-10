'use client';

import { ExaminationFeesWorkspace } from '@/components/examination-fees/examination-fees-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Examination Fee Dashboard">
      <ExaminationFeesWorkspace page="dashboard" />
    </DashboardShell>
  );
}
