'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentAttendancePortal } from '@/components/student-attendance/student-attendance-portal';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentAttendancePage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="My Attendance">
      <StudentAttendancePortal />
    </DashboardShell>
  );
}
