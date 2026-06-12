'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { useStaffMe } from '@/components/staff-portal/hooks/use-staff-me';
import { StaffNotLinkedState } from '@/components/staff-portal/layout/staff-module-placeholder';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export function StaffPortalDepartmentPage() {
  useRequireStaffPortal();
  const meQ = useStaffMe();

  if (meQ.isError) return <StaffNotLinkedState />;

  if (!meQ.data?.isHod) {
    return (
      <DashboardShell role="staff" title="Department">
        <GlassCard className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Department workspace is available for HoD and admin staff roles only.
          </p>
        </GlassCard>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="staff" title="Department Workspace">
      <ErpWorkspace className="grid gap-4 md:grid-cols-2">
        <GlassCard className="p-6">
          <h2 className="font-semibold">Department Staff</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Staff list for {meQ.data?.department ?? 'your department'}.
          </p>
        </GlassCard>
        <GlassCard className="p-6">
          <h2 className="font-semibold">Pending Approvals</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Leave and task approvals awaiting HoD action.
          </p>
        </GlassCard>
        <GlassCard className="p-6">
          <h2 className="font-semibold">Subject Allocation</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Department teaching load and section assignments.
          </p>
        </GlassCard>
        <GlassCard className="p-6">
          <h2 className="font-semibold">Department Announcements</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Internal notices for department members.
          </p>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
