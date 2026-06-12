'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, History, Mail, Megaphone, Send, Sparkles, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useAuth, useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { useRequireAdminPortal } from '@/hooks/use-require-admin-portal';
import { hasAnyPermission } from '@/lib/permissions/portal-access';
import {
  createCommunicationCampaign,
  fetchCommunicationCampaigns,
  fetchCommunicationDashboard,
  fetchCommunicationTemplates,
  fetchDeliveryLogs,
  previewCommunicationAudience,
  seedCommunicationTemplates,
  sendCommunicationCampaign,
} from '@/services/communication';
import { fetchDepartments } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';

type Tab = 'dashboard' | 'compose' | 'templates' | 'history' | 'logs';

const AUDIENCE_OPTIONS = [
  { value: 'STUDENTS', label: 'Students' },
  { value: 'PARENTS', label: 'Parents / Guardians' },
  { value: 'FACULTY', label: 'Faculty & Staff' },
  { value: 'DEPARTMENTS', label: 'Departments' },
  { value: 'INDIVIDUAL', label: 'Individual Users' },
];

export function CommunicationWorkspace() {
  useRequireAuth();
  useRequireAdminPortal();
  const { session } = useAuth();
  const permissions = session?.user.permissions ?? [];
  const canReadCommunication = hasAnyPermission(permissions, [
    'communication:read',
    'communication:manage',
  ]);
  const authReady = useAuthQueryEnabled() && canReadCommunication;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [message, setMessage] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'automated' | 'manual'>('all');

  const [compose, setCompose] = useState({
    name: '',
    subject: '',
    bodyText: '',
    audienceType: 'STUDENTS',
    departmentIds: [] as string[],
    channels: ['IN_APP', 'EMAIL'] as string[],
    templateId: '',
  });

  const dashboard = useQuery({
    queryKey: ['communication', 'dashboard'],
    queryFn: fetchCommunicationDashboard,
    enabled: authReady,
  });

  const templates = useQuery({
    queryKey: ['communication', 'templates'],
    queryFn: () => fetchCommunicationTemplates(),
    enabled: authReady,
  });

  const campaigns = useQuery({
    queryKey: ['communication', 'campaigns'],
    queryFn: () => fetchCommunicationCampaigns(),
    enabled: authReady && (tab === 'history' || tab === 'dashboard'),
  });

  const deliveryLogs = useQuery({
    queryKey: ['communication', 'delivery-logs'],
    queryFn: () => fetchDeliveryLogs({ limit: 100 }),
    enabled: authReady && tab === 'logs',
  });

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => fetchDepartments(),
    enabled: authReady && tab === 'compose',
  });

  const seedTemplates = useMutation({
    mutationFn: seedCommunicationTemplates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication'] });
      setMessage('Default message templates loaded.');
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Failed to load templates')),
  });

  const previewAudience = useMutation({
    mutationFn: () =>
      previewCommunicationAudience({
        audienceType: compose.audienceType,
        audienceFilter: compose.departmentIds.length
          ? { departmentIds: compose.departmentIds }
          : {},
      }),
  });

  const createCampaign = useMutation({
    mutationFn: async (sendNow: boolean) => {
      const campaign = await createCommunicationCampaign({
        name: compose.name || compose.subject,
        subject: compose.subject,
        bodyText: compose.bodyText,
        bodyHtml: `<p>${compose.bodyText.replace(/\n/g, '<br/>')}</p>`,
        audienceType: compose.audienceType,
        audienceFilter: compose.departmentIds.length
          ? { departmentIds: compose.departmentIds }
          : {},
        channels: compose.channels,
        templateId: compose.templateId || undefined,
      });
      if (sendNow) {
        await sendCommunicationCampaign(campaign.id);
      }
      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication'] });
      setMessage('Campaign queued for delivery.');
      setCompose((c) => ({ ...c, name: '', subject: '', bodyText: '' }));
      setTab('history');
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Failed to load templates')),
  });

  const sendExisting = useMutation({
    mutationFn: sendCommunicationCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communication'] });
      setMessage('Campaign sent.');
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Failed to load templates')),
  });

  const filteredCampaigns = useMemo(() => {
    const rows = campaigns.data ?? [];
    if (campaignFilter === 'automated') {
      return rows.filter((c) =>
        Boolean((c.metadata as Record<string, unknown> | undefined)?.trigger),
      );
    }
    if (campaignFilter === 'manual') {
      return rows.filter((c) => !(c.metadata as Record<string, unknown> | undefined)?.trigger);
    }
    return rows;
  }, [campaigns.data, campaignFilter]);

  const tabs = useMemo(
    () => [
      { id: 'dashboard' as const, label: 'Overview', icon: Megaphone },
      { id: 'compose' as const, label: 'Compose', icon: Send },
      { id: 'templates' as const, label: 'Templates', icon: Mail },
      { id: 'history' as const, label: 'Campaigns', icon: History },
      { id: 'logs' as const, label: 'Delivery Logs', icon: Bell },
    ],
    [],
  );

  return (
    <DashboardShell role="admin" title="Communication Center">
      {!canReadCommunication ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-900">
          You do not have permission to access the Communication Center. Contact your administrator
          if you need access.
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Central hub for email, in-app notifications, and future channels (SMS, WhatsApp, Push).
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <Button
                key={t.id}
                variant={tab === t.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTab(t.id)}
              >
                <t.icon className="mr-2 h-4 w-4" />
                {t.label}
              </Button>
            ))}
          </div>

          {message ? (
            <div className="mb-4 rounded-xl border border-border/80 bg-muted/40 px-4 py-3 text-sm">
              {message}
            </div>
          ) : null}

          {tab === 'dashboard' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Active Templates', value: dashboard.data?.templates ?? '—' },
                { label: 'Total Campaigns', value: dashboard.data?.campaigns ?? '—' },
                { label: 'Sent', value: dashboard.data?.sent ?? '—' },
                { label: 'Pending', value: dashboard.data?.pending ?? '—' },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm"
                >
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{card.value}</p>
                </div>
              ))}
              <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-border/80 bg-card p-5">
                <h3 className="font-medium">Recent campaigns</h3>
                <div className="mt-3 space-y-2">
                  {(dashboard.data?.recentCampaigns ?? []).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-muted-foreground">
                          {c.audienceType} · {c.status}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {!dashboard.data?.recentCampaigns?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No campaigns yet. Compose your first message.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'compose' ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5">
                <Input
                  placeholder="Campaign name (internal)"
                  value={compose.name}
                  onChange={(e) => setCompose((c) => ({ ...c, name: e.target.value }))}
                />
                <Input
                  placeholder="Subject"
                  value={compose.subject}
                  onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                />
                <textarea
                  className="min-h-[180px] w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
                  placeholder="Message body"
                  value={compose.bodyText}
                  onChange={(e) => setCompose((c) => ({ ...c, bodyText: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => previewAudience.mutate()}
                    disabled={previewAudience.isPending}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Preview audience
                  </Button>
                  <Button
                    onClick={() => createCampaign.mutate(false)}
                    disabled={!compose.subject || !compose.bodyText || createCampaign.isPending}
                    variant="outline"
                  >
                    Save draft
                  </Button>
                  <Button
                    onClick={() => createCampaign.mutate(true)}
                    disabled={!compose.subject || !compose.bodyText || createCampaign.isPending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send now
                  </Button>
                </div>
                {previewAudience.data ? (
                  <p className="text-sm text-muted-foreground">
                    {previewAudience.data.length} recipient(s) matched · showing up to 5:{' '}
                    {previewAudience.data
                      .slice(0, 5)
                      .map((r) => r.displayName)
                      .join(', ')}
                  </p>
                ) : null}
              </div>

              <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-5">
                <div>
                  <label className="text-sm font-medium">Audience</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
                    value={compose.audienceType}
                    onChange={(e) => setCompose((c) => ({ ...c, audienceType: e.target.value }))}
                  >
                    {AUDIENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {['STUDENTS', 'PARENTS', 'FACULTY', 'DEPARTMENTS'].includes(
                  compose.audienceType,
                ) ? (
                  <div>
                    <label className="text-sm font-medium">Departments (optional filter)</label>
                    <select
                      multiple
                      className="mt-1 h-32 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
                      value={compose.departmentIds}
                      onChange={(e) =>
                        setCompose((c) => ({
                          ...c,
                          departmentIds: Array.from(e.target.selectedOptions, (o) => o.value),
                        }))
                      }
                    >
                      {(departments.data ?? []).map((d: { id: string; name: string }) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div>
                  <label className="text-sm font-medium">Template (optional)</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-sm"
                    value={compose.templateId}
                    onChange={(e) => {
                      const tpl = templates.data?.find((t) => t.id === e.target.value);
                      setCompose((c) => ({
                        ...c,
                        templateId: e.target.value,
                        subject: tpl?.subject ?? c.subject,
                        bodyText: tpl?.bodyText ?? c.bodyText,
                      }));
                    }}
                  >
                    <option value="">— None —</option>
                    {(templates.data ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Channels (Sprint 1)</label>
                  <div className="mt-2 space-y-1 text-sm">
                    {['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'].map((ch) => (
                      <label key={ch} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={compose.channels.includes(ch)}
                          disabled={!['IN_APP', 'EMAIL'].includes(ch)}
                          onChange={(e) =>
                            setCompose((c) => ({
                              ...c,
                              channels: e.target.checked
                                ? [...c.channels, ch]
                                : c.channels.filter((x) => x !== ch),
                            }))
                          }
                        />
                        {ch}
                        {!['IN_APP', 'EMAIL'].includes(ch) ? ' (coming soon)' : ''}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'templates' ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => seedTemplates.mutate()} disabled={seedTemplates.isPending}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Load default templates
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(templates.data ?? []).map((t) => (
                  <div key={t.id} className="rounded-2xl border border-border/80 bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.code} · {t.category}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{t.subject}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Channels: {(t.channels ?? []).join(', ')}
                    </p>
                  </div>
                ))}
                {!templates.data?.length ? (
                  <p className="text-sm text-muted-foreground">
                    No templates yet. Load defaults to get started.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === 'history' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['all', 'automated', 'manual'] as const).map((filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={campaignFilter === filter ? 'default' : 'outline'}
                    onClick={() => setCampaignFilter(filter)}
                  >
                    {filter === 'all'
                      ? 'All campaigns'
                      : filter === 'automated'
                        ? 'Automated'
                        : 'Manual'}
                  </Button>
                ))}
              </div>
              {filteredCampaigns.map((c) => {
                const trigger = (c.metadata as Record<string, unknown> | undefined)?.trigger as
                  | string
                  | undefined;
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{c.name}</p>
                        {trigger ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                            Auto · {trigger}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {c.audienceType} · {c.status} · {c._count?.recipients ?? 0} recipients
                      </p>
                      <p className="text-xs text-muted-foreground">{c.subject}</p>
                    </div>
                    <div className="flex gap-2">
                      {['DRAFT', 'SCHEDULED'].includes(c.status) ? (
                        <Button
                          size="sm"
                          onClick={() => sendExisting.mutate(c.id)}
                          disabled={sendExisting.isPending}
                        >
                          Send
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!filteredCampaigns.length ? (
                <p className="text-sm text-muted-foreground">No campaigns yet.</p>
              ) : null}
            </div>
          ) : null}

          {tab === 'logs' ? (
            <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border/80 text-left text-muted-foreground">
                    <th className="px-4 py-3">Recipient</th>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {(deliveryLogs.data ?? []).map((log) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
              {!deliveryLogs.data?.length ? (
                <p className="p-4 text-sm text-muted-foreground">No delivery logs yet.</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </DashboardShell>
  );
}
