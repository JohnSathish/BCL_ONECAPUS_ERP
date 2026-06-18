'use client';

import { useQuery } from '@tanstack/react-query';

import { SaaSCard } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchCommunicationDashboard } from '@/services/communication';

export function BulkMessagingPage() {
  const enabled = useAuthQueryEnabled();
  const { data } = useQuery({
    queryKey: ['communication', 'dashboard'],
    queryFn: fetchCommunicationDashboard,
    enabled,
    refetchInterval: 10_000,
  });

  const q = data?.queueStats;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Queued', value: q?.waiting ?? 0 },
          { label: 'Processing', value: q?.active ?? 0 },
          { label: 'Delivered', value: q?.completed ?? 0 },
          { label: 'Failed', value: q?.failed ?? 0 },
        ].map((card) => (
          <SaaSCard key={card.label}>
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p>
          </SaaSCard>
        ))}
      </div>
      <SaaSCard>
        <h2 className="font-semibold">Bulk Send Capacity</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Campaigns above 100 recipients are automatically split into batch jobs (100 per batch) for
          reliable delivery at scale — 10, 100, 500, 1000, 5000+ supported.
        </p>
      </SaaSCard>
    </div>
  );
}
