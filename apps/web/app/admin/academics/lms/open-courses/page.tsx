'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsOpenCoursesPanel } from '@/components/lms-module/lms-open-courses-panel';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminLmsOpenCoursesPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Open Courses / Stream Resources">
      <LmsOpenCoursesPanel />
    </DashboardShell>
  );
}
