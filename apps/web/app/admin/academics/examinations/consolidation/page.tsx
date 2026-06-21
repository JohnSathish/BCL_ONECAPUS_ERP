'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaConsolidationWorkspace } from '@/components/examinations/ia/ia-admin-workspaces';
import { useRequireAuth } from '@/hooks/use-auth';

export default function IaConsolidationPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="IA Consolidation">
      <IaExaminationShell>
        <IaConsolidationWorkspace />
      </IaExaminationShell>
    </DashboardShell>
  );
}
