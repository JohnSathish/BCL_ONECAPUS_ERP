'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';

import { ChartContainer } from '@/components/dashboard/chart-container';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchCommunicationAnalytics } from '@/services/communication';

export function CommunicationAnalyticsView() {
  const enabled = useAuthQueryEnabled();
  const { data } = useQuery({
    queryKey: ['communication', 'analytics'],
    queryFn: () => fetchCommunicationAnalytics(),
    enabled,
  });

  const chartData = Object.entries(data?.byChannel ?? {}).map(([channel, stats]) => ({
    channel,
    sent: stats.sent,
    delivered: stats.delivered,
    failed: stats.failed,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(data?.byChannel ?? {}).map(([channel, stats]) => (
          <SaaSCard key={channel}>
            <p className="text-sm font-semibold">{channel}</p>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Sent</dt>
                <dd>{stats.sent}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivered</dt>
                <dd>{stats.delivered}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Failed</dt>
                <dd>{stats.failed}</dd>
              </div>
              {channel === 'EMAIL' ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Opened</dt>
                    <dd>{stats.opened}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Clicked</dt>
                    <dd>{stats.clicked}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          </SaaSCard>
        ))}
      </div>

      <SaaSCard>
        <SectionTitle title="Channel Volume" subtitle="Sent vs delivered vs failed" />
        <ChartContainer className="h-64" height={256}>
          <BarChart data={chartData}>
            <XAxis dataKey="channel" />
            <YAxis />
            <Bar dataKey="sent" fill="#6366f1" name="Sent" />
            <Bar dataKey="delivered" fill="#16a34a" name="Delivered" />
            <Bar dataKey="failed" fill="#ef4444" name="Failed" />
          </BarChart>
        </ChartContainer>
      </SaaSCard>
    </div>
  );
}
