'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaExamsWorkspace } from '@/components/examinations/ia/ia-exams-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

export default function IaExamsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" pageHeader={false} title="IA Exams">
      <IaExaminationShell>
        <IaExamsWorkspace />
      </IaExaminationShell>
    </DashboardShell>
  );
}
