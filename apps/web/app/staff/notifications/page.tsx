'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { fetchNotifications } from '@/services/communication';

export default function StaffNotificationsPage() {
  useRequireStaffPortal();
  const { data } = useQuery({
    queryKey: ['communication', 'notifications', 'staff'],
    queryFn: () => fetchNotifications(30),
  });

  return (
    <DashboardShell role="staff" title="Notifications">
      <div className="space-y-3">
        {(data ?? []).map((n) => (
          <GlassCard key={n.id} className="p-4">
            <p className="font-medium">{n.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            {n.link ? (
              <Link href={n.link} className="mt-2 inline-block text-sm text-primary">
                View
              </Link>
            ) : null}
          </GlassCard>
        ))}
        {!data?.length ? <p className="text-sm text-muted-foreground">No notifications.</p> : null}
      </div>
    </DashboardShell>
  );
}
