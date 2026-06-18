'use client';

import { useQuery } from '@tanstack/react-query';

import { SaaSCard } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchCommunicationDashboard } from '@/services/communication';

export function PushCenterPage() {
  const enabled = useAuthQueryEnabled();
  const { data } = useQuery({
    queryKey: ['communication', 'dashboard'],
    queryFn: fetchCommunicationDashboard,
    enabled,
  });

  const push = data?.channelHealth?.push;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SaaSCard>
        <p className="text-sm text-muted-foreground">Firebase Status</p>
        <p className="mt-2 text-xl font-bold">
          {push?.connected ? (push.demoMode ? 'Demo mode' : 'Connected') : 'Not configured'}
        </p>
      </SaaSCard>
      <SaaSCard>
        <p className="text-sm text-muted-foreground">Active Devices</p>
        <p className="mt-2 text-xl font-bold">{push?.activeDevices ?? 0}</p>
      </SaaSCard>
      <SaaSCard className="sm:col-span-2">
        <p className="text-sm text-muted-foreground">Push Delivery Rate</p>
        <p className="mt-2 text-xl font-bold">
          {push?.deliveryRate != null ? `${push.deliveryRate}%` : '—'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Future Android app integration — staff, student, and parent notifications.
        </p>
      </SaaSCard>
    </div>
  );
}
