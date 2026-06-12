'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsWorkspacesList } from '@/components/lms-module/lms-workspaces-list';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminLmsWorkspacesPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="LMS workspaces">
      <LmsWorkspacesList />
    </DashboardShell>
  );
}
