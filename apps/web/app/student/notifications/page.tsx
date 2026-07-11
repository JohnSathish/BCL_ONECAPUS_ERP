'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { NotificationsCenter } from '@/components/communication/notifications/notifications-center';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

function StudentNotificationsInner() {
  const params = useSearchParams();
  const id = params.get('id');

  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Read the full message and open any attached images or PDFs. Selecting an item marks it as
          read but keeps it available here.
        </p>
      </div>
      <NotificationsCenter initialId={id} inboxPath="/student/notifications" />
    </div>
  );
}

export default function StudentNotificationsPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="student" title="Notifications">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <StudentNotificationsInner />
      </Suspense>
    </DashboardShell>
  );
}
