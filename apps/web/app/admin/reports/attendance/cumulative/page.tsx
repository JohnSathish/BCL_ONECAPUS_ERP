'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { MonthWiseAttendanceReport } from '@/components/student-attendance/month-wise-attendance-report';

export default function CumulativeAttendanceReportPage() {
  return (
    <DashboardShell role="admin" title="Cumulative Attendance">
      <MonthWiseAttendanceReport />
    </DashboardShell>
  );
}
