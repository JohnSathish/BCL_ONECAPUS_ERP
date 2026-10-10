'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaReportsWorkspace } from '@/components/examinations/ia/ia-reports-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

export default function IaReportsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" pageHeader={false} title="IA Reports">
      <IaExaminationShell>
        <IaReportsWorkspace />
      </IaExaminationShell>
    </DashboardShell>
  );
}
