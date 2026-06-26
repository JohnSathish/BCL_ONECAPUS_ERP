'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import { TabularReportWorkspace } from '@/components/student-reports/tabular-report-workspace';

export default function SubjectPapersReportPage() {
  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Subject Paper Report"
        description="Paper codes and titles by NEP category, including multiple major paper slots."
      >
        <TabularReportWorkspace
          reportKey="subject-papers"
          title="Subject papers preview"
          description="Each major paper slot shows course code and title. Minor and bucket subjects are listed in their category columns."
        />
      </StudentReportsShell>
    </DashboardShell>
  );
}
