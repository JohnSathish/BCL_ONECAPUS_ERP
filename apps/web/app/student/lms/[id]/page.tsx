'use client';

import { useParams } from 'next/navigation';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsPortalHome } from '@/components/lms-module/lms-portal-home';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StudentLmsWorkspacePage() {
  const session = useRequireAuth();
  const params = useParams();
  const id = String(params.id ?? '');
  if (!session) return null;
  return (
    <DashboardShell role="student" title="Course workspace">
      <LmsPortalHome role="student" workspaceId={id} />
    </DashboardShell>
  );
}
