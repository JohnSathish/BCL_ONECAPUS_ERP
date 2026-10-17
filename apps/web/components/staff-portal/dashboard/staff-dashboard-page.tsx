'use client';

import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';

import { DashboardShell } from '@/components/layout/dashboard-shell';

import { StaffHomeOverview } from '@/components/staff-portal/dashboard/staff-home-overview';

import { StaffMobileDashboard } from '@/components/staff-portal/dashboard/staff-mobile-dashboard';

import { useStaffDashboard } from '@/components/staff-portal/hooks/use-staff-dashboard';

import { StaffNotLinkedState } from '@/components/staff-portal/layout/staff-module-placeholder';

import { HodDashboardWidget } from '@/components/staff-portal/widgets/hod-dashboard-widget';

import { BirthdaysTodayWidget } from '@/components/portal/birthdays-today-widget';

import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

import { isAxiosError } from 'axios';

import { useQuery } from '@tanstack/react-query';

import { fetchStaffBirthdaysWidget } from '@/services/staff-portal';

import { useAuthQueryEnabled } from '@/hooks/use-auth';

export function StaffDashboardPage() {
  useRequireStaffPortal();

  const dashboardQ = useStaffDashboard();

  const authEnabled = useAuthQueryEnabled();
  const birthdaysQ = useQuery({
    queryKey: ['staff-portal', 'dashboard-widget', 'birthdays'],
    queryFn: fetchStaffBirthdaysWidget,
    enabled: authEnabled,
    staleTime: 30_000,
  });

  const data = dashboardQ.data;

  const loading = dashboardQ.isLoading;

  if (isAxiosError(dashboardQ.error) && dashboardQ.error.response?.status === 404) {
    return <StaffNotLinkedState />;
  }

  return (
    <DashboardShell role="staff" title="Staff Dashboard">
      <ErpWorkspace className="space-y-4">
        {dashboardQ.isError ? (
          <QueryErrorPanel
            title="Unable to load staff dashboard"
            error={dashboardQ.error}
            onRetry={() => void dashboardQ.refetch()}
            isRetrying={dashboardQ.isFetching}
          />
        ) : null}
        <StaffMobileDashboard data={data} loading={loading} />

        <div className="md:hidden">
          <BirthdaysTodayWidget
            data={birthdaysQ.data}
            loading={birthdaysQ.isLoading}
            notificationsHref="/staff/notifications"
          />
        </div>

        <div className="hidden space-y-4 md:block">
          {loading || !data ? (
            <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
          ) : (
            <StaffHomeOverview data={data} />
          )}

          <HodDashboardWidget data={data} loading={loading} />

          <BirthdaysTodayWidget
            data={birthdaysQ.data}
            loading={birthdaysQ.isLoading}
            notificationsHref="/staff/notifications"
          />
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
