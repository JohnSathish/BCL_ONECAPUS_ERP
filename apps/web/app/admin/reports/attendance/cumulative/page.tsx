'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AttendanceReportsWorkspace } from '@/components/student-attendance/attendance-reports-workspace';

export default function CumulativeAttendanceReportPage() {
  return (
    <DashboardShell role="admin" title="Cumulative Attendance">
      <AttendanceReportsWorkspace kind="cumulative" />
    </DashboardShell>
  );
}
