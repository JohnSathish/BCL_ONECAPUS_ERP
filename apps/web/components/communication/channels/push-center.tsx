'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, GraduationCap, Send, Smartphone, Users } from 'lucide-react';

import {
  confirmRevokeCampaign,
  NotificationHistoryAdmin,
} from '@/components/communication/notifications/notification-history-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  fetchCommunicationCampaigns,
  fetchCommunicationDashboard,
  fetchNotificationHistorySummary,
  revokeCommunicationCampaign,
} from '@/services/communication';
import type { CommunicationCampaign } from '@/types/communication';
import { apiErrorMessage } from '@/utils/api-error';

const TABS = [
  'All',
  'Security',
  'System',
  'Academic',
  'Administration',
  'Events',
  'Others',
] as const;
const PAGE_SIZE = 50;

function monthStart() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function campaignKind(row: CommunicationCampaign) {
  const code = `${row.template?.code ?? ''} ${row.name}`.toUpperCase();
  if (code.includes('SECURITY') || code.includes('PASSWORD') || code.includes('DEVICE'))
    return 'Security';
  if (code.includes('SYSTEM')) return 'System';
  if (
    code.includes('EXAM') ||
    code.includes('FEE') ||
    code.includes('ATTEND') ||
    code.includes('RESULT') ||
    code.includes('ADMISSION')
  )
    return 'Academic';
  if (code.includes('ADMIN')) return 'Administration';
  if (code.includes('EVENT')) return 'Events';
  return 'Others';
}

function audienceLabel(value: string) {
  if (value === 'STUDENTS') return 'Students';
  if (value === 'FACULTY') return 'Staff';
  if (value === 'PARENTS') return 'Parents';
  if (value === 'ALL') return 'Everyone';
  if (value === 'INDIVIDUAL') return 'One person';
  return value.replace(/_/g, ' ');
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

export function PushCenterPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>('All');
  const [draft, setDraft] = useState({
    search: '',
    status: '',
    from: monthStart(),
    to: todayKey(),
  });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');

  const summary = useQuery({
    queryKey: ['communication', 'notification-history-summary'],
    queryFn: fetchNotificationHistorySummary,
    enabled,
  });
  const dashboard = useQuery({
    queryKey: ['communication', 'dashboard'],
    queryFn: fetchCommunicationDashboard,
    enabled,
  });
  const campaigns = useQuery({
    queryKey: ['communication', 'campaigns'],
    queryFn: () => fetchCommunicationCampaigns(),
    enabled,
  });
  const revoke = useMutation({
    mutationFn: revokeCommunicationCampaign,
    onSuccess: (result) => {
      setMessage(
        `Revoked. Removed ${result.removedNotifications.toLocaleString('en-IN')} notification${result.removedNotifications === 1 ? '' : 's'} from app lists.`,
      );
      void qc.invalidateQueries({ queryKey: ['communication'] });
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  const rows = useMemo(() => {
    const from = applied.from ? new Date(`${applied.from}T00:00:00`) : null;
    const to = applied.to ? new Date(`${applied.to}T23:59:59`) : null;
    const search = applied.search.trim().toLowerCase();
    return (campaigns.data ?? []).filter((row) => {
      const stamp = new Date(row.sentAt ?? row.createdAt);
      if (from && stamp < from) return false;
      if (to && stamp > to) return false;
      if (applied.status && row.status !== applied.status) return false;
      if (tab !== 'All' && campaignKind(row) !== tab) return false;
      if (!search) return true;
      return (
        row.name.toLowerCase().includes(search) ||
        row.id.toLowerCase().includes(search) ||
        (row.template?.code ?? '').toLowerCase().includes(search)
      );
    });
  }, [campaigns.data, applied, tab]);
  const visible = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const push = dashboard.data?.channelHealth?.push;

  function exportCsv() {
    const header = ['Message', 'Type', 'Recipients', 'Status', 'Sent at', 'Campaign ID'];
    const body = rows.map((row) => [
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
    link.download = 'push-campaigns.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Communication Center</h1>
          <p className="text-sm text-slate-500">
            Manage and send push notifications to students, staff and other users
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/communication/compose?channel=PUSH">
            <Send className="mr-2 h-4 w-4" />
            Send Push Notification
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          icon={Users}
          label="Student notices"
          value={summary.data?.students}
          hint="Stored in student app lists"
          tone="bg-blue-50 text-blue-700"
        />
        <Stat
          icon={GraduationCap}
          label="Staff notices"
          value={summary.data?.staff}
          hint="Stored in staff app lists"
          tone="bg-emerald-50 text-emerald-700"
        />
        <Stat
          icon={Bell}
          label="Everyone"
          value={summary.data?.all}
          hint="All stored in-app notices"
          tone="bg-violet-50 text-violet-700"
        />
        <Stat
          icon={Send}
          label="Delivered this month"
          value={dashboard.data?.messagesSentThisMonth}
          hint="Successful deliveries, all channels"
          tone="bg-amber-50 text-amber-700"
        />
        <Stat
          icon={Smartphone}
          label="Push devices"
          value={push?.activeDevices}
          hint={
            push?.connected
              ? 'Firebase is connected'
              : push?.demoMode
                ? 'Demo mode'
                : 'Firebase is not configured'
          }
          tone="bg-rose-50 text-rose-700"
        />
      </div>

      <NotificationHistoryAdmin />
      {message ? (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${tab === item ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                onClick={() => {
                  setTab(item);
                  setPage(0);
                }}
              >
                {item === 'All'
                  ? 'All Notifications'
                  : item === 'Security'
                    ? 'Security Alerts'
                    : item === 'System'
                      ? 'System Notices'
                      : item}
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
            placeholder="Search by message, campaign ID, or type"
            value={draft.search}
            onChange={(event) => setDraft({ ...draft, search: event.target.value })}
          />
          <select
            className="rounded-md border bg-background px-2 text-sm"
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value })}
            aria-label="Status"
          >
            <option value="">All Status</option>
            {['SENT', 'SENDING', 'FAILED', 'REVOKED', 'SCHEDULED', 'DRAFT'].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
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
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setApplied(draft);
                setPage(0);
              }}
            >
              Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = { search: '', status: '', from: monthStart(), to: todayKey() };
                setDraft(next);
                setApplied(next);
                setPage(0);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-2 text-sm">
          <p className="font-medium">Recent notifications</p>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            Export
          </Button>
        </div>
        <p className="px-4 pb-2 text-xs text-slate-500">
          Showing {visible.length} of {rows.length} campaigns
          {push?.deliveryRate != null
            ? ` · ${push.deliveryRate}% of recorded push deliveries succeeded`
            : ''}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {['#', 'Message', 'Type', 'Recipients', 'Status', 'Sent at', 'Actions'].map(
                  (header) => (
                    <th key={header} className="px-3 py-2 font-medium">
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{page * PAGE_SIZE + index + 1}</td>
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
                  </td>
                  <td className="px-3 py-2">
                    {audienceLabel(row.audienceType)}
                    {row._count?.notifications != null
                      ? ` · ${row._count.notifications.toLocaleString('en-IN')}`
                      : ''}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${row.status === 'FAILED' ? 'bg-rose-50 text-rose-700' : row.status === 'REVOKED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{when(row.sentAt ?? row.createdAt)}</td>
                  <td className="px-3 py-2">
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
                    ) : (
                      <span className="text-xs text-slate-400">
                        {row.status === 'REVOKED' ? 'Revoked' : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    {campaigns.isLoading
                      ? 'Loading campaigns…'
                      : 'No campaigns match these filters.'}
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
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(page + 1) * PAGE_SIZE >= rows.length}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value?: number;
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
      </p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
