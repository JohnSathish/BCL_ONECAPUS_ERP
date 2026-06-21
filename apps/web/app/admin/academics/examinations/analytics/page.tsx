'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaPlaceholderWorkspace } from '@/components/examinations/ia/ia-admin-workspaces';
import { useRequireAuth } from '@/hooks/use-auth';

export default function IaAnalyticsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" pageHeader={false} title="IA Analytics">
      <IaExaminationShell>
        <IaPlaceholderWorkspace
          title="Student Performance Analytics"
          description="Phase 2: trend charts, subject-wise failure rates, and AI-assisted insights."
        />
      </IaExaminationShell>
    </DashboardShell>
  );
}
