'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsWorkspacesList } from '@/components/lms-module/lms-workspaces-list';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminLmsAssignmentsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Assignments">
      <p className="mb-4 text-sm text-muted-foreground">
        Open a workspace and use the Assignments tab to create, publish, and evaluate work.
      </p>
      <LmsWorkspacesList />
    </DashboardShell>
  );
}
