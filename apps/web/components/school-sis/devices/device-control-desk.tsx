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
    return new Date(String(v)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch {
    return String(v);
  }
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
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
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

  const cards = useMemo(
    () => [
      {
        key: 'all',
        label: 'Total Registered Devices',
        value: overview.total,
        on: () => {
          setTab('all');
          setStatus('');
          setPage(1);
        },
      },
      {
        key: 'active',
        label: 'Active Devices',
        value: overview.active,
        on: () => {
          setTab('active');
          setStatus('active');
          setPage(1);
        },
      },
      {
        key: 'online',
        label: 'Online / Recently Active',
        value: overview.online,
        on: () => {
          setTab('sessions');
          setSession('online');
          setPage(1);
        },
      },
      {
        key: 'inactive',
        label: 'Inactive Devices',
        value: overview.inactive,
        on: () => {
          setTab('inactive');
          setStatus('inactive');
          setPage(1);
        },
      },
      {
        key: 'revoked',
        label: 'Revoked Devices',
        value: overview.revoked,
        on: () => {
          setTab('revoked');
          setStatus('revoked');
          setPage(1);
        },
      },
      {
        key: 'android',
        label: 'Android Devices',
        value: overview.android,
        on: () => {
          setTab('all');
          setPlatform('android');
          setPage(1);
        },
      },
      {
        key: 'ios',
        label: 'iOS Devices',
        value: overview.ios,
        on: () => {
          setTab('all');
          setPlatform('ios');
          setPage(1);
        },
      },
      {
        key: 'failed',
        label: 'Failed Authentication',
        value: overview.failedAuth,
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

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Users & Access
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">Device Control</h1>
        <p className="text-sm text-slate-600">
          Monitor St. Luke’s mobile app sessions. Administrators control authentication—not the
          physical device. Tokens and secrets are never shown.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.on}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-navy-700"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {c.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{c.value ?? '—'}</div>
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
              'rounded-full px-3 py-1.5 text-sm font-medium',
              tab === t.id ? 'bg-[#0b3a6e] text-white' : 'bg-slate-100 text-slate-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name, admission no., username, mobile, device model, device ID, IP…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="grid gap-2 md:grid-cols-4 lg:grid-cols-7">
          <select
            value={persona}
            onChange={(e) => {
              setPersona(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border px-2 py-2 text-sm"
          >
            <option value="">User Type: All</option>
            {['student', 'parent', 'teacher', 'staff', 'accountant', 'librarian', 'admin'].map(
              (p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ),
            )}
          </select>
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border px-2 py-2 text-sm"
          >
            <option value="">Platform: All</option>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border px-2 py-2 text-sm"
          >
            <option value="">Device Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="revoked">Revoked</option>
            <option value="blocked">Blocked</option>
            <option value="signed_out">Signed Out</option>
          </select>
          <select
            value={session}
            onChange={(e) => {
              setSession(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border px-2 py-2 text-sm"
          >
            <option value="">Session Status</option>
            <option value="online">Online</option>
            <option value="recent">Recently Active</option>
            <option value="expired">Expired</option>
            <option value="logged_out">Logged Out</option>
          </select>
          <select
            value={appVersion}
            onChange={(e) => {
              setAppVersion(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border px-2 py-2 text-sm"
          >
            <option value="">App Version</option>
            {versions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select
            value={lastActive}
            onChange={(e) => {
              setLastActive(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border px-2 py-2 text-sm"
          >
            <option value="">Last Active</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="30d_plus">More than 30 days</option>
          </select>
          <select
            value={security}
            onChange={(e) => {
              setSecurity(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border px-2 py-2 text-sm"
          >
            <option value="">Security</option>
            <option value="failed">Multiple Failed Login</option>
            <option value="multi">Multiple Devices</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            Clear Filters
          </button>
          {canExport ? (
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
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
      </div>

      {tab === 'logs' ? (
        <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
          {!logsQ.data?.items?.length ? (
            <p className="p-8 text-center text-slate-500">No security events yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
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
          )}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
          {!items.length ? (
            <p className="p-10 text-center text-slate-500">
              {search || status || platform
                ? 'No devices found. Try changing your search or filters.'
                : 'No devices registered yet. Devices will appear here when users sign in to the St. Luke’s mobile application.'}
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
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
                  <th className="p-3">User</th>
                  <th className="p-3">Admission / Employee ID</th>
                  <th className="p-3">Device</th>
                  <th className="p-3">Platform</th>
                  <th className="p-3">App</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Last Active</th>
                  <th className="p-3">Session</th>
                  <th className="p-3">FCM</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const id = str(row.id);
                  return (
                    <tr key={id} className="border-t align-top">
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
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{str(row.userName)}</div>
                        <div className="capitalize text-slate-500">{str(row.persona)}</div>
                      </td>
                      <td className="p-3">{str(row.identifier) || '—'}</td>
                      <td className="p-3">
                        {[str(row.manufacturer), str(row.deviceModel)].filter(Boolean).join(' ') ||
                          str(row.deviceLabel) ||
                          '—'}
                      </td>
                      <td className="p-3 capitalize">{str(row.platform)}</td>
                      <td className="p-3">{str(row.appVersion) || '—'}</td>
                      <td className="p-3">{str(row.lastIpAddress) || '—'}</td>
                      <td className="p-3 whitespace-nowrap">{fmt(row.lastActiveAt)}</td>
                      <td className="p-3 capitalize">{str(row.session)}</td>
                      <td className="p-3">{row.pushEnabled ? 'Enabled' : 'Disabled'}</td>
                      <td className="p-3">{str(row.deviceStatus)}</td>
                      <td className="p-3 relative whitespace-nowrap">
                        <Link
                          className="text-[#0b3a6e] font-medium mr-2"
                          href={`/admin/school-sis/device-control/${id}`}
                        >
                          View
                        </Link>
                        {canRevoke ? (
                          <button
                            type="button"
                            className="text-red-700 font-medium mr-2"
                            onClick={() =>
                              setConfirm({
                                ids: [id],
                                action: 'revoke',
                                name: `${str(row.deviceModel)} · ${str(row.userName)}`,
                              })
                            }
                          >
                            Revoke
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="px-1"
                          onClick={() => setMenuId(menuId === id ? null : id)}
                        >
                          ⋮
                        </button>
                        {menuId === id ? (
                          <div className="absolute right-2 z-10 mt-1 w-48 rounded-xl border bg-white p-1 shadow-lg">
                            <Link
                              className="block rounded-lg px-3 py-1.5 hover:bg-slate-50"
                              href={`/admin/school-sis/device-control/${id}`}
                            >
                              View Device Details
                            </Link>
                            {canSignOut ? (
                              <button
                                type="button"
                                className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50"
                                onClick={() =>
                                  setConfirm({
                                    ids: [id],
                                    action: 'signout',
                                    name: str(row.userName),
                                  })
                                }
                              >
                                Sign Out
                              </button>
                            ) : null}
                            {canBlock ? (
                              <button
                                type="button"
                                className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50"
                                onClick={() =>
                                  setConfirm({
                                    ids: [id],
                                    action: 'block',
                                    name: str(row.userName),
                                  })
                                }
                              >
                                Block Device
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="block w-full rounded-lg px-3 py-1.5 text-left hover:bg-slate-50"
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
          )}
          <div className="flex items-center justify-between border-t p-3 text-sm">
            <div>
              {total} devices
              <select
                className="ml-2 rounded border px-1"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border px-2 py-1"
              >
                Prev
              </button>
              <span>Page {page}</span>
              <button
                type="button"
                disabled={page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border px-2 py-1"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

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
