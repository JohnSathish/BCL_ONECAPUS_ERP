'use client';

import { ExaminationFeesWorkspace } from '@/components/examination-fees/examination-fees-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="Semester Examination Fees">
      <ExaminationFeesWorkspace page="student" />
    </DashboardShell>
  );
}
