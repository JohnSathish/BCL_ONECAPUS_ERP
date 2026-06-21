'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaAdmitCardsWorkspace } from '@/components/examinations/ia/ia-admit-cards-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

export default function IaAdmitCardsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" pageHeader={false} title="IA Admit Cards">
      <IaExaminationShell>
        <IaAdmitCardsWorkspace />
      </IaExaminationShell>
    </DashboardShell>
  );
}
