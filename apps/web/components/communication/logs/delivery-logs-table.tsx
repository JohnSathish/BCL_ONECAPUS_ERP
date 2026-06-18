'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchDeliveryLogs, retryDeliveryLog } from '@/services/communication';

export function DeliveryLogsTable({
  defaultStatus,
  showRetry = false,
}: {
  defaultStatus?: string;
  showRetry?: boolean;
}) {
  const enabled = useAuthQueryEnabled();
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState(defaultStatus ?? '');

  const logs = useQuery({
    queryKey: ['communication', 'delivery-logs', channel, status],
    queryFn: () =>
      fetchDeliveryLogs({
        limit: 200,
        ...(channel ? { channel } : {}),
        ...(status ? { status } : {}),
      }),
    enabled,
  });

  const retry = useMutation({ mutationFn: retryDeliveryLog });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-lg border border-border/80 bg-background px-3 py-2 text-sm"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="">All channels</option>
          {['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'].map((ch) => (
            <option key={ch} value={ch}>
              {ch}
            </option>
          ))}
        </select>
        {!defaultStatus ? (
          <select
            className="rounded-lg border border-border/80 bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {['SENT', 'DELIVERED', 'FAILED', 'PENDING'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border/80 text-left text-muted-foreground">
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time</th>
              {showRetry ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {(logs.data ?? []).map((log) => (
              <tr key={log.id} className="border-b border-border/40">
                <td className="px-4 py-3">
                  {log.recipient?.displayName ?? log.recipient?.email ?? '—'}
                </td>
                <td className="px-4 py-3">{log.campaign?.name ?? '—'}</td>
                <td className="px-4 py-3">{log.channel}</td>
                <td className="px-4 py-3">{log.status}</td>
                <td className="px-4 py-3">
                  {new Date(log.sentAt ?? log.createdAt).toLocaleString()}
                </td>
                {showRetry ? (
                  <td className="px-4 py-3">
                    {log.status === 'FAILED' ? (
                      <Button size="sm" variant="outline" onClick={() => retry.mutate(log.id)}>
                        Retry
                      </Button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.data?.length ? (
          <p className="p-4 text-sm text-muted-foreground">No delivery logs.</p>
        ) : null}
      </div>
    </div>
  );
}
