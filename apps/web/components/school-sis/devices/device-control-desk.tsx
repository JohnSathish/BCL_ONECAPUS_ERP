'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canSchoolDevice } from '@/lib/school-sis/permissions';
import {
  DEVICE_REASONS,
  fetchSchoolDeviceLogs,
  fetchSchoolDevices,
  fetchSchoolDevicesOverview,
  schoolDeviceAction,
  schoolDeviceBulk,
} from '@/services/school-devices';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Wifi,
} from 'lucide-react';

type TabId =
  | 'overview'
  | 'all'
  | 'active'
  | 'inactive'
  | 'revoked'
  | 'flagged'
  | 'sessions'
  | 'activity'
  | 'logs';

const TABS: {
  id: TabId;
  label: string;
  status?: string;
  session?: string;
  lastActive?: string;
}[] = [
  { id: 'overview', label: 'Device Overview' },
  { id: 'all', label: 'All Devices' },
  { id: 'active', label: 'Active Devices', status: 'active' },
  { id: 'inactive', label: 'Inactive Devices', status: 'inactive' },
  { id: 'revoked', label: 'Revoked Devices', status: 'revoked' },
  { id: 'flagged', label: 'Suspicious / Flagged', status: 'flagged' },
  { id: 'sessions', label: 'Device Sessions', session: 'online' },
  { id: 'activity', label: 'Device Activity', lastActive: 'today' },
  { id: 'logs', label: 'Security Logs' },
];

function str(v: unknown) {
  return v == null ? '' : String(v);
}

function fmt(v: unknown) {
  if (!v) return '—';
  try {
    return new Date(String(v)).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(v);
  }
}

function relative(v: unknown) {
  if (!v) return '';
  const t = new Date(String(v)).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 3) return 'Now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase();
}

function pct(part: number, whole: number) {
  if (!whole) return null;
  return `${Math.round((part / whole) * 100)}%`;
}

function regionOf(timezone?: string) {
  if (!timezone) return null;
  if (/kolkata|calcutta|asia\/kolkata/i.test(timezone)) return 'India';
  return timezone.replace('_', ' ');
}

function AndroidMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M17.6 9.48 19.2 6.7a.5.5 0 0 0-.86-.5l-1.55 2.7A7.4 7.4 0 0 0 12 7.5a7.4 7.4 0 0 0-4.79 1.4L5.66 6.2a.5.5 0 0 0-.86.5l1.6 2.78A7.2 7.2 0 0 0 4.5 15v.5h15V15a7.2 7.2 0 0 0-1.9-5.52ZM9 13.2a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm6 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"
      />
    </svg>
  );
}

function phoneTone(model: string, manufacturer: string) {
  const hay = `${manufacturer} ${model}`.toLowerCase();
  if (hay.includes('iphone') || hay.includes('apple')) return 'bg-slate-800';
  if (hay.includes('samsung') || hay.includes('galaxy')) return 'bg-sky-700';
  if (hay.includes('redmi') || hay.includes('xiaomi')) return 'bg-orange-500';
  return 'bg-indigo-600';
}

export function DeviceControlDesk() {
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const perms = useAuthStore((s) => s.session?.user.permissions);
  const canRevoke = canSchoolDevice(perms, 'devices.revoke');
  const canSignOut = canSchoolDevice(perms, 'devices.signout');
  const canBlock = canSchoolDevice(perms, 'devices.block');
  const canExport = canSchoolDevice(perms, 'devices.export');
  const canLogs = canSchoolDevice(perms, 'devices.security_logs');

  const [tab, setTab] = useState<TabId>('overview');
  const [search, setSearch] = useState('');
  const [persona, setPersona] = useState('');
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [session, setSession] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [lastActive, setLastActive] = useState('');
  const [security, setSecurity] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [confirm, setConfirm] = useState<{
    ids: string[];
    action: 'revoke' | 'signout' | 'block';
    name?: string;
  } | null>(null);
  const [reason, setReason] = useState(DEVICE_REASONS[0]);
  const [other, setOther] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);

  const tabMeta = TABS.find((t) => t.id === tab);
  const effectiveStatus = status || (tabMeta && 'status' in tabMeta ? tabMeta.status : '') || '';
  const effectiveSession = session || (tab === 'sessions' ? 'online' : '') || '';
  const effectiveLast = lastActive || (tab === 'activity' ? 'today' : '');

  const overviewQ = useQuery({
    queryKey: ['school-devices-overview'],
    queryFn: fetchSchoolDevicesOverview,
    enabled: ready,
  });
  const listQ = useQuery({
    queryKey: [
      'school-devices',
      search,
      persona,
      platform,
      effectiveStatus,
      effectiveSession,
      appVersion,
      effectiveLast,
      security,
      page,
      limit,
    ],
    queryFn: () =>
      fetchSchoolDevices({
        search: search || undefined,
        persona: persona || undefined,
        platform: platform || undefined,
        status: effectiveStatus || undefined,
        session: effectiveSession || undefined,
        appVersion: appVersion || undefined,
        lastActive: effectiveLast || undefined,
        security: security || undefined,
        page,
        limit,
      }),
    enabled: ready && tab !== 'logs',
  });
  const logsQ = useQuery({
    queryKey: ['school-device-logs', search, page],
    queryFn: () => fetchSchoolDeviceLogs({ search: search || undefined, page }),
    enabled: ready && tab === 'logs' && canLogs,
  });

  const mutate = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      const why = reason === 'Other' ? other || 'Other' : reason;
      if (confirm.ids.length === 1) {
        const action =
          confirm.action === 'signout'
            ? 'sign-out'
            : confirm.action === 'revoke'
              ? 'revoke'
              : 'block';
        await schoolDeviceAction(confirm.ids[0], action, why);
      } else {
        await schoolDeviceBulk(confirm.ids, confirm.action, why);
      }
    },
    onSuccess: () => {
      setConfirm(null);
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ['school-devices'] });
      void qc.invalidateQueries({ queryKey: ['school-devices-overview'] });
    },
  });

  const overview = (overviewQ.data ?? {}) as Record<string, number>;
  const items = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;
  const versions = listQ.data?.appVersions ?? [];
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);

  const cards = useMemo(
    () => [
      {
        key: 'all',
        label: 'Total Registered Devices',
        value: overview.total ?? 0,
        hint: 'All time registrations',
        pct: null as string | null,
        icon: Smartphone,
        wrap: 'bg-sky-50',
        iconWrap: 'bg-sky-100 text-sky-700',
        on: () => {
          setTab('all');
          setStatus('');
          setPage(1);
        },
      },
      {
        key: 'active',
        label: 'Active Devices',
        value: overview.active ?? 0,
        hint: 'Currently active',
        pct: pct(overview.active ?? 0, overview.total ?? 0),
        icon: Wifi,
        wrap: 'bg-emerald-50',
        iconWrap: 'bg-emerald-100 text-emerald-700',
        on: () => {
          setTab('active');
          setStatus('active');
          setPage(1);
        },
      },
      {
        key: 'online',
        label: 'Online / Recently Active',
        value: overview.online ?? 0,
        hint: 'Active in last 24 hours',
        pct: null,
        icon: Radio,
        wrap: 'bg-violet-50',
        iconWrap: 'bg-violet-100 text-violet-700',
        on: () => {
          setTab('sessions');
          setSession('online');
          setPage(1);
        },
      },
      {
        key: 'inactive',
        label: 'Inactive Devices',
        value: overview.inactive ?? 0,
        hint: 'No recent activity',
        pct: null,
        icon: Clock3,
        wrap: 'bg-slate-50',
        iconWrap: 'bg-slate-200 text-slate-600',
        on: () => {
          setTab('inactive');
          setStatus('inactive');
          setPage(1);
        },
      },
      {
        key: 'revoked',
        label: 'Revoked Devices',
        value: overview.revoked ?? 0,
        hint: 'Access revoked',
        pct: null,
        icon: Ban,
        wrap: 'bg-rose-50',
        iconWrap: 'bg-rose-100 text-rose-700',
        on: () => {
          setTab('revoked');
          setStatus('revoked');
          setPage(1);
        },
      },
      {
        key: 'android',
        label: 'Android Devices',
        value: overview.android ?? 0,
        hint: 'Android users',
        pct: pct(overview.android ?? 0, overview.total ?? 0),
        icon: Smartphone,
        wrap: 'bg-emerald-50',
        iconWrap: 'bg-emerald-100 text-emerald-700',
        android: true,
        on: () => {
          setTab('all');
          setPlatform('android');
          setPage(1);
        },
      },
      {
        key: 'ios',
        label: 'iOS Devices',
        value: overview.ios ?? 0,
        hint: 'iOS users',
        pct: pct(overview.ios ?? 0, overview.total ?? 0),
        icon: Smartphone,
        wrap: 'bg-slate-100',
        iconWrap: 'bg-slate-200 text-slate-700',
        on: () => {
          setTab('all');
          setPlatform('ios');
          setPage(1);
        },
      },
      {
        key: 'failed',
        label: 'Failed Authentication',
        value: overview.failedAuth ?? 0,
        hint: 'Login failures',
        pct: null,
        icon: ShieldAlert,
        wrap: 'bg-orange-50',
        iconWrap: 'bg-orange-100 text-orange-700',
        on: () => {
          setTab('flagged');
          setSecurity('failed');
          setPage(1);
        },
      },
    ],
    [overview],
  );

  function clearFilters() {
    setSearch('');
    setPersona('');
    setPlatform('');
    setStatus('');
    setSession('');
    setAppVersion('');
    setLastActive('');
    setSecurity('');
    setPage(1);
  }

  function exportCsv() {
    const rows = items;
    const header = [
      'User name',
      'User type',
      'Admission/Employee ID',
      'Device model',
      'Platform',
      'App version',
      'Status',
      'Last active',
      'Push status',
      ...(canSchoolDevice(perms, 'devices.view_ip') ? ['IP'] : []),
    ];
    const lines = [
      header.join(','),
      ...rows.map((r) =>
        [
          str(r.userName),
          str(r.persona),
          str(r.identifier),
          str(r.deviceModel),
          str(r.platform),
          str(r.appVersion),
          str(r.deviceStatus),
          str(r.lastActiveAt),
          r.pushEnabled ? 'Enabled' : 'Disabled',
          ...(canSchoolDevice(perms, 'devices.view_ip') ? [str(r.lastIpAddress)] : []),
        ]
          .map((c) => `"${c.replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'st-lukes-devices.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectClass =
    'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400';

  return (
    <div className="min-h-full space-y-5 bg-[#f3f7fc] p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">
              Users & Access
            </p>
            <h1 className="text-2xl font-bold text-slate-900">Device Control</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Monitor and manage St. Luke’s mobile app sessions. Administrators control
              authentication — not the physical device.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport ? (
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void qc.invalidateQueries({ queryKey: ['school-devices'] });
              void qc.invalidateQueries({ queryKey: ['school-devices-overview'] });
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0b3a6e] px-3 text-sm font-semibold text-white shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Last updated:{' '}
            {overviewQ.dataUpdatedAt
              ? new Date(overviewQ.dataUpdatedAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })
              : '—'}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.on}
            className={cn(
              'flex items-start gap-3 rounded-2xl border border-white p-4 text-left shadow-sm shadow-sky-100/70',
              c.wrap,
            )}
          >
            <span
              className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', c.iconWrap)}
            >
              {'android' in c && c.android ? (
                <AndroidMark className="h-6 w-6" />
              ) : (
                <c.icon className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-2xl font-bold text-slate-900">{c.value}</span>
                {c.pct ? (
                  <span className="text-sm font-semibold text-emerald-600">{c.pct}</span>
                ) : null}
              </span>
              <span className="block text-sm font-semibold text-slate-700">{c.label}</span>
              <span className="block text-xs text-slate-500">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold',
              tab === t.id
                ? 'bg-[#0b3a6e] text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-sm shadow-sky-100/80">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, admission no, username, mobile, device model, device ID, IP address..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600"
            >
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown className={cn('h-4 w-4 transition', filtersOpen && 'rotate-180')} />
            </button>
          </div>

          {filtersOpen ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              {[
                [
                  'User Type',
                  persona,
                  setPersona,
                  [
                    ['', 'All'],
                    ['student', 'Student'],
                    ['parent', 'Parent'],
                    ['teacher', 'Teacher'],
                    ['staff', 'Staff'],
                    ['admin', 'Admin'],
                  ],
                ],
                [
                  'Platform',
                  platform,
                  setPlatform,
                  [
                    ['', 'All'],
                    ['android', 'Android'],
                    ['ios', 'iOS'],
                  ],
                ],
                [
                  'Device Status',
                  status,
                  setStatus,
                  [
                    ['', 'All'],
                    ['active', 'Active'],
                    ['inactive', 'Inactive'],
                    ['revoked', 'Revoked'],
                    ['blocked', 'Blocked'],
                    ['signed_out', 'Signed Out'],
                  ],
                ],
                [
                  'Session Status',
                  session,
                  setSession,
                  [
                    ['', 'All'],
                    ['online', 'Online'],
                    ['recent', 'Recently Active'],
                    ['expired', 'Expired'],
                    ['logged_out', 'Logged Out'],
                  ],
                ],
              ].map(([label, value, set, opts]) => (
                <label key={String(label)} className="text-xs font-semibold text-slate-500">
                  {label}
                  <select
                    value={String(value)}
                    onChange={(e) => {
                      (set as (v: string) => void)(e.target.value);
                      setPage(1);
                    }}
                    className={cn(selectClass, 'mt-1')}
                  >
                    {(opts as string[][]).map(([v, l]) => (
                      <option key={v || 'all'} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="text-xs font-semibold text-slate-500">
                App Version
                <select
                  value={appVersion}
                  onChange={(e) => {
                    setAppVersion(e.target.value);
                    setPage(1);
                  }}
                  className={cn(selectClass, 'mt-1')}
                >
                  <option value="">All</option>
                  {versions.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Last Active
                <select
                  value={lastActive}
                  onChange={(e) => {
                    setLastActive(e.target.value);
                    setPage(1);
                  }}
                  className={cn(selectClass, 'mt-1')}
                >
                  <option value="">All time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="30d_plus">More than 30 days</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Security
                <select
                  value={security}
                  onChange={(e) => {
                    setSecurity(e.target.value);
                    setPage(1);
                  }}
                  className={cn(selectClass, 'mt-1')}
                >
                  <option value="">All</option>
                  <option value="failed">Multiple Failed Login</option>
                  <option value="multi">Multiple Devices</option>
                  <option value="flagged">Flagged</option>
                </select>
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-semibold text-sky-700 hover:underline"
              >
                Clear Filters
              </button>
              {canExport ? (
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              ) : null}
              {selected.length ? (
                <>
                  {canSignOut ? (
                    <button
                      type="button"
                      onClick={() => setConfirm({ ids: selected, action: 'signout' })}
                      className="rounded-lg border px-3 py-1.5 text-sm"
                    >
                      Sign Out Selected
                    </button>
                  ) : null}
                  {canRevoke ? (
                    <button
                      type="button"
                      onClick={() => setConfirm({ ids: selected, action: 'revoke' })}
                      className="rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white"
                    >
                      Revoke Selected
                    </button>
                  ) : null}
                  {canBlock ? (
                    <button
                      type="button"
                      onClick={() => setConfirm({ ids: selected, action: 'block' })}
                      className="rounded-lg border px-3 py-1.5 text-sm"
                    >
                      Block Selected
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>
                {total} device{total === 1 ? '' : 's'} found
              </span>
              <label className="flex items-center gap-1">
                Rows per page
                <select
                  className="h-8 rounded-lg border border-slate-200 px-1"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {tab === 'logs' ? (
          !logsQ.data?.items?.length ? (
            <p className="p-8 text-center text-slate-500">No security events yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Event</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {logsQ.data.items.map((row) => (
                  <tr key={str(row.id)} className="border-t">
                    <td className="p-3 whitespace-nowrap">{fmt(row.createdAt)}</td>
                    <td className="p-3">{str(row.eventType)}</td>
                    <td className="p-3">{str(row.description)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : !items.length ? (
          <p className="p-10 text-center text-slate-500">
            {search || status || platform
              ? 'No devices found. Try changing your search or filters.'
              : 'No devices registered yet. Devices will appear here when users sign in to the St. Luke’s mobile application.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/90 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="p-3">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selected.length === items.length}
                      onChange={(e) =>
                        setSelected(e.target.checked ? items.map((r) => str(r.id)) : [])
                      }
                    />
                  </th>
                  {[
                    'User',
                    'Admission / Employee ID',
                    'Device',
                    'Platform',
                    'App',
                    'IP Address',
                    'Last Active',
                    'Session',
                    'FCM',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const id = str(row.id);
                  const name = str(row.userName);
                  const model = str(row.deviceModel);
                  const maker = str(row.manufacturer);
                  const sess = str(row.session);
                  const st = str(row.deviceStatus).toUpperCase();
                  const plat = str(row.platform).toLowerCase();
                  const ip = str(row.lastIpAddress);
                  const place = regionOf(str(row.timezone));
                  return (
                    <tr
                      key={id}
                      className="border-t border-slate-100 align-middle hover:bg-slate-50/70"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(id)}
                          onChange={(e) =>
                            setSelected((cur) =>
                              e.target.checked ? [...cur, id] : cur.filter((x) => x !== id),
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#123a6b] text-[11px] font-bold text-white">
                            {initials(name)}
                          </span>
                          <span>
                            <span className="block font-bold uppercase tracking-wide text-slate-800">
                              {name}
                            </span>
                            <span className="capitalize text-xs text-slate-500">
                              {str(row.persona)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-700">
                        {str(row.identifier) || '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'flex h-9 w-7 items-center justify-center rounded-md text-white shadow-sm',
                              phoneTone(model, maker),
                            )}
                          >
                            <Smartphone className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block font-semibold text-slate-800">
                              {model || '—'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {maker || str(row.deviceLabel)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                          {plat === 'ios' ? (
                            <span className="text-slate-500"></span>
                          ) : (
                            <AndroidMark className="h-4 w-4 text-emerald-600" />
                          )}
                          <span className="capitalize">{plat || '—'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{str(row.appVersion) || '—'}</td>
                      <td className="px-3 py-3">
                        {ip ? (
                          <span>
                            <span className="block font-medium text-slate-700">{ip}</span>
                            {place ? (
                              <span className="text-xs text-slate-500">🇮🇳 {place}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-slate-400">— Unknown</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="block text-slate-700">{fmt(row.lastActiveAt)}</span>
                        <span className="text-xs text-slate-400">{relative(row.lastActiveAt)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            sess === 'online'
                              ? 'bg-emerald-50 text-emerald-700'
                              : sess === 'recent'
                                ? 'bg-lime-50 text-lime-700'
                                : sess === 'expired'
                                  ? 'bg-orange-50 text-orange-700'
                                  : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {sess === 'online'
                            ? 'Online'
                            : sess === 'recent'
                              ? 'Recently Active'
                              : sess === 'expired'
                                ? 'Expired'
                                : sess.replaceAll('_', ' ') || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs font-semibold',
                            row.pushEnabled ? 'text-emerald-700' : 'text-rose-600',
                          )}
                        >
                          {row.pushEnabled ? '● Enabled' : '⊘ Disabled'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              st === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400',
                            )}
                          />
                          {st === 'ACTIVE' ? 'Active' : st.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap px-3 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/admin/school-sis/device-control/${id}`}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                          {canRevoke ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              onClick={() =>
                                setConfirm({
                                  ids: [id],
                                  action: 'revoke',
                                  name: `${model} · ${name}`,
                                })
                              }
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Revoke
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                            onClick={() => setMenuId(menuId === id ? null : id)}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                        {menuId === id ? (
                          <div className="absolute right-3 z-10 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
                            <Link
                              className="block px-3 py-1.5 hover:bg-slate-50"
                              href={`/admin/school-sis/device-control/${id}`}
                            >
                              View Device Details
                            </Link>
                            {canSignOut ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                                onClick={() =>
                                  setConfirm({
                                    ids: [id],
                                    action: 'signout',
                                    name,
                                  })
                                }
                              >
                                Sign Out
                              </button>
                            ) : null}
                            {canBlock ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                                onClick={() =>
                                  setConfirm({
                                    ids: [id],
                                    action: 'block',
                                    name,
                                  })
                                }
                              >
                                Block Device
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                              onClick={() => {
                                void navigator.clipboard.writeText(str(row.installationId));
                                setMenuId(null);
                              }}
                            >
                              Copy Device ID
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab !== 'logs' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <p>
              Showing {from} to {to} of {total} devices
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    'h-8 w-8 rounded-lg text-sm font-semibold',
                    n === page ? 'bg-[#0b3a6e] text-white' : 'hover:bg-slate-100',
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.action === 'revoke'
                ? 'Revoke this device?'
                : confirm?.action === 'block'
                  ? 'Block this device?'
                  : 'Sign out this device?'}
            </DialogTitle>
            <DialogDescription>
              {confirm?.action === 'revoke'
                ? "This will immediately invalidate the device's active application session. The user will need to authenticate again before using the app."
                : confirm?.action === 'block'
                  ? 'A blocked device cannot create a new authenticated session until an administrator unblocks it.'
                  : 'The current session will end. The device remains registered and the user may sign in again.'}
              {confirm?.ids.length && confirm.ids.length > 1
                ? ` ${confirm.ids.length} devices selected.`
                : null}
              {confirm?.name ? ` ${confirm.name}` : null}
            </DialogDescription>
          </DialogHeader>
          <label className="text-sm">
            Reason
            <select
              className="mt-1 w-full rounded-lg border px-2 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof DEVICE_REASONS)[number])}
            >
              {DEVICE_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          {reason === 'Other' ? (
            <input
              className="rounded-lg border px-2 py-2 text-sm"
              placeholder="Short explanation"
              value={other}
              onChange={(e) => setOther(e.target.value)}
            />
          ) : null}
          {mutate.isError ? (
            <p className="text-sm text-red-700">{apiErrorMessage(mutate.error)}</p>
          ) : null}
          <DialogFooter>
            <button
              type="button"
              className="rounded-lg border px-3 py-2"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-700 px-3 py-2 text-white"
              onClick={() => mutate.mutate()}
              disabled={mutate.isPending}
            >
              {confirm?.action === 'revoke'
                ? 'Revoke Device'
                : confirm?.action === 'block'
                  ? 'Block Device'
                  : 'Sign Out'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
