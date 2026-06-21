'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaSettingsWorkspace } from '@/components/examinations/ia/ia-admin-workspaces';
import { useRequireAuth } from '@/hooks/use-auth';

export default function IaSettingsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" pageHeader={false} title="Examination Settings">
      <IaExaminationShell>
        <IaSettingsWorkspace />
      </IaExaminationShell>
    </DashboardShell>
  );
}
