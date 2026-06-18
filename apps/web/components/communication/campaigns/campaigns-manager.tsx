'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  cancelCommunicationCampaign,
  fetchCommunicationCampaigns,
  fetchCampaignRecipients,
  sendCommunicationCampaign,
} from '@/services/communication';

export function CampaignsManager({ statusFilter }: { statusFilter?: string }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'automated' | 'manual'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const campaigns = useQuery({
    queryKey: ['communication', 'campaigns', statusFilter],
    queryFn: () => fetchCommunicationCampaigns(statusFilter),
    enabled,
  });

  const recipients = useQuery({
    queryKey: ['communication', 'recipients', expandedId],
    queryFn: () => fetchCampaignRecipients(expandedId!),
    enabled: Boolean(expandedId),
  });

  const send = useMutation({
    mutationFn: sendCommunicationCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication'] }),
  });

  const cancel = useMutation({
    mutationFn: cancelCommunicationCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication'] }),
  });

  const filtered = useMemo(() => {
    const rows = campaigns.data ?? [];
    if (filter === 'automated') {
      return rows.filter((c) =>
        Boolean((c.metadata as Record<string, unknown> | undefined)?.trigger),
      );
    }
    if (filter === 'manual') {
      return rows.filter((c) => !(c.metadata as Record<string, unknown> | undefined)?.trigger);
    }
    return rows;
  }, [campaigns.data, filter]);

  return (
    <div className="space-y-4">
      {!statusFilter ? (
        <div className="flex flex-wrap gap-2">
          {(['all', 'automated', 'manual'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'automated' ? 'Automated' : 'Manual'}
            </Button>
          ))}
        </div>
      ) : null}

      {filtered.map((c) => {
        const trigger = (c.metadata as Record<string, unknown> | undefined)?.trigger as
          | string
          | undefined;
        return (
          <div key={c.id} className="rounded-2xl border border-border/80 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{c.name}</p>
                  {trigger ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase text-primary">
                      Auto · {trigger}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.audienceType} · {c.status} · {c._count?.recipients ?? 0} recipients
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                >
                  Recipients
                </Button>
                {['DRAFT', 'SCHEDULED'].includes(c.status) ? (
                  <>
                    <Button size="sm" onClick={() => send.mutate(c.id)} disabled={send.isPending}>
                      Send
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancel.mutate(c.id)}
                      disabled={cancel.isPending}
                    >
                      Cancel
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            {expandedId === c.id && recipients.data ? (
              <ul className="mt-3 max-h-40 overflow-y-auto border-t border-border/60 pt-3 text-xs">
                {recipients.data.slice(0, 50).map((r) => (
                  <li key={r.id}>
                    {r.displayName} · {r.deliveryStatus}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
      {!filtered.length ? <p className="text-sm text-muted-foreground">No campaigns.</p> : null}
    </div>
  );
}
