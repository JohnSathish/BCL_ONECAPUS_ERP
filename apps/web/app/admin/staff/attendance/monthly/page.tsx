'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffAttendanceStudio } from '@/components/staff-module/attendance/staff-attendance-studio';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Monthly Attendance">
      <StaffAttendanceStudio page="monthly" />
    </DashboardShell>
  );
}
