'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ParentWardsPortal } from '@/components/parent-portal/parent-wards-portal';
import { useRequireAuth } from '@/hooks/use-auth';

export default function ParentDashboardPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="parent" title="Parent Portal">
      <ParentWardsPortal />
    </DashboardShell>
  );
}
