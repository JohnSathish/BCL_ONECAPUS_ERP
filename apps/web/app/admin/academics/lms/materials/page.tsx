'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsWorkspacesList } from '@/components/lms-module/lms-workspaces-list';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminLmsMaterialsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Learning materials">
      <p className="mb-4 text-sm text-muted-foreground">
        Open a workspace to upload and publish materials.
      </p>
      <LmsWorkspacesList />
    </DashboardShell>
  );
}
