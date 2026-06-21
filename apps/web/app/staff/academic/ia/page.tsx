'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffIaPortal } from '@/components/examinations/ia/staff-ia-portal';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StaffIaPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="staff" title="Internal Assessment">
      <StaffIaPortal />
    </DashboardShell>
  );
}
