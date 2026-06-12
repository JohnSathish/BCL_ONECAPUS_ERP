'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsPortalHome } from '@/components/lms-module/lms-portal-home';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export default function StaffLmsPage() {
  const session = useRequireStaffPortal();
  if (!session) return null;
  return (
    <DashboardShell role="staff" title="LMS">
      <LmsPortalHome role="faculty" />
    </DashboardShell>
  );
}
