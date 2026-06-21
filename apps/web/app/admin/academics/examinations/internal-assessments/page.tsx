'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import {
  IaSchemesWorkspace,
  IaSessionsWorkspace,
} from '@/components/examinations/ia/ia-admin-workspaces';
import { useRequireAuth } from '@/hooks/use-auth';

export default function InternalAssessmentsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Internal Assessments">
      <IaExaminationShell>
        <div className="space-y-6">
          <IaSessionsWorkspace />
          <IaSchemesWorkspace />
        </div>
      </IaExaminationShell>
    </DashboardShell>
  );
}
