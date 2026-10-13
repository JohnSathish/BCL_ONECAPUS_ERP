'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaStudentResultLookup } from '@/components/examinations/ia/ia-student-result-lookup';
import { useRequireAuth } from '@/hooks/use-auth';

export default function IaStudentResultPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" pageHeader={false} title="Student Result">
      <IaExaminationShell>
        <IaStudentResultLookup />
      </IaExaminationShell>
    </DashboardShell>
  );
}
