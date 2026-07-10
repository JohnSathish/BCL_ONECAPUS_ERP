'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AttendanceReportsWorkspace } from '@/components/student-attendance/attendance-reports-workspace';

export default function AttendanceDefaultersReportPage() {
  return (
    <DashboardShell role="admin" title="Attendance Defaulters">
      <AttendanceReportsWorkspace kind="defaulters" />
    </DashboardShell>
  );
}
