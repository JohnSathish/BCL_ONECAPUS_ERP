'use client';

import { PortalCalendarWidget } from '@/components/portal/portal-calendar-widget';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { useStaffDashboard } from '@/components/staff-portal/hooks/use-staff-dashboard';

export default function StaffCalendarPage() {
  useRequireStaffPortal();
  const dashboardQ = useStaffDashboard();
  const events = dashboardQ.data?.calendarEvents ?? [];

  return (
    <DashboardShell role="staff" title="My Calendar">
      <ErpWorkspace>
        <PortalCalendarWidget
          events={events}
          loading={dashboardQ.isLoading}
          title="Academic Calendar"
        />
        <GlassCard className="mt-4 p-5">
          <h3 className="text-sm font-semibold">About this calendar</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Events come from the published ERP Academic Calendar (meetings, holidays, exams, fee due
            dates) plus public holidays. Update events in Academics → Academic Calendar, then
            Publish.
          </p>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
