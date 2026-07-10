'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AttendanceReportsWorkspace } from '@/components/student-attendance/attendance-reports-workspace';

export default function MonthlyAttendanceReportPage() {
  return (
    <DashboardShell role="admin" title="Monthly Attendance">
      <AttendanceReportsWorkspace kind="monthly" />
    </DashboardShell>
  );
}
