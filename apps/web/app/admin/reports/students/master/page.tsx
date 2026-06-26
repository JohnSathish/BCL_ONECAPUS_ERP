'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import { TabularReportWorkspace } from '@/components/student-reports/tabular-report-workspace';

export default function StudentMasterReportPage() {
  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Student Master Report"
        description="Full student profile export with programme, demographic, contact, and operational fields."
      >
        <TabularReportWorkspace
          reportKey="student-master"
          title="Master export preview"
          description="Filter students, preview the first rows, then export the full dataset to Excel or CSV."
        />
      </StudentReportsShell>
    </DashboardShell>
  );
}
