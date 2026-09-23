'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  cancelCommunicationCampaign,
  fetchCommunicationCampaigns,
  fetchCampaignRecipients,
  sendCommunicationCampaign,
} from '@/services/communication';
import type { CommunicationCampaign } from '@/types/communication';
import { apiErrorMessage } from '@/utils/api-error';

function campaignRecipientLabel(campaign: CommunicationCampaign) {
  const meta = (campaign.metadata ?? {}) as Record<string, unknown>;
  const materialised = campaign._count?.recipients ?? 0;
  const estimated = typeof meta.estimatedRecipients === 'number' ? meta.estimatedRecipients : null;
  const push = typeof meta.estimatedPush === 'number' ? meta.estimatedPush : null;
  const pushBit = push != null ? ` · ${push} with push` : '';
  if (materialised > 0) return `${materialised} recipients${pushBit}`;
  if (estimated != null) return `${estimated} recipients${pushBit}`;
  return '0 recipients';
}

export function CampaignsManager({ statusFilter }: { statusFilter?: string }) {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'automated' | 'manual'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    onSuccess: () => {
      setActionError(null);
      qc.invalidateQueries({ queryKey: ['communication'] });
    },
    onError: (err) => setActionError(apiErrorMessage(err, 'Could not send this campaign')),
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

      {actionError ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {campaigns.isError ? (
        <QueryErrorPanel
          title="Unable to load campaigns"
          error={campaigns.error}
          onRetry={() => void campaigns.refetch()}
          isRetrying={campaigns.isFetching}
        />
      ) : null}

      {filtered.map((c) => {
        const meta = (c.metadata ?? {}) as Record<string, unknown>;
        const trigger = meta.trigger as string | undefined;
        const failureReason = typeof meta.failureReason === 'string' ? meta.failureReason : null;
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
                  {c.audienceType} · {c.status} · {campaignRecipientLabel(c)}
                </p>
                {failureReason ? <p className="text-xs text-destructive">{failureReason}</p> : null}
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
            {expandedId === c.id && recipients.isError ? (
              <div className="mt-3 border-t border-border/60 pt-3">
                <QueryErrorPanel
                  title="Unable to load recipients"
                  error={recipients.error}
                  onRetry={() => void recipients.refetch()}
                  isRetrying={recipients.isFetching}
                />
              </div>
            ) : null}
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
      {!filtered.length && !campaigns.isError ? (
        <p className="text-sm text-muted-foreground">No campaigns.</p>
      ) : null}
    </div>
  );
}
