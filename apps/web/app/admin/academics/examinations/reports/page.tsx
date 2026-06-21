'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaPlaceholderWorkspace } from '@/components/examinations/ia/ia-admin-workspaces';
import { useRequireAuth } from '@/hooks/use-auth';

export default function IaReportsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="IA Reports">
      <IaExaminationShell>
        <IaPlaceholderWorkspace
          title="Operational Reports"
          description="Subject-wise mark registers, department summaries, and audit trail exports."
        />
      </IaExaminationShell>
    </DashboardShell>
  );
}
