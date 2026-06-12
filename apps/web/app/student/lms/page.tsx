'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsPortalHome } from '@/components/lms-module/lms-portal-home';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentLmsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="student" title="LMS">
      <LmsPortalHome role="student" />
    </DashboardShell>
  );
}
