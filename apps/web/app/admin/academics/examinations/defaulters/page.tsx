'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaDefaultersWorkspace } from '@/components/examinations/ia/ia-admin-workspaces';
import { useRequireAuth } from '@/hooks/use-auth';

export default function IaDefaultersPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" pageHeader={false} title="Defaulters">
      <IaExaminationShell>
        <IaDefaultersWorkspace />
      </IaExaminationShell>
    </DashboardShell>
  );
}
