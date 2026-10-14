'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaDutyRosterPage } from '@/components/examinations/ia/ia-duty-roster-page';
import { useRequireAuth } from '@/hooks/use-auth';

export default function DutyRosterPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" pageHeader={false} title="Duty Roster">
      <IaExaminationShell>
        <IaDutyRosterPage />
      </IaExaminationShell>
    </DashboardShell>
  );
}
