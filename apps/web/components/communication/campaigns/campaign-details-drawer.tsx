'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DOMPurify from 'isomorphic-dompurify';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  downloadCampaignRecipients,
  downloadCampaignReport,
  duplicateCommunicationCampaign,
  fetchCampaignDetail,
  fetchCampaignRecipientDetail,
  fetchCampaignRecipientDirectory,
  resendFailedCampaign,
  type CampaignRecipientRow,
} from '@/services/communication';
import type { CommunicationCampaign } from '@/types/communication';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export type CampaignDrawerTab = 'overview' | 'message' | 'recipients';

const STATUS_TONE: Record<string, string> = {
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  ACCEPTED: 'bg-blue-50 text-blue-700',
  PENDING: 'bg-amber-50 text-amber-700',
  FAILED: 'bg-rose-50 text-rose-700',
  SKIPPED: 'bg-slate-100 text-slate-600',
  SENT: 'bg-emerald-50 text-emerald-700',
  REVOKED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export function CampaignDetailsDrawer({
  campaignId,
  tab,
  onTab,
  onClose,
  canManage,
}: {
  campaignId: string;
  tab: CampaignDrawerTab;
  onTab: (tab: CampaignDrawerTab) => void;
  onClose: () => void;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const detail = useQuery({
    queryKey: ['communication', 'campaign-detail', campaignId],
    queryFn: () => fetchCampaignDetail(campaignId),
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const campaign = detail.data;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30"
        aria-label="Close campaign details"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 flex h-full w-full min-w-0 max-w-[960px] flex-col overflow-hidden bg-white shadow-2xl sm:w-[min(960px,58vw)] sm:rounded-l-2xl">
        <header className="shrink-0 border-b bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Campaign Details
              </p>
              <h2 className="mt-1 break-words text-lg font-semibold leading-snug text-slate-900">
                {campaign?.name ?? 'Campaign'}
              </h2>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {campaign ? <StatusBadge status={campaign.status} /> : null}
            <span>Sent {stamp(campaign?.sentAt ?? campaign?.createdAt)}</span>
          </div>
          <p className="mt-1 break-all font-mono text-[11px] leading-4 text-slate-500">
            ID {campaignId}
          </p>
        </header>
        <div className="flex shrink-0 flex-wrap gap-1 border-b bg-white px-4 py-2">
          {(
            [
              ['overview', 'Overview'],
              ['message', 'Message Content'],
              ['recipients', 'Recipients'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                tab === key ? 'bg-[#155EEF] text-white' : 'text-slate-600 hover:bg-slate-50',
              )}
              onClick={() => onTab(key)}
            >
              {label}
              {key === 'recipients' && campaign?.delivery?.recipients
                ? ` (${campaign.delivery.recipients.toLocaleString('en-IN')})`
                : ''}
            </button>
          ))}
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {note ? (
            <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {note}
            </p>
          ) : null}
          {error ? (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}
          {detail.isError ? (
            <QueryErrorPanel
              title="Unable to load this campaign"
              error={detail.error}
              onRetry={() => void detail.refetch()}
            />
          ) : null}
          {detail.isLoading ? <DrawerSkeleton /> : null}
          {campaign && tab === 'overview' ? <Overview campaign={campaign} /> : null}
          {campaign && tab === 'message' ? <MessageTab campaign={campaign} /> : null}
          {tab === 'recipients' ? (
            <RecipientsTab
              campaignId={campaignId}
              summary={campaign?.delivery}
              onFilters={setFilters}
            />
          ) : null}
        </div>
        {campaign ? (
          <DrawerActions
            campaign={campaign}
            canManage={canManage}
            filters={filters}
            onNote={setNote}
            onError={setError}
            onDone={() => void qc.invalidateQueries({ queryKey: ['communication'] })}
          />
        ) : null}
      </aside>
    </div>
  );
}

function Overview({ campaign }: { campaign: CommunicationCampaign }) {
  const delivery = campaign.delivery;
  const total = delivery?.recipients ?? campaign._count?.recipients ?? 0;
  const channels = (campaign.channels ?? []).map(channelLabel).join(', ') || '—';
  const createdBy = campaign.createdBy?.displayName || campaign.createdBy?.email || '—';
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 rounded-2xl border border-slate-200 p-4 text-sm sm:grid-cols-2">
        <Fact label="Campaign" value={campaign.name} />
        <Fact label="Campaign ID" value={campaign.id} mono />
        <Fact label="Type" value={typeLabel(campaign)} />
        <Fact label="Channel" value={channels} />
        <Fact label="Created by" value={createdBy} />
        <Fact label="Created" value={stamp(campaign.createdAt)} />
        <Fact label="Scheduled" value={stamp(campaign.scheduledAt)} />
        <Fact label="Sent" value={stamp(campaign.sentAt)} />
        <Fact label="Recipients" value={total.toLocaleString('en-IN')} />
        <Fact label="Status" value={campaign.status} />
      </dl>
      <DeliveryCards total={total} delivery={delivery} />
      <p className="text-xs leading-5 text-slate-500">
        Delivered means the message was stored in the app inbox or a provider returned a delivery
        receipt. Accepted means the push service took the request and did not return a handset
        receipt. Opened is shown only when a read receipt or tracked open exists.
      </p>
    </div>
  );
}

function MessageTab({ campaign }: { campaign: CommunicationCampaign }) {
  const [copied, setCopied] = useState<string | null>(null);
  const title = campaign.subject || campaign.name;
  const plain = plainMessage(campaign.bodyText, campaign.bodyHtml);
  const rich = hasRichFormatting(campaign.bodyHtml) ? campaign.bodyHtml : null;
  const safeHtml = rich
    ? DOMPurify.sanitize(rich, { ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt'] })
    : '';
  const attachments = campaign.attachments ?? [];
  const images = attachments.filter((file) => file.type === 'image' && file.url);
  const files = attachments.filter((file) => file.type !== 'image' && file.url);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  }

  const details = [
    `Campaign: ${campaign.name}`,
    `ID: ${campaign.id}`,
    `Status: ${campaign.status}`,
    `Sent: ${stamp(campaign.sentAt ?? campaign.createdAt)}`,
    `Title: ${title}`,
    '',
    plain || 'No message body was stored.',
  ].join('\n');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void copy(`${title}\n\n${plain}`, 'Message')}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Message
        </Button>
        <Button size="sm" variant="outline" onClick={() => void copy(details, 'Campaign details')}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Campaign Details
        </Button>
      </div>
      {copied ? <p className="text-xs text-emerald-700">{copied} copied.</p> : null}
      <p className="text-xs text-slate-500">
        This is the message stored when the campaign was created. Changing the template later does
        not change it.
      </p>
      {/\{\{[^}]+\}\}/.test(plain) ? (
        <p className="text-xs text-amber-700">
          This stored copy still contains a placeholder. Open a recipient to see the inbox copy
          saved for that person.
        </p>
      ) : null}
      <article className="rounded-2xl border border-slate-200 bg-[#F4F7FC] p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Notification preview</p>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-base font-semibold text-slate-900">{title}</p>
          {rich ? (
            <div
              className="prose prose-sm mt-2 max-w-none whitespace-pre-wrap text-slate-700"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {plain ? linkify(plain) : 'No message body was stored for this campaign.'}
            </p>
          )}
          {images.map((file) => (
            <img
              key={file.url}
              src={resolveUploadAssetUrl(file.url)}
              alt={file.name || 'Notification image'}
              className="mt-3 max-h-64 rounded-xl border object-contain"
            />
          ))}
        </div>
      </article>
      {files.length ? (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.url}>
              <a
                className="inline-flex items-center gap-2 text-sm text-[#155EEF] underline"
                href={resolveUploadAssetUrl(file.url)}
                target="_blank"
                rel="noreferrer"
              >
                <FileText className="h-4 w-4" />
                {file.name || 'Download attachment'}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RecipientsTab({
  campaignId,
  summary,
  onFilters,
}: {
  campaignId: string;
  summary?: CommunicationCampaign['delivery'];
  onFilters: (filters: Record<string, string | undefined>) => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [sort, setSort] = useState<'name' | 'department' | 'status' | 'delivered'>('name');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, status, role, department, sort]);

  useEffect(() => {
    onFilters({
      search: debounced || undefined,
      status: status || undefined,
      role: role || undefined,
      department: department || undefined,
      sort,
    });
  }, [debounced, status, role, department, sort, onFilters]);

  const directory = useQuery({
    queryKey: [
      'communication',
      'recipient-directory',
      campaignId,
      debounced,
      status,
      role,
      department,
      sort,
      page,
    ],
    queryFn: () =>
      fetchCampaignRecipientDirectory(campaignId, {
        page,
        limit: 25,
        search: debounced || undefined,
        status: status || undefined,
        role: role || undefined,
        department: department || undefined,
        sort,
      }),
  });
  const person = useQuery({
    queryKey: ['communication', 'recipient-detail', campaignId, selectedId],
    queryFn: () => fetchCampaignRecipientDetail(campaignId, selectedId!),
    enabled: Boolean(selectedId),
  });

  const total = directory.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  if (selectedId) {
    return (
      <div className="space-y-3">
        <Button size="sm" variant="outline" onClick={() => setSelectedId(null)}>
          Back to recipients
        </Button>
        {person.isError ? (
          <QueryErrorPanel
            title="Unable to load this recipient"
            error={person.error}
            onRetry={() => void person.refetch()}
          />
        ) : null}
        {person.isLoading ? <DrawerSkeleton /> : null}
        {person.data ? <RecipientDetail row={person.data} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DeliveryCards total={summary?.recipients ?? total} delivery={summary} compact />
      <div className="grid gap-2 md:grid-cols-2">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search recipient by name, email, roll number or department..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className="rounded-md border bg-white px-2 text-sm"
          aria-label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All Status</option>
          <option value="delivered">Delivered</option>
          <option value="accepted">Accepted</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="skipped">Cancelled</option>
        </select>
        <select
          className="rounded-md border bg-white px-2 text-sm"
          aria-label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="">All roles</option>
          <option value="staff">Staff</option>
          <option value="students">Students</option>
        </select>
        <select
          className="rounded-md border bg-white px-2 text-sm md:col-span-2"
          aria-label="Department"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        >
          <option value="">All departments</option>
          {(directory.data?.departments ?? []).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-slate-500">
        {directory.isLoading
          ? 'Loading recipients…'
          : `${total.toLocaleString('en-IN')} matching recipient${total === 1 ? '' : 's'}`}
      </p>
      {directory.isError ? (
        <QueryErrorPanel
          title="Unable to load recipients"
          error={directory.error}
          onRetry={() => void directory.refetch()}
          isRetrying={directory.isFetching}
        />
      ) : null}
      <div className="max-w-full overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-2 py-2">#</th>
              <SortHeader
                label="Recipient"
                active={sort === 'name'}
                onClick={() => setSort('name')}
              />
              <th className="px-2 py-2 font-medium">Email / Roll No.</th>
              <SortHeader
                label="Department"
                active={sort === 'department'}
                onClick={() => setSort('department')}
              />
              <th className="px-2 py-2 font-medium">Role</th>
              <SortHeader
                label="Status"
                active={sort === 'status'}
                onClick={() => setSort('status')}
              />
              <SortHeader
                label="Delivered at"
                active={sort === 'delivered'}
                onClick={() => setSort('delivered')}
              />
            </tr>
          </thead>
          <tbody>
            {(directory.data?.items ?? []).map((row, index) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t hover:bg-slate-50"
                onClick={() => setSelectedId(row.id)}
              >
                <td className="px-2 py-2">{(page - 1) * 25 + index + 1}</td>
                <td className="px-2 py-2 font-medium text-slate-900">
                  {row.name || 'Unknown recipient'}
                </td>
                <td className="px-2 py-2 text-slate-600">
                  <div>{row.email || '—'}</div>
                  <div>{row.rollNumber || row.staffCode || ''}</div>
                </td>
                <td className="px-2 py-2">{row.department || '—'}</td>
                <td className="px-2 py-2">{roleLabel(row.role)}</td>
                <td className="px-2 py-2">
                  <StatusBadge status={row.status} />
                  {row.failureReason ? (
                    <p className="mt-1 max-w-[180px] text-[11px] text-rose-600">
                      {row.failureReason}
                    </p>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-slate-500">{stamp(row.deliveredAt ?? row.sentAt)}</td>
              </tr>
            ))}
            {!directory.isLoading && !directory.data?.items.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                  No recipients match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Page {page} of {pages}
        </p>
        <div className="flex gap-2">
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
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecipientDetail({ row }: { row: CampaignRecipientRow }) {
  const photo = resolveUploadAssetUrl(row.photoPath);
  const rendered = row.renderedBody?.trim();
  const snapshot = plainMessage(row.campaignBodyText, row.campaignBodyHtml);
  const message = rendered || snapshot;
  const title = row.renderedTitle || row.campaignSubject || 'Notification';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {photo ? (
          <img src={photo} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-[#155EEF]">
            {(row.name || '?').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold text-slate-900">{row.name || 'Unknown recipient'}</p>
          <StatusBadge status={row.status} />
        </div>
      </div>
      <dl className="grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-2">
        <Fact label="Roll / Staff ID" value={row.rollNumber || row.staffCode || '—'} />
        <Fact label="Department" value={row.department || '—'} />
        <Fact label="Email" value={row.email || '—'} />
        <Fact label="Mobile" value={row.phone || '—'} />
        <Fact label="Role" value={roleLabel(row.role)} />
        <Fact label="Channel" value={channelLabel(row.channel)} />
        <Fact label="Sent" value={stamp(row.sentAt)} />
        <Fact label="Delivered" value={stamp(row.deliveredAt)} />
        {row.openedAt ? <Fact label="Opened" value={stamp(row.openedAt)} /> : null}
        {row.failureReason ? <Fact label="Failure reason" value={row.failureReason} /> : null}
      </dl>
      <article className="rounded-2xl border bg-[#F4F7FC] p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Message this person received
        </p>
        {row.inboxRemoved && !rendered ? (
          <p className="mt-2 text-xs text-slate-500">
            The inbox copy was removed when this campaign was revoked. The text below is the
            campaign snapshot that was sent.
          </p>
        ) : null}
        <p className="mt-2 font-semibold text-slate-900">{title}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {message ? linkify(message) : 'No stored message was found for this recipient.'}
        </p>
      </article>
    </div>
  );
}

function DrawerActions({
  campaign,
  canManage,
  filters,
  onNote,
  onError,
  onDone,
}: {
  campaign: CommunicationCampaign;
  canManage: boolean;
  filters: Record<string, string | undefined>;
  onNote: (value: string) => void;
  onError: (value: string) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null);
  const duplicate = useMutation({
    mutationFn: () => duplicateCommunicationCampaign(campaign.id),
    onSuccess: (copy) => {
      onError('');
      onNote(
        `Draft “${copy.name}” was created from the original message. The sent campaign was not changed.`,
      );
      onDone();
    },
    onError: (err) => onError(apiErrorMessage(err, 'Could not duplicate this campaign')),
  });
  const resend = useMutation({
    mutationFn: () => resendFailedCampaign(campaign.id),
    onSuccess: (result) => {
      onError('');
      onNote(
        `Queued a retry for ${result.queued.toLocaleString('en-IN')} failed deliveries. Recipients who already received it are unchanged.`,
      );
      onDone();
    },
    onError: (err) => onError(apiErrorMessage(err, 'Could not resend failed recipients')),
  });

  async function download(kind: 'excel' | 'pdf') {
    setBusy(kind);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
      );
      const blob =
        kind === 'excel'
          ? await downloadCampaignRecipients(campaign.id, params)
          : await downloadCampaignReport(campaign.id, params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = kind === 'excel' ? 'campaign-recipients.xlsx' : 'campaign-report.pdf';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      onError(apiErrorMessage(err, 'Could not download this file'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <footer className="flex shrink-0 flex-wrap gap-2 border-t bg-white px-4 py-3">
      <Button
        size="sm"
        variant="outline"
        disabled={busy === 'excel'}
        onClick={() => void download('excel')}
      >
        <Download className="mr-2 h-4 w-4" />
        Export Recipients (Excel)
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy === 'pdf'}
        onClick={() => void download('pdf')}
      >
        <FileText className="mr-2 h-4 w-4" />
        Download Campaign Report (PDF)
      </Button>
      {canManage && ['SENT', 'SENDING', 'FAILED'].includes(campaign.status) ? (
        <Button
          size="sm"
          variant="outline"
          disabled={resend.isPending}
          onClick={() => {
            if (
              !window.confirm(
                'Resend this campaign only to recipients whose delivery failed? People who already received it are left unchanged.',
              )
            )
              return;
            resend.mutate();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Resend Failed
        </Button>
      ) : null}
      {canManage ? (
        <Button
          size="sm"
          variant="outline"
          disabled={duplicate.isPending}
          onClick={() => {
            if (
              !window.confirm(
                'Create a new draft from this campaign’s original message? The sent campaign stays unchanged.',
              )
            )
              return;
            duplicate.mutate();
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Duplicate Campaign
        </Button>
      ) : null}
    </footer>
  );
}

function DeliveryCards({
  total,
  delivery,
  compact,
}: {
  total: number;
  delivery?: CommunicationCampaign['delivery'];
  compact?: boolean;
}) {
  const confirmed = delivery?.confirmed ?? 0;
  const accepted = delivery?.accepted ?? 0;
  const pending = delivery?.pending ?? 0;
  const failed = delivery?.failed ?? 0;
  const opened = delivery?.opened ?? 0;
  const share = (value: number) => (total ? Math.round((value / total) * 1000) / 10 : 0);
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4')}>
      <Meter
        icon={CheckCircle2}
        label="Delivered"
        value={confirmed}
        share={share(confirmed)}
        tone="bg-emerald-50 text-emerald-700"
        bar="bg-emerald-500"
      />
      {accepted > 0 ? (
        <Meter
          icon={CheckCircle2}
          label="Accepted"
          value={accepted}
          share={share(accepted)}
          tone="bg-blue-50 text-blue-700"
          bar="bg-[#155EEF]"
        />
      ) : null}
      <Meter
        icon={Clock}
        label="Pending"
        value={pending}
        share={share(pending)}
        tone="bg-amber-50 text-amber-700"
        bar="bg-amber-500"
      />
      <Meter
        icon={AlertTriangle}
        label="Failed"
        value={failed}
        share={share(failed)}
        tone="bg-rose-50 text-rose-700"
        bar="bg-rose-500"
      />
      {opened > 0 ? (
        <Meter
          icon={CheckCircle2}
          label="Opened"
          value={opened}
          share={share(opened)}
          tone="bg-violet-50 text-violet-700"
          bar="bg-violet-500"
        />
      ) : null}
    </div>
  );
}

function Meter({
  icon: Icon,
  label,
  value,
  share,
  tone,
  bar,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number;
  share: number;
  tone: string;
  bar: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">
        {value.toLocaleString('en-IN')}{' '}
        <span className="text-xs font-medium text-slate-500">{share}%</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${bar}`} style={{ width: `${Math.min(share, 100)}%` }} />
      </div>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={cn('text-slate-900', mono && 'break-all font-mono text-xs')}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label =
    status === 'ACCEPTED'
      ? 'Accepted'
      : status === 'SKIPPED'
        ? 'Cancelled'
        : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        STATUS_TONE[status] ?? 'bg-slate-100 text-slate-600',
      )}
    >
      {label}
    </span>
  );
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-2 py-2 font-medium">
      <button type="button" className={active ? 'text-[#155EEF]' : ''} onClick={onClick}>
        {label}
      </button>
    </th>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

function stamp(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function plainMessage(bodyText?: string | null, bodyHtml?: string | null) {
  if (bodyText?.trim()) return bodyText.trim();
  return (bodyHtml ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function hasRichFormatting(html?: string | null) {
  return Boolean(html && /<(strong|b|em|i|u|a|img|ul|ol|h[1-3])\b/i.test(html));
}

function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="text-[#155EEF] underline"
      >
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function channelLabel(value?: string | null) {
  if (!value) return '—';
  if (value === 'PUSH') return 'Push Notification';
  if (value === 'IN_APP') return 'In-app';
  if (value === 'EMAIL') return 'Email';
  if (value === 'SMS') return 'SMS';
  if (value === 'WHATSAPP') return 'WhatsApp';
  return value;
}

function roleLabel(value: string) {
  if (value === 'STUDENT') return 'Student';
  if (['FACULTY', 'STAFF', 'TEACHING_STAFF', 'NON_TEACHING_STAFF'].includes(value)) return 'Staff';
  if (value === 'PARENT') return 'Parent';
  return value.replace(/_/g, ' ');
}

function typeLabel(campaign: CommunicationCampaign) {
  const source = `${campaign.template?.code ?? ''} ${campaign.name}`.toUpperCase();
  const kind =
    source.includes('SECURITY') || source.includes('PASSWORD') || source.includes('DEVICE')
      ? 'Security'
      : source.includes('EVENT')
        ? 'Events'
        : 'Notice';
  const automated = Boolean((campaign.metadata as Record<string, unknown> | undefined)?.trigger);
  return automated ? `${kind} · Automated` : `${kind} · Manual`;
}
