'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsAdminDashboard } from '@/components/lms-module/lms-admin-dashboard';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminLmsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="LMS">
      <LmsAdminDashboard />
    </DashboardShell>
  );
}
