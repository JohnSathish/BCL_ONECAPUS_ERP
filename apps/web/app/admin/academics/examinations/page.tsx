'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ExaminationManagementWorkspace } from '@/components/examinations/examination-management-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminExaminationsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Examinations">
      <ExaminationManagementWorkspace />
    </DashboardShell>
  );
}
