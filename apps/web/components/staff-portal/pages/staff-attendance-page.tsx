'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { useStaffDashboard } from '@/components/staff-portal/hooks/use-staff-dashboard';
import { CalendarWidget } from '@/components/staff-portal/widgets/calendar-widget';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

export function StaffPortalAttendancePage() {
  useRequireStaffPortal();
  const dashQ = useStaffDashboard();
  const attendance = dashQ.data?.kpis.attendance;
  const profile = dashQ.data?.profile;

  return (
    <DashboardShell role="staff" title="Attendance">
      <ErpWorkspace className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Today&apos;s Attendance</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Check-in</dt>
              <dd className="font-medium">{attendance?.todayCheckIn ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Check-out</dt>
              <dd>{attendance?.todayCheckOut ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Biometric Status</dt>
              <dd>{profile?.biometricSyncStatus ?? 'Synced'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">RFID Status</dt>
              <dd>{profile?.rfidNo ? 'Assigned' : 'Not assigned'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Device</dt>
              <dd>{attendance?.device ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="text-emerald-600">{attendance?.status ?? '—'}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Biometric and RFID integration hooks are prepared. Manual override audit trail will
            appear here.
          </p>
        </GlassCard>
        <CalendarWidget loading={dashQ.isLoading} />
        <GlassCard className="p-6 lg:col-span-2">
          <h3 className="font-semibold">Monthly Summary</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Present: {attendance?.presentDays ?? 0} · Late: {attendance?.late ?? 0} · Absent:{' '}
            {attendance?.absent ?? 0} · Attendance %: {attendance?.percentage ?? 0}%
          </p>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
