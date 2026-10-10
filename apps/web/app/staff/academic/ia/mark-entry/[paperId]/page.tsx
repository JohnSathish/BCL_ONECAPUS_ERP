'use client';

import { useParams } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IaMarkEntryWorkspace } from '@/components/examinations/ia/ia-admin-workspaces';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StaffIaMarkEntryPage() {
  const session = useRequireAuth();
  const params = useParams<{ paperId: string }>();
  if (!session) return null;
  return (
    <DashboardShell role="staff" title="IA Mark Entry">
      <IaMarkEntryWorkspace staffMode initialPaperId={params.paperId} />
    </DashboardShell>
  );
}
