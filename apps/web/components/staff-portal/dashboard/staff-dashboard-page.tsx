'use client';

import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';

import { DashboardShell } from '@/components/layout/dashboard-shell';

import {
  StaffDashboardHeader,
  StaffSnapshotCards,
} from '@/components/staff-portal/dashboard/staff-dashboard-header';

import { StaffMobileDashboard } from '@/components/staff-portal/dashboard/staff-mobile-dashboard';

import { StaffQuickActionsBar } from '@/components/staff-portal/dashboard/staff-quick-actions-bar';

import { useStaffDashboard } from '@/components/staff-portal/hooks/use-staff-dashboard';

import { StaffNotLinkedState } from '@/components/staff-portal/layout/staff-module-placeholder';

import { AttendanceSummaryWidget } from '@/components/staff-portal/widgets/attendance-summary-widget';

import { LeaveSummaryWidget } from '@/components/staff-portal/widgets/leave-summary-widget';

import { MySubjectsWidget } from '@/components/staff-portal/widgets/my-subjects-widget';

import { NotificationsPanel } from '@/components/staff-portal/widgets/notifications-panel';

import { TeachingWorkspaceWidget } from '@/components/staff-portal/widgets/teaching-workspace-widget';

import { TodayScheduleWidget } from '@/components/staff-portal/widgets/today-schedule-widget';

import { PortalCalendarWidget } from '@/components/portal/portal-calendar-widget';

import { HodDashboardWidget } from '@/components/staff-portal/widgets/hod-dashboard-widget';

import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

import { useStaffPortalLayoutStore } from '@/store/staff-portal-layout-store';

import { isAxiosError } from 'axios';

export function StaffDashboardPage() {
  useRequireStaffPortal();

  const dashboardQ = useStaffDashboard();

  const widgets = useStaffPortalLayoutStore((s) => s.widgets);

  const data = dashboardQ.data;

  const loading = dashboardQ.isLoading;

  if (isAxiosError(dashboardQ.error) && dashboardQ.error.response?.status === 404) {
    return <StaffNotLinkedState />;
  }

  return (
    <DashboardShell role="staff" title="Staff Dashboard">
      <ErpWorkspace className="space-y-4">
        <StaffMobileDashboard data={data} loading={loading} />

        <div className="hidden space-y-4 md:block">
          <StaffQuickActionsBar isTeaching={data?.profile.isTeaching} />

          {widgets.header !== false ? <StaffDashboardHeader data={data} loading={loading} /> : null}

          {widgets.kpis !== false ? <StaffSnapshotCards data={data} loading={loading} /> : null}

          <TeachingWorkspaceWidget isTeaching={data?.profile.isTeaching} />

          <HodDashboardWidget data={data} loading={loading} />

          <div className="grid gap-4 lg:grid-cols-3">
            {widgets.schedule !== false ? (
              data?.profile.isTeaching ? (
                <TodayScheduleWidget schedule={data?.todaySchedule} loading={loading} />
              ) : null
            ) : null}

            {widgets.subjects !== false && data?.profile.isTeaching !== false ? (
              <MySubjectsWidget subjects={data?.subjects} loading={loading} />
            ) : null}

            {widgets.attendance !== false ? (
              <AttendanceSummaryWidget
                attendance={data?.kpis.attendance}
                biometricId={data?.profile.biometricId}
                rfidNo={data?.profile.rfidNo}
                loading={loading}
              />
            ) : null}

            {widgets.leave !== false ? (
              <LeaveSummaryWidget leave={data?.kpis.leave} loading={loading} />
            ) : null}

            {widgets.notifications !== false ? (
              <NotificationsPanel
                notifications={data?.notifications}
                unreadCount={data?.unreadNotificationCount}
                loading={loading}
                compact
              />
            ) : null}

            {widgets.calendar !== false ? (
              <PortalCalendarWidget
                events={data?.calendarEvents}
                loading={loading}
                title="Calendar"
              />
            ) : null}
          </div>
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
