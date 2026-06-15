'use client';

import { GovernancePortalWorkspace } from '@/components/governance-module/governance-portal-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export default function StaffGovernancePage() {
  useRequireStaffPortal();
  return (
    <DashboardShell role="staff" title="My Committees">
      <GovernancePortalWorkspace />
    </DashboardShell>
  );
}
