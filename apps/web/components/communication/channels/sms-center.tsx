'use client';

import { useQuery } from '@tanstack/react-query';

import { SaaSCard } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchCommunicationDashboard } from '@/services/communication';

export function SmsCenterPage() {
  const enabled = useAuthQueryEnabled();
  const { data } = useQuery({
    queryKey: ['communication', 'dashboard'],
    queryFn: fetchCommunicationDashboard,
    enabled,
  });

  const sms = data?.channelHealth?.sms;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SaaSCard>
        <p className="text-sm text-muted-foreground">Provider Status</p>
        <p className="mt-2 text-xl font-bold">{sms?.connected ? 'Online' : 'Offline'}</p>
      </SaaSCard>
      <SaaSCard>
        <p className="text-sm text-muted-foreground">Used Today</p>
        <p className="mt-2 text-xl font-bold">{sms?.usedToday ?? 0}</p>
      </SaaSCard>
      <SaaSCard>
        <p className="text-sm text-muted-foreground">Used This Month</p>
        <p className="mt-2 text-xl font-bold">{sms?.usedThisMonth ?? 0}</p>
      </SaaSCard>
      <SaaSCard className="sm:col-span-3">
        <h2 className="font-semibold">SMS Use Cases</h2>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
          <li>OTP &amp; portal login</li>
          <li>Fee due &amp; attendance warnings</li>
          <li>Exam schedule &amp; results</li>
          <li>Emergency closure alerts</li>
        </ul>
      </SaaSCard>
    </div>
  );
}
