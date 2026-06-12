'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsWorkspacesList } from '@/components/lms-module/lms-workspaces-list';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminLmsLessonPlansPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Lesson plans">
      <p className="mb-4 text-sm text-muted-foreground">
        Manage lesson plans inside each subject workspace.
      </p>
      <LmsWorkspacesList />
    </DashboardShell>
  );
}
