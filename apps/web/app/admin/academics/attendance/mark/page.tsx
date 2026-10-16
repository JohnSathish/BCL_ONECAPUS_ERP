'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AdminAttendanceMarkPage } from '@/components/student-attendance/admin-attendance-mark-page';
import { useRequireAuth } from '@/hooks/use-auth';

export default function MarkStudentAttendancePage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Mark Attendance">
      <AdminAttendanceMarkPage />
    </DashboardShell>
  );
}
