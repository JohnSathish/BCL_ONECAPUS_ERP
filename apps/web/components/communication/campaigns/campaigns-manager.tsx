'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Send, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { hasPermission } from '@/lib/permissions/portal-access';
import { confirmRevokeCampaign } from '@/components/communication/notifications/notification-history-admin';
import {
  CampaignDetailsDrawer,
  type CampaignDrawerTab,
} from '@/components/communication/campaigns/campaign-details-drawer';
import {
  cancelCommunicationCampaign,
  fetchCampaignDesk,
  fetchCommunicationCampaigns,
  revokeCommunicationCampaign,
  sendCommunicationCampaign,
} from '@/services/communication';
import type { CommunicationCampaign } from '@/types/communication';
import { apiErrorMessage } from '@/utils/api-error';

const AUDIENCES = [
  'STUDENTS',
  'FACULTY',
  'PARENTS',
  'INDIVIDUAL',
  'ALL_USERS',
  'STUDENTS_AND_STAFF',
];
const STATUSES = ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'REVOKED', 'CANCELLED'];

function monthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function campaignRecipientLabel(campaign: CommunicationCampaign) {
  const meta = (campaign.metadata ?? {}) as Record<string, unknown>;
  const materialised = campaign._count?.recipients ?? 0;
  const estimated = typeof meta.estimatedRecipients === 'number' ? meta.estimatedRecipients : null;
  if (materialised > 0)
    return `${materialised.toLocaleString('en-IN')} recipient${materialised === 1 ? '' : 's'}`;
  if (estimated != null) return `${estimated.toLocaleString('en-IN')} estimated`;
  return '0 recipients';
}

function audienceLabel(value: string) {
  if (value === 'STUDENTS') return 'Students';
  if (value === 'FACULTY') return 'Staff';
  if (value === 'INDIVIDUAL') return 'Individual';
  if (value === 'ALL_USERS') return 'Everyone';
  return value.replace(/_/g, ' ');
}

function campaignKind(row: CommunicationCampaign) {
  const code = `${row.template?.code ?? ''} ${row.name}`.toUpperCase();
  if (code.includes('SECURITY') || code.includes('PASSWORD') || code.includes('DEVICE'))
    return 'Security';
  if (
    code.includes('EXAM') ||
    code.includes('FEE') ||
    code.includes('ATTEND') ||
    code.includes('RESULT')
  )
    return 'Academic';
  if (code.includes('EVENT')) return 'Events';
  return 'Notice';
}

function when(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  const relative =
    minutes < 1
      ? 'Just now'
      : minutes < 60
        ? `${minutes} min ago`
        : minutes < 1440
          ? `${Math.round(minutes / 60)} hr ago`
          : date.toLocaleDateString('en-IN');
  return `${relative} · ${date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}

export function CampaignsManager({ statusFilter }: { statusFilter?: string }) {
  const enabled = useAuthQueryEnabled();
  const { session } = useAuth();
  const canManage = hasPermission(
    session?.user.permissions ?? [],
    session?.user.roles ?? [],
    'communication:manage',
  );
  const qc = useQueryClient();
  const [kind, setKind] = useState<'all' | 'automated' | 'manual'>('all');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({
    search: '',
    status: '',
    audience: '',
    noticeType: '',
    from: monthStart(),
    to: todayKey(),
  });
  const [applied, setApplied] = useState(draft);
  const [drawer, setDrawer] = useState<{ id: string; tab: CampaignDrawerTab } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const campaigns = useQuery({
    queryKey: ['communication', 'campaigns', statusFilter],
    queryFn: () => fetchCommunicationCampaigns(statusFilter),
    enabled: enabled && Boolean(statusFilter),
  });
  const desk = useQuery({
    queryKey: ['communication', 'campaign-desk', kind, page, applied],
    queryFn: () =>
      fetchCampaignDesk({
        kind,
        page,
        limit: 50,
        search: applied.search || undefined,
        status: applied.status || undefined,
        audience: applied.audience || undefined,
        noticeType: applied.noticeType || undefined,
        from: applied.from || undefined,
        to: applied.to || undefined,
      }),
    enabled: enabled && !statusFilter,
  });
  const send = useMutation({
    mutationFn: sendCommunicationCampaign,
    onSuccess: () => {
      setActionError(null);
      void qc.invalidateQueries({ queryKey: ['communication'] });
    },
    onError: (err) => setActionError(apiErrorMessage(err, 'Could not send this campaign')),
  });
  const cancel = useMutation({
    mutationFn: cancelCommunicationCampaign,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['communication'] }),
  });
  const revoke = useMutation({
    mutationFn: revokeCommunicationCampaign,
    onSuccess: (result) => {
      setActionError(null);
      setActionNote(
        `Revoked. Removed ${result.removedNotifications.toLocaleString('en-IN')} notification${result.removedNotifications === 1 ? '' : 's'} from app lists.`,
      );
      void qc.invalidateQueries({ queryKey: ['communication'] });
    },
    onError: (err) => setActionError(apiErrorMessage(err, 'Could not revoke this campaign')),
  });

  if (statusFilter) {
    const rows = campaigns.data ?? [];
    return (
      <div className="space-y-4">
        {actionNote ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            {actionNote}
          </p>
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
        {rows.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            onView={() => setDrawer({ id: campaign.id, tab: 'message' })}
            onRecipients={() => setDrawer({ id: campaign.id, tab: 'recipients' })}
            onSend={() => send.mutate(campaign.id)}
            onCancel={() => cancel.mutate(campaign.id)}
            onRevoke={() => {
              if (!confirmRevokeCampaign(campaign.name)) return;
              revoke.mutate(campaign.id);
            }}
            busy={send.isPending || cancel.isPending || revoke.isPending}
          />
        ))}
        {!rows.length && !campaigns.isError ? (
          <p className="text-sm text-slate-500">No campaigns.</p>
        ) : null}
        {drawer ? (
          <CampaignDetailsDrawer
            campaignId={drawer.id}
            tab={drawer.tab}
            onTab={(tab) => setDrawer({ id: drawer.id, tab })}
            onClose={() => setDrawer(null)}
            canManage={canManage}
          />
        ) : null}
      </div>
    );
  }

  const summary = desk.data?.summary;
  const items = desk.data?.items ?? [];
  const total = desk.data?.total ?? 0;

  function exportCsv() {
    const header = ['Message', 'Type', 'Recipients', 'Status', 'Sent at', 'Campaign ID'];
    const body = items.map((row) => [
      row.name,
      campaignKind(row),
      audienceLabel(row.audienceType),
      row.status,
      row.sentAt ?? row.createdAt,
      row.id,
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'campaigns.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Communication Center</h1>
          <p className="text-sm text-slate-500">
            Create, manage and track push notification campaigns
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/communication/compose">
            <Send className="mr-2 h-4 w-4" />
            Create Campaign
          </Link>
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          icon={Send}
          label="Total Campaigns"
          value={summary?.campaigns}
          growth={summary?.campaignsGrowth}
          hint="Across all time"
          tone="bg-blue-50 text-blue-700"
        />
        <Stat
          icon={Users}
          label="Total Recipients"
          value={summary?.recipients}
          growth={summary?.recipientsGrowth}
          hint="Rows on campaign lists"
          tone="bg-sky-50 text-sky-700"
        />
        <Stat
          icon={CheckCircle2}
          label="Delivered"
          value={summary?.delivered}
          share={summary?.deliveredShare}
          hint="Successful deliveries"
          tone="bg-emerald-50 text-emerald-700"
        />
        <Stat
          icon={Clock}
          label="Pending"
          value={summary?.pending}
          share={summary?.pendingShare}
          hint="Waiting to send"
          tone="bg-amber-50 text-amber-700"
        />
        <Stat
          icon={AlertTriangle}
          label="Failed"
          value={summary?.failed}
          share={summary?.failedShare}
          hint="Delivery failed"
          tone="bg-rose-50 text-rose-700"
        />
      </div>
      {actionNote ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          {actionNote}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      {desk.isError ? (
        <QueryErrorPanel
          title="Unable to load campaigns"
          error={desk.error}
          onRetry={() => void desk.refetch()}
          isRetrying={desk.isFetching}
        />
      ) : null}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex gap-1">
            {(
              [
                ['all', `All (${summary?.campaigns ?? 0})`],
                ['automated', `Automated (${summary?.automated ?? 0})`],
                ['manual', `Manual (${summary?.manual ?? 0})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm ${kind === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => {
                  setKind(key);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {applied.from} – {applied.to}
          </p>
        </div>
        <div className="grid gap-2 p-4 md:grid-cols-6">
          <Input
            className="md:col-span-2"
            placeholder="Search campaigns by message, ID or type"
            value={draft.search}
            onChange={(event) => setDraft({ ...draft, search: event.target.value })}
          />
          <select
            className="rounded-md border bg-background px-2 text-sm"
            aria-label="Type"
            value={draft.noticeType}
            onChange={(event) => setDraft({ ...draft, noticeType: event.target.value })}
          >
            <option value="">All Types</option>
            <option value="security">Security</option>
            <option value="academic">Academic</option>
            <option value="events">Events</option>
            <option value="notice">Notice</option>
          </select>
          <select
            className="rounded-md border bg-background px-2 text-sm"
            aria-label="Recipients"
            value={draft.audience}
            onChange={(event) => setDraft({ ...draft, audience: event.target.value })}
          >
            <option value="">All Recipients</option>
            {AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>
                {audienceLabel(audience)}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-2 text-sm"
            aria-label="Status"
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value })}
          >
            <option value="">All Status</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setApplied(draft);
                setPage(1);
              }}
            >
              Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = {
                  search: '',
                  status: '',
                  audience: '',
                  noticeType: '',
                  from: monthStart(),
                  to: todayKey(),
                };
                setDraft(next);
                setApplied(next);
                setPage(1);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="grid gap-2 px-4 pb-3 md:grid-cols-2">
          <Input
            type="date"
            aria-label="From date"
            value={draft.from}
            onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          />
          <Input
            type="date"
            aria-label="To date"
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
          <div>
            <p className="font-medium">Campaigns</p>
            <p className="text-xs text-slate-500">
              Showing {items.length} of {total.toLocaleString('en-IN')} campaigns
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            Export
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  '#',
                  'Campaign',
                  'Type',
                  'Recipients',
                  'Status',
                  'Delivery',
                  'Sent at',
                  'Actions',
                ].map((header) => (
                  <th key={header} className="px-3 py-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => {
                const automated = Boolean(
                  (row.metadata as Record<string, unknown> | undefined)?.trigger,
                );
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-3 py-2">{(page - 1) * 50 + index + 1}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{row.id}</p>
                      {row.template?.code ? (
                        <p className="text-[11px] text-slate-400">{row.template.code}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${campaignKind(row) === 'Security' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {campaignKind(row)}
                      </span>
                      {automated ? (
                        <p className="mt-1 text-[10px] uppercase text-blue-700">Automated</p>
                      ) : (
                        <p className="mt-1 text-[10px] uppercase text-slate-400">Manual</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {campaignRecipientLabel(row)}
                      <p className="text-xs text-slate-500">{audienceLabel(row.audienceType)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${row.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : row.status === 'REVOKED' || row.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600' : row.status === 'PENDING' || row.status === 'SENDING' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <DeliveryCell campaign={row} />
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {when(row.sentAt ?? row.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDrawer({ id: row.id, tab: 'message' })}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDrawer({ id: row.id, tab: 'recipients' })}
                        >
                          Recipients
                        </Button>
                        {['DRAFT', 'SCHEDULED'].includes(row.status) ||
                        ['SENT', 'SENDING', 'FAILED'].includes(row.status) ? (
                          <details>
                            <summary className="cursor-pointer list-none rounded-md border px-2 py-1 text-xs">
                              More
                            </summary>
                            <div className="mt-1 flex w-28 flex-col gap-1">
                              {['DRAFT', 'SCHEDULED'].includes(row.status) ? (
                                <Button
                                  size="sm"
                                  disabled={send.isPending}
                                  onClick={() => send.mutate(row.id)}
                                >
                                  Send
                                </Button>
                              ) : null}
                              {['DRAFT', 'SCHEDULED'].includes(row.status) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={cancel.isPending}
                                  onClick={() => cancel.mutate(row.id)}
                                >
                                  Cancel
                                </Button>
                              ) : null}
                              {['SENT', 'SENDING', 'FAILED'].includes(row.status) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={revoke.isPending}
                                  onClick={() => {
                                    if (!confirmRevokeCampaign(row.name)) return;
                                    revoke.mutate(row.id);
                                  }}
                                >
                                  Revoke
                                </Button>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    {desk.isLoading ? 'Loading campaigns…' : 'No campaigns match these filters.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 p-3">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 50 >= total}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </section>
      {drawer ? (
        <CampaignDetailsDrawer
          campaignId={drawer.id}
          tab={drawer.tab}
          onTab={(tab) => setDrawer({ id: drawer.id, tab })}
          onClose={() => setDrawer(null)}
          canManage={canManage}
        />
      ) : null}
    </div>
  );
}

function CampaignCard({
  campaign,
  onView,
  onRecipients,
  onSend,
  onCancel,
  onRevoke,
  busy,
}: {
  campaign: CommunicationCampaign;
  onView: () => void;
  onRecipients: () => void;
  onSend: () => void;
  onCancel: () => void;
  onRevoke: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{campaign.name}</p>
          <p className="text-sm text-slate-500">
            {campaign.audienceType} · {campaign.status} · {campaignRecipientLabel(campaign)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onView}>
            View
          </Button>
          <Button size="sm" variant="outline" onClick={onRecipients}>
            Recipients
          </Button>
          {['DRAFT', 'SCHEDULED'].includes(campaign.status) ? (
            <Button size="sm" disabled={busy} onClick={onSend}>
              Send
            </Button>
          ) : null}
          {['DRAFT', 'SCHEDULED'].includes(campaign.status) ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {['SENT', 'SENDING', 'FAILED'].includes(campaign.status) ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={onRevoke}>
              Revoke
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DeliveryCell({ campaign }: { campaign: CommunicationCampaign }) {
  const total = campaign._count?.recipients ?? 0;
  const confirmed = campaign.delivery?.confirmed ?? 0;
  const accepted = campaign.delivery?.accepted ?? 0;
  const failed = campaign.delivery?.failed ?? 0;
  if (!total) return <span className="text-xs text-slate-400">—</span>;
  const success = confirmed + accepted;
  const pct = Math.round((success / total) * 1000) / 10;
  if (confirmed > 0 && accepted === 0) {
    return (
      <span className="text-sm font-medium text-emerald-600">
        {confirmed.toLocaleString('en-IN')} ({pct}%)
        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">delivered</span>
      </span>
    );
  }
  if (accepted > 0 && confirmed === 0) {
    return (
      <span className="text-sm font-medium text-[#155EEF]">
        {accepted.toLocaleString('en-IN')} ({pct}%)
        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
          accepted by service
        </span>
      </span>
    );
  }
  if (success > 0) {
    return (
      <span className="text-sm font-medium text-emerald-600">
        {success.toLocaleString('en-IN')} ({pct}%)
        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
          {confirmed.toLocaleString('en-IN')} delivered · {accepted.toLocaleString('en-IN')}{' '}
          accepted
        </span>
      </span>
    );
  }
  if (failed > 0) {
    return (
      <span className="text-sm font-medium text-rose-600">
        {failed.toLocaleString('en-IN')} failed
      </span>
    );
  }
  return <span className="text-xs text-amber-600">Pending</span>;
}

function Stat({
  icon: Icon,
  label,
  value,
  growth,
  share,
  hint,
  tone,
}: {
  icon: typeof Send;
  label: string;
  value?: number;
  growth?: number | null;
  share?: number | null;
  hint: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">
        {value == null ? '—' : value.toLocaleString('en-IN')}
        {share != null ? (
          <span className="ml-2 text-sm font-medium text-slate-500">{share}%</span>
        ) : null}
      </p>
      <p className="text-xs text-slate-500">
        {growth == null ? null : (
          <span
            className={
              growth >= 0 ? 'mr-1 font-medium text-emerald-600' : 'mr-1 font-medium text-rose-600'
            }
          >
            {growth > 0 ? '+' : ''}
            {growth}% in 30 days ·{' '}
          </span>
        )}
        {hint}
      </p>
    </div>
  );
}
