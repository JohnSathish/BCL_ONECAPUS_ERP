'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsWorkspacesList } from '@/components/lms-module/lms-workspaces-list';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminLmsQuizzesPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Quizzes">
      <p className="mb-4 text-sm text-muted-foreground">
        Open a workspace and use the Quizzes tab to create MCQ assessments and review attempts.
      </p>
      <LmsWorkspacesList />
    </DashboardShell>
  );
}
