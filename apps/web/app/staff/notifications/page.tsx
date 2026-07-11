'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { NotificationsCenter } from '@/components/communication/notifications/notifications-center';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';

function StaffNotificationsInner() {
  useRequireStaffPortal();
  const params = useSearchParams();
  const id = params.get('id');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Read the full message and open any attached images or PDFs.
        </p>
      </div>
      <NotificationsCenter initialId={id} inboxPath="/staff/notifications" />
    </div>
  );
}

export default function StaffNotificationsPage() {
  return (
    <DashboardShell role="staff" title="Notifications">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <StaffNotificationsInner />
      </Suspense>
    </DashboardShell>
  );
}
