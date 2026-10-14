'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { IaAttendanceSheetsPage } from '@/components/examinations/ia/ia-attendance-sheets-page';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AttendanceSheetsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" pageHeader={false} title="Attendance Sheets">
      <IaExaminationShell>
        <IaAttendanceSheetsPage />
      </IaExaminationShell>
    </DashboardShell>
  );
}
