'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HrProbationPage } from '@/components/hr-module/probation/hr-probation-page';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Probation Management">
      <HrProbationPage />
    </DashboardShell>
  );
}
