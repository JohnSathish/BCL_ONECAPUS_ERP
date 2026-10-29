'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Send, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { confirmRevokeCampaign } from '@/components/communication/notifications/notification-history-admin';
import {
  cancelCommunicationCampaign,
  fetchCampaignDesk,
  fetchCampaignRecipients,
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
  const recipients = useQuery({
    queryKey: ['communication', 'recipients', expandedId],
    queryFn: () => fetchCampaignRecipients(expandedId!),
    enabled: Boolean(expandedId),
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
            expanded={expandedId === campaign.id}
            onToggle={() => setExpandedId(expandedId === campaign.id ? null : campaign.id)}
            recipients={expandedId === campaign.id ? recipients.data : undefined}
            recipientsError={
              expandedId === campaign.id && recipients.isError ? recipients.error : null
            }
            onRetryRecipients={() => void recipients.refetch()}
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
                  'Message / Campaign ID',
                  'Type',
                  'Recipients',
                  'Status',
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
                      <p className="text-xs text-slate-500">{row.template?.code ?? row.id}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${campaignKind(row) === 'Security' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {campaignKind(row)}
                      </span>
                      {automated ? (
                        <p className="mt-1 text-[10px] uppercase text-blue-700">Automated</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {campaignRecipientLabel(row)}
                      <p className="text-xs text-slate-500">{audienceLabel(row.audienceType)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${row.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : row.status === 'REVOKED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {when(row.sentAt ?? row.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                        >
                          Recipients
                        </Button>
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
                      {expandedId === row.id && recipients.isError ? (
                        <div className="mt-2">
                          <QueryErrorPanel
                            title="Unable to load recipients"
                            error={recipients.error}
                            onRetry={() => void recipients.refetch()}
                            isRetrying={recipients.isFetching}
                          />
                        </div>
                      ) : null}
                      {expandedId === row.id && recipients.data ? (
                        <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-slate-600">
                          {recipients.data.slice(0, 50).map((person) => (
                            <li key={person.id}>
                              {person.displayName} · {person.deliveryStatus}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!items.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
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
    </div>
  );
}

function CampaignCard({
  campaign,
  expanded,
  onToggle,
  recipients,
  recipientsError,
  onRetryRecipients,
  onSend,
  onCancel,
  onRevoke,
  busy,
}: {
  campaign: CommunicationCampaign;
  expanded: boolean;
  onToggle: () => void;
  recipients?: { id: string; displayName?: string | null; deliveryStatus: string }[];
  recipientsError: unknown;
  onRetryRecipients: () => void;
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
          <Button size="sm" variant="outline" onClick={onToggle}>
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
      {expanded && recipientsError ? (
        <div className="mt-3">
          <QueryErrorPanel
            title="Unable to load recipients"
            error={recipientsError}
            onRetry={onRetryRecipients}
          />
        </div>
      ) : null}
      {expanded && recipients ? (
        <ul className="mt-3 max-h-40 overflow-y-auto text-xs">
          {recipients.slice(0, 50).map((person) => (
            <li key={person.id}>
              {person.displayName} · {person.deliveryStatus}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
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
