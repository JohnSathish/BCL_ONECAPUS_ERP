'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import { TabularReportWorkspace } from '@/components/student-reports/tabular-report-workspace';

export default function SubjectRegistrationReportPage() {
  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Subject Registration Report"
        description="Department names per NEP category from the current semester registration."
      >
        <TabularReportWorkspace
          reportKey="subject-summary"
          title="Subject registration preview"
          description="Shows Major, Minor, MDC, AEC, SEC, and VTC as department names for each student."
        />
      </StudentReportsShell>
    </DashboardShell>
  );
}
