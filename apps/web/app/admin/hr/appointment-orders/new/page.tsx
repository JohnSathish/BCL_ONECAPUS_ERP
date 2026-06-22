'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HrAppointmentWizardPage } from '@/components/hr-module/appointment/hr-appointment-wizard';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="New Appointment Order">
      <HrAppointmentWizardPage />
    </DashboardShell>
  );
}
