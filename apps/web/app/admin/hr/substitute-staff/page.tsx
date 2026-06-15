'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HrSubstituteStaffPage } from '@/components/hr-module/substitute/hr-substitute-page';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Substitute Staff">
      <HrSubstituteStaffPage />
    </DashboardShell>
  );
}
