'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AdminAttendanceControlCenter } from '@/components/student-attendance/admin-attendance-control-center';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentAttendanceAdminPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Student Attendance">
      <AdminAttendanceControlCenter />
    </DashboardShell>
  );
}
