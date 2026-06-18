'use client';

import { useQuery } from '@tanstack/react-query';

import { SaaSCard } from '@/components/dashboard/command-center-ui';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchCommunicationDashboard, fetchWhatsAppTemplates } from '@/services/communication';

export function WhatsAppCenterPage() {
  const enabled = useAuthQueryEnabled();
  const dashboard = useQuery({
    queryKey: ['communication', 'dashboard'],
    queryFn: fetchCommunicationDashboard,
    enabled,
  });
  const templates = useQuery({
    queryKey: ['communication', 'whatsapp-templates'],
    queryFn: fetchWhatsAppTemplates,
    enabled,
  });

  const wa = dashboard.data?.channelHealth?.whatsapp;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SaaSCard>
          <p className="text-sm text-muted-foreground">Meta API</p>
          <p className="mt-2 text-xl font-bold">{wa?.connected ? 'Connected' : 'Not configured'}</p>
        </SaaSCard>
        <SaaSCard>
          <p className="text-sm text-muted-foreground">Templates Approved</p>
          <p className="mt-2 text-xl font-bold">{wa?.templatesApproved ?? 0}</p>
        </SaaSCard>
        <SaaSCard>
          <p className="text-sm text-muted-foreground">Messages Delivered</p>
          <p className="mt-2 text-xl font-bold">{wa?.messagesDelivered ?? 0}</p>
        </SaaSCard>
      </div>
      <SaaSCard>
        <h2 className="font-semibold">WhatsApp Templates</h2>
        <div className="mt-3 space-y-2">
          {(
            (templates.data as {
              id: string;
              name: string;
              category: string;
              status: string;
              usageCount?: number;
            }[]) ?? []
          ).map((t) => (
            <div
              key={t.id}
              className="flex justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span>{t.name}</span>
              <span className="text-muted-foreground">
                {t.category} · {t.status}
              </span>
            </div>
          ))}
          {!templates.data?.length ? (
            <p className="text-sm text-muted-foreground">No WhatsApp templates registered.</p>
          ) : null}
        </div>
      </SaaSCard>
    </div>
  );
}
