'use client';

import { useParams } from 'next/navigation';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsWorkspaceShell } from '@/components/lms-module/lms-workspace-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdminLmsWorkspaceDetailPage() {
  const session = useRequireAuth();
  const params = useParams();
  const id = String(params.id ?? '');
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Subject workspace">
      <LmsWorkspaceShell workspaceId={id} />
    </DashboardShell>
  );
}
