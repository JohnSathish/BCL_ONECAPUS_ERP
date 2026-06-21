'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaMarkEntryWorkspace } from '@/components/examinations/ia/ia-admin-workspaces';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StaffIaMarkEntryPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="staff" title="IA Mark Entry">
      <IaMarkEntryWorkspace staffMode />
    </DashboardShell>
  );
}
