'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { MySubjectsWidget } from '@/components/staff-portal/widgets/my-subjects-widget';
import { useStaffDashboard } from '@/components/staff-portal/hooks/use-staff-dashboard';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export default function StaffAcademicSubjectsPage() {
  useRequireStaffPortal();
  const dashQ = useStaffDashboard();

  return (
    <DashboardShell role="staff" title="My Subjects">
      <ErpWorkspace>
        <MySubjectsWidget subjects={dashQ.data?.subjects} loading={dashQ.isLoading} />
      </ErpWorkspace>
    </DashboardShell>
  );
}
