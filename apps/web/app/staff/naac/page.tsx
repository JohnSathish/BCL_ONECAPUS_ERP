'use client';

import { NaacWorkspace } from '@/components/naac-iqac-module/naac-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StaffNaacPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="staff" title="NAAC & IQAC Portal">
      <NaacWorkspace page="faculty" />
    </DashboardShell>
  );
}
