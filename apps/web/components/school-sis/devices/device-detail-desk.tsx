'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canSchoolDevice } from '@/lib/school-sis/permissions';
import {
  DEVICE_REASONS,
  fetchSchoolDevice,
  schoolDeviceAction,
  schoolDeviceRevokeAll,
} from '@/services/school-devices';
import { apiErrorMessage } from '@/utils/api-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function str(v: unknown) {
  return v == null ? '' : String(v);
}
function fmt(v: unknown) {
  if (!v) return '—';
  return new Date(String(v)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

export function DeviceDetailDesk() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const perms = useAuthStore((s) => s.session?.user.permissions);
  const canRevoke = canSchoolDevice(perms, 'devices.revoke');
  const canSignOut = canSchoolDevice(perms, 'devices.signout');
  const canBlock = canSchoolDevice(perms, 'devices.block');
  const canRevokeAll = canSchoolDevice(perms, 'devices.revoke_all');
  const [confirm, setConfirm] = useState<
    'sign-out' | 'revoke' | 'block' | 'unblock' | 'all' | null
  >(null);
  const [reason, setReason] = useState(DEVICE_REASONS[0]);
  const [other, setOther] = useState('');
  const [more, setMore] = useState(false);

  const q = useQuery({
    queryKey: ['school-device', id],
    queryFn: () => fetchSchoolDevice(id),
    enabled: ready && Boolean(id),
  });
  const row = q.data;
  const mutate = useMutation({
    mutationFn: async () => {
      const why = reason === 'Other' ? other || 'Other' : reason;
      if (confirm === 'all') {
        await schoolDeviceRevokeAll(str(row?.userId), why);
        return;
      }
      if (!confirm) return;
      await schoolDeviceAction(id, confirm, why);
    },
    onSuccess: () => {
      setConfirm(null);
      void qc.invalidateQueries({ queryKey: ['school-device', id] });
      if (confirm === 'all') router.push('/admin/school-sis/device-control');
    },
  });

  if (q.isLoading) return <p className="p-8 text-slate-500">Loading device…</p>;
  if (!row) return <p className="p-8 text-slate-500">Device not found.</p>;

  const siblings = (row.siblings as Array<Record<string, unknown>>) ?? [];
  const events = (row.events as Array<Record<string, unknown>>) ?? [];
  const ipHistory = (row.ipHistory as Array<Record<string, unknown>>) ?? [];
  const sessions = (row.sessions as Array<Record<string, unknown>>) ?? [];
  const title = [str(row.manufacturer), str(row.deviceModel)].filter(Boolean).join(' ') || 'Device';

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Link href="/admin/school-sis/device-control" className="text-sm text-[#0b3a6e]">
        ← Device Control
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-600">
            {str(row.deviceStatus)} · {str(row.userName)} · {str(row.persona)}
            {row.identifier ? ` · ${str(row.identifier)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSignOut ? (
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => setConfirm('sign-out')}
            >
              Sign Out
            </button>
          ) : null}
          {canRevoke ? (
            <button
              type="button"
              className="rounded-lg bg-red-700 px-3 py-2 text-sm text-white"
              onClick={() => setConfirm('revoke')}
            >
              Revoke Device
            </button>
          ) : null}
          {canBlock && str(row.deviceStatus) !== 'BLOCKED' ? (
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => setConfirm('block')}
            >
              Block Device
            </button>
          ) : null}
          {canBlock && str(row.deviceStatus) === 'BLOCKED' ? (
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => setConfirm('unblock')}
            >
              Unblock
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm"
            onClick={() => setMore((v) => !v)}
          >
            More
          </button>
        </div>
      </div>
      {more ? (
        <div className="rounded-xl border bg-white p-3 text-sm space-y-1">
          {canRevokeAll ? (
            <button type="button" className="block text-red-700" onClick={() => setConfirm('all')}>
              Revoke All Devices ({siblings.length})
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(str(row.installationId))}
          >
            Copy Device ID
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">User</h2>
          <p className="mt-1 font-medium">{str(row.userName)}</p>
          <p className="text-sm text-slate-600">
            {str(row.identifier)} {row.classLabel ? `· ${str(row.classLabel)}` : ''}
          </p>
        </section>
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Device Details</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              Manufacturer<div className="text-slate-600">{str(row.manufacturer) || '—'}</div>
            </div>
            <div>
              Model<div className="text-slate-600">{str(row.deviceModel) || '—'}</div>
            </div>
            <div>
              Device name
              <div className="text-slate-600">
                {str(row.deviceName) || str(row.deviceLabel) || '—'}
              </div>
            </div>
            <div>
              Platform<div className="text-slate-600">{str(row.platform)}</div>
            </div>
            <div>
              OS version<div className="text-slate-600">{str(row.osVersion) || '—'}</div>
            </div>
            <div>
              App version<div className="text-slate-600">{str(row.appVersion) || '—'}</div>
            </div>
            <div>
              Build<div className="text-slate-600">{str(row.buildNumber) || '—'}</div>
            </div>
            <div>
              Screen<div className="text-slate-600">{str(row.screenResolution) || '—'}</div>
            </div>
            <div>
              Time zone<div className="text-slate-600">{str(row.timezone) || '—'}</div>
            </div>
            <div>
              Language<div className="text-slate-600">{str(row.locale) || '—'}</div>
            </div>
            <div>
              First registered<div className="text-slate-600">{fmt(row.createdAt)}</div>
            </div>
            <div>
              Last app open<div className="text-slate-600">{fmt(row.lastActiveAt)}</div>
            </div>
            <div>
              Last sync<div className="text-slate-600">{fmt(row.lastSyncAt)}</div>
            </div>
            <div>
              Identifier<div className="text-slate-600 break-all">{str(row.installationId)}</div>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Security</h2>
          <p className="text-sm mt-2">Session: {str(row.session)}</p>
          <p className="text-sm">Biometric: {row.biometricEnabled ? 'Enabled' : 'Disabled'}</p>
          <p className="text-sm">Push notifications: {row.pushEnabled ? 'Enabled' : 'Inactive'}</p>
          <p className="text-sm">Last push: {fmt(row.lastPushAt)}</p>
          <p className="text-sm">Last login: {fmt(row.lastLoginAt)}</p>
          {row.blockReason ? (
            <p className="text-sm text-red-700">Blocked: {str(row.blockReason)}</p>
          ) : null}
        </section>
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Network Information</h2>
          <p className="mt-2 text-xs text-slate-500">
            IP addresses are security metadata, not a precise physical location.
          </p>
          <p className="text-sm mt-2">Latest IP: {str(row.lastIpAddress) || '—'}</p>
          <p className="text-sm">Previous IP: {str(row.previousIpAddress) || '—'}</p>
          <p className="text-sm">Network: {str(row.networkType) || 'Unknown'}</p>
          <p className="text-sm">Last connection: {fmt(row.lastActiveAt)}</p>
        </section>
      </div>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Devices for this user ({siblings.length})</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {siblings.map((s) => (
            <li key={str(s.id)} className="flex justify-between gap-2 border-b pb-2">
              <span>
                {str(s.deviceModel) || 'Device'} · {str(s.platform)} · {str(s.deviceStatus)} · last
                seen {fmt(s.lastActiveAt)}
              </span>
              <Link
                className="text-[#0b3a6e]"
                href={`/admin/school-sis/device-control/${str(s.id)}`}
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {ipHistory.length ? (
        <section className="rounded-2xl border bg-white p-4 shadow-sm overflow-x-auto">
          <h2 className="font-semibold">IP History</h2>
          <table className="mt-2 min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-1">Date & time</th>
                <th>IP</th>
                <th>Network</th>
              </tr>
            </thead>
            <tbody>
              {ipHistory.map((h) => (
                <tr key={str(h.id)} className="border-t">
                  <td className="py-1">{fmt(h.observedAt)}</td>
                  <td>{str(h.ipAddress)}</td>
                  <td>{str(h.networkType) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {sessions.length ? (
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Current Session</h2>
          <ul className="mt-2 text-sm space-y-1">
            {sessions.map((s) => (
              <li key={str(s.id)}>
                Logged in {fmt(s.createdAt)} · expires {fmt(s.expiresAt)}
                {s.ipAddress ? ` · ${str(s.ipAddress)}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Recent Activity</h2>
        {!events.length ? (
          <p className="mt-2 text-sm text-slate-500">No recent device activity recorded.</p>
        ) : (
          <ol className="mt-2 space-y-2 text-sm">
            {events.map((e) => (
              <li key={str(e.id)}>
                <span className="text-slate-500">{fmt(e.createdAt)}</span> · {str(e.description)}
              </li>
            ))}
          </ol>
        )}
      </section>

      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === 'all'
                ? `Revoke all ${siblings.length} devices?`
                : confirm === 'revoke'
                  ? 'Revoke this device?'
                  : confirm === 'block'
                    ? 'Block this device?'
                    : confirm === 'unblock'
                      ? 'Unblock this device?'
                      : 'Sign out this device?'}
            </DialogTitle>
            <DialogDescription>
              Device: {title}. User: {str(row.userName)}.
            </DialogDescription>
          </DialogHeader>
          {confirm !== 'unblock' ? (
            <select
              className="rounded-lg border px-2 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value as (typeof DEVICE_REASONS)[number])}
            >
              {DEVICE_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          ) : null}
          {reason === 'Other' && confirm !== 'unblock' ? (
            <input
              className="rounded-lg border px-2 py-2 text-sm"
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
              disabled={mutate.isPending}
              onClick={() => mutate.mutate()}
            >
              Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
