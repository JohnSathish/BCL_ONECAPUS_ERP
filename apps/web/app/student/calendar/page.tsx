'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { PortalCalendarWidget } from '@/components/portal/portal-calendar-widget';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentDashboardWidget } from '@/hooks/use-student-dashboard-widget';

export default function StudentCalendarPage() {
  useRequireAuth();
  const calendarQ = useStudentDashboardWidget('calendar');

  return (
    <DashboardShell role="student" title="Academic Calendar">
      <ErpWorkspace className="space-y-4">
        <PortalCalendarWidget
          events={calendarQ.data}
          loading={calendarQ.isLoading}
          title="Academic Calendar"
        />
        <GlassCard className="p-5">
          <h3 className="text-sm font-semibold">Event details</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Holidays, institutional events, exams, and fee due dates come from the published ERP
            Academic Calendar, plus your personal fee dues and exam schedules.
          </p>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
