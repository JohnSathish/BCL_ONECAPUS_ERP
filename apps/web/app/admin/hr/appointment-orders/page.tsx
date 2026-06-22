'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HrAppointmentDashboardPage } from '@/components/hr-module/appointment/hr-appointment-dashboard';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Appointment Orders">
      <HrAppointmentDashboardPage />
    </DashboardShell>
  );
}
