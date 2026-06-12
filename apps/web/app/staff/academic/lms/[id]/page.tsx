'use client';

import { useParams } from 'next/navigation';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LmsPortalHome } from '@/components/lms-module/lms-portal-home';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export default function StaffLmsWorkspacePage() {
  const session = useRequireStaffPortal();
  const params = useParams();
  const id = String(params.id ?? '');
  if (!session) return null;
  return (
    <DashboardShell role="staff" title="Subject workspace">
      <LmsPortalHome role="faculty" workspaceId={id} />
    </DashboardShell>
  );
}
