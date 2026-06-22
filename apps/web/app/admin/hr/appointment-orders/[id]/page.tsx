'use client';

import { use } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { HrAppointmentDetailPage } from '@/components/hr-module/appointment/hr-appointment-detail';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = useRequireAuth();
  const { id } = use(params);
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Appointment Order">
      <HrAppointmentDetailPage orderId={id} />
    </DashboardShell>
  );
}
