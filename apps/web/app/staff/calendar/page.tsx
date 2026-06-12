'use client';

import { CalendarWidget } from '@/components/staff-portal/widgets/calendar-widget';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export default function StaffCalendarPage() {
  useRequireStaffPortal();

  return (
    <DashboardShell role="staff" title="My Calendar">
      <ErpWorkspace>
        <CalendarWidget />
        <GlassCard className="mt-4 p-5">
          <h3 className="text-sm font-semibold">Upcoming</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Classes, meetings, exams, leave dates, institutional events, and deadlines will sync
            here. Google Calendar integration is prepared via staff portal hooks.
          </p>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
