'use client';

import { useMemo, useState } from 'react';
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
  Activity,
  Ban,
  ChevronLeft,
  Clock3,
  Copy,
  Globe,
  Info,
  LogOut,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Shield,
  ShieldAlert,
  Smartphone,
  UserRound,
} from 'lucide-react';

type TabId = 'overview' | 'sessions' | 'activity' | 'ip' | 'logs';

function str(v: unknown) {
  return v == null ? '' : String(v);
}
function fmt(v: unknown) {
  if (!v) return '—';
  return new Date(String(v)).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? 'U') + (parts[1]?.[0] ?? '')).toUpperCase();
}
function phoneTone(model: string, manufacturer: string) {
  const hay = `${manufacturer} ${model}`.toLowerCase();
  if (hay.includes('iphone') || hay.includes('apple')) return 'bg-slate-800';
  if (hay.includes('samsung') || hay.includes('galaxy')) return 'bg-sky-700';
  if (hay.includes('redmi') || hay.includes('xiaomi')) return 'bg-orange-500';
  return 'bg-indigo-600';
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

function eventLook(type: string, description: string) {
  const hay = `${type} ${description}`.toUpperCase();
  if (hay.includes('LOGIN') || hay.includes('SIGN'))
    return { icon: UserRound, wrap: 'bg-violet-100 text-violet-700', title: 'User login' };
  if (hay.includes('PUSH') || hay.includes('FCM') || hay.includes('TOKEN'))
    return { icon: Shield, wrap: 'bg-emerald-100 text-emerald-700', title: 'Push registration' };
  if (hay.includes('REFRESH') || hay.includes('SESSION'))
    return { icon: RefreshCw, wrap: 'bg-sky-100 text-sky-700', title: 'Session refreshed' };
  if (hay.includes('REVOKE') || hay.includes('BLOCK'))
    return { icon: Ban, wrap: 'bg-rose-100 text-rose-700', title: type.replaceAll('_', ' ') };
  if (hay.includes('ADDED') || hay.includes('REGISTER') || hay.includes('CREATE'))
    return { icon: Clock3, wrap: 'bg-slate-200 text-slate-600', title: 'Device added' };
  return {
    icon: Activity,
    wrap: 'bg-emerald-100 text-emerald-700',
    title: description || type.replaceAll('_', ' '),
  };
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
  const [tab, setTab] = useState<TabId>('overview');
  const [confirm, setConfirm] = useState<
    'sign-out' | 'revoke' | 'block' | 'unblock' | 'all' | null
  >(null);
  const [reason, setReason] = useState(DEVICE_REASONS[0]);
  const [other, setOther] = useState('');
  const [more, setMore] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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

  const siblings = useMemo(() => (row?.siblings as Array<Record<string, unknown>>) ?? [], [row]);
  const events = useMemo(() => (row?.events as Array<Record<string, unknown>>) ?? [], [row]);
  const ipHistory = useMemo(() => (row?.ipHistory as Array<Record<string, unknown>>) ?? [], [row]);
  const sessions = useMemo(() => (row?.sessions as Array<Record<string, unknown>>) ?? [], [row]);

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  if (q.isLoading) return <p className="p-8 text-slate-500">Loading device…</p>;
  if (!row) return <p className="p-8 text-slate-500">Device not found.</p>;

  const title =
    [str(row.manufacturer), str(row.deviceModel)].filter(Boolean).join(' ') ||
    str(row.deviceLabel) ||
    'Device';
  const status = str(row.deviceStatus).toUpperCase();
  const sess = str(row.session);
  const plat = str(row.platform).toLowerCase();
  const studentId = str(row.studentId);
  const score =
    status === 'BLOCKED' || status === 'REVOKED' || row.flagged
      ? { label: 'At risk', cls: 'text-rose-700 bg-rose-50' }
      : Number(row.failedAuthCount) >= 5
        ? { label: 'Watch', cls: 'text-amber-700 bg-amber-50' }
        : { label: 'Good', cls: 'text-emerald-700 bg-emerald-50' };

  const tabs: { id: TabId; label: string; icon: typeof UserRound }[] = [
    { id: 'overview', label: 'Overview', icon: UserRound },
    { id: 'sessions', label: 'Sessions', icon: Clock3 },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'ip', label: 'IP History', icon: MapPin },
    { id: 'logs', label: 'Security Logs', icon: ShieldAlert },
  ];

  return (
    <div className="min-h-full space-y-5 bg-[#f3f7fc] p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link
          href="/admin/school-sis/device-control"
          className="inline-flex items-center gap-1 font-semibold text-sky-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Device Control
        </Link>
        <p className="text-xs text-slate-400">
          Last updated:{' '}
          {q.dataUpdatedAt
            ? new Date(q.dataUpdatedAt).toLocaleString('en-IN', {
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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400',
                )}
              />
              {status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {str(row.userName)} · <span className="capitalize">{str(row.persona)}</span>
            {row.identifier ? ` · ${str(row.identifier)}` : ''}
            {row.classLabel ? ` · ${str(row.classLabel)}` : ''}
          </p>
        </div>
        <div className="relative flex flex-wrap gap-2">
          {canSignOut ? (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              onClick={() => setConfirm('sign-out')}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          ) : null}
          {canRevoke ? (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white"
              onClick={() => setConfirm('revoke')}
            >
              <Ban className="h-4 w-4" />
              Revoke Device
            </button>
          ) : null}
          {canBlock && status !== 'BLOCKED' ? (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
              onClick={() => setConfirm('block')}
            >
              <ShieldAlert className="h-4 w-4" />
              Block Device
            </button>
          ) : null}
          {canBlock && status === 'BLOCKED' ? (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold"
              onClick={() => setConfirm('unblock')}
            >
              Unblock
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold"
            onClick={() => setMore((v) => !v)}
          >
            <MoreHorizontal className="h-4 w-4" />
            More
          </button>
          {more ? (
            <div className="absolute right-0 top-12 z-10 w-56 rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg">
              {canRevokeAll ? (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-rose-700 hover:bg-slate-50"
                  onClick={() => {
                    setMore(false);
                    setConfirm('all');
                  }}
                >
                  Revoke All Devices ({siblings.length})
                </button>
              ) : null}
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => {
                  copy(str(row.installationId), 'id');
                  setMore(false);
                }}
              >
                Copy Device ID
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold',
                tab === t.id
                  ? 'bg-[#0b3a6e] text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-white bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <UserRound className="h-4 w-4 text-sky-600" />
              User Information
            </h2>
            <div className="mt-4 flex gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#123a6b] text-lg font-bold text-white">
                {initials(str(row.userName))}
              </span>
              <div>
                <p className="text-lg font-bold text-slate-900">{str(row.userName)}</p>
                <p className="capitalize text-sm text-slate-500">{str(row.persona)}</p>
                <p className="mt-2 text-sm text-slate-600">{str(row.identifier) || '—'}</p>
                {row.classLabel ? (
                  <p className="text-sm text-slate-600">{str(row.classLabel)}</p>
                ) : null}
                {studentId ? (
                  <Link
                    href={`/admin/school-sis/students/${studentId}`}
                    className="mt-3 inline-block text-sm font-semibold text-sky-700"
                  >
                    View Student Profile →
                  </Link>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                <Smartphone className="h-4 w-4 text-sky-600" />
                Device Details
              </h2>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                {plat === 'ios' ? (
                  ' iOS'
                ) : (
                  <>
                    <AndroidMark className="h-4 w-4" /> Android
                  </>
                )}
              </span>
            </div>
            <div className="mt-4 flex gap-4">
              <span
                className={cn(
                  'flex h-16 w-12 items-center justify-center rounded-xl text-white shadow-sm',
                  phoneTone(str(row.deviceModel), str(row.manufacturer)),
                )}
              >
                <Smartphone className="h-7 w-7" />
              </span>
              <div>
                <p className="text-lg font-bold text-[#1d4ed8]">{title}</p>
                <p className="text-sm text-slate-500">
                  {str(row.deviceName) || str(row.deviceLabel) || str(row.deviceModel)}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ['Manufacturer', str(row.manufacturer)],
                ['Model', str(row.deviceModel)],
                ['Device name', str(row.deviceName) || str(row.deviceLabel)],
                ['Platform', str(row.platform)],
                ['OS version', str(row.osVersion)],
                ['App version', str(row.appVersion)],
                ['Build', str(row.buildNumber)],
                ['Screen', str(row.screenResolution)],
                ['Time zone', str(row.timezone)],
                ['Language', str(row.locale)],
                ['First registered', fmt(row.createdAt)],
                ['Last app open', fmt(row.lastActiveAt)],
                ['Last sync', fmt(row.lastSyncAt)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-400">{k}</dt>
                  <dd className="font-medium text-slate-700">{v || '—'}</dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-xs text-slate-400">Identifier</dt>
                <dd className="flex items-center gap-2 break-all font-medium text-slate-700">
                  {str(row.installationId)}
                  <button
                    type="button"
                    onClick={() => copy(str(row.installationId), 'id')}
                    className="text-slate-400"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  {copied === 'id' ? (
                    <span className="text-xs text-emerald-600">Copied</span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-white bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                <Shield className="h-4 w-4 text-emerald-600" />
                Security Overview
              </h2>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  score.cls,
                )}
              >
                <Shield className="h-3.5 w-3.5" />
                Security Score {score.label}
              </span>
            </div>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Session status</dt>
                <dd
                  className={
                    sess === 'online' ? 'font-semibold text-emerald-700' : 'text-slate-700'
                  }
                >
                  {sess === 'online' ? '● Online' : sess.replaceAll('_', ' ')}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Biometric</dt>
                <dd
                  className={
                    row.biometricEnabled ? 'text-emerald-700' : 'font-semibold text-rose-600'
                  }
                >
                  {row.biometricEnabled ? 'Enabled' : '● Disabled'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Push notifications</dt>
                <dd
                  className={row.pushEnabled ? 'text-emerald-700' : 'font-semibold text-rose-600'}
                >
                  {row.pushEnabled ? 'Enabled' : '● Inactive'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Last push</dt>
                <dd>{fmt(row.lastPushAt)}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-slate-500">Last login</dt>
                <dd>{fmt(row.lastLoginAt)}</dd>
              </div>
            </dl>
            <p className="mt-3 flex gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              This device is authenticated through the mobile app. Tokens and secrets are never
              displayed for security reasons.
            </p>
          </section>

          <section className="rounded-2xl border border-white bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-800">
              <Globe className="h-4 w-4 text-sky-600" />
              Network Information
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Latest IP</dt>
                <dd className="flex items-center gap-2 font-medium">
                  {str(row.lastIpAddress) || '—'}
                  {row.lastIpAddress ? (
                    <button type="button" onClick={() => copy(str(row.lastIpAddress), 'ip')}>
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  ) : null}
                  {copied === 'ip' ? (
                    <span className="text-xs text-emerald-600">Copied</span>
                  ) : null}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Previous IP</dt>
                <dd>{str(row.previousIpAddress) || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Network type</dt>
                <dd>{str(row.networkType) || 'Unknown'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Last connection</dt>
                <dd>{fmt(row.lastActiveAt)}</dd>
              </div>
            </dl>
            <p className="mt-3 flex gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              IP addresses are security metadata, not a precise physical location.
            </p>
          </section>

          <section className="rounded-2xl border border-white bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">
                Devices for this user ({siblings.length})
              </h2>
              <button
                type="button"
                className="text-sm font-semibold text-sky-700"
                onClick={() => setTab('sessions')}
              >
                View All
              </button>
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {siblings.slice(0, 5).map((s) => (
                <li key={str(s.id)} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      'flex h-10 w-7 items-center justify-center rounded-md text-white',
                      phoneTone(str(s.deviceModel), str(s.manufacturer)),
                    )}
                  >
                    <Smartphone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">
                      {[str(s.manufacturer), str(s.deviceModel)].filter(Boolean).join(' ') ||
                        'Device'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {str(s.platform)} · App v{str(s.appVersion) || '—'}
                      {str(s.id) === id ? (
                        <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Current Device
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                      str(s.deviceStatus) === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {str(s.deviceStatus)}
                  </span>
                  <span className="hidden w-36 text-right text-xs text-slate-400 sm:block">
                    {fmt(s.lastActiveAt)}
                  </span>
                  <Link
                    href={`/admin/school-sis/device-control/${str(s.id)}`}
                    className="text-sm font-semibold text-sky-700"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-white bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Recent Activity</h2>
              <button
                type="button"
                className="text-sm font-semibold text-sky-700"
                onClick={() => setTab('activity')}
              >
                View All
              </button>
            </div>
            {!events.length ? (
              <p className="mt-3 text-sm text-slate-500">No recent device activity recorded.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {events.slice(0, 5).map((e) => {
                  const look = eventLook(str(e.eventType), str(e.description));
                  const Icon = look.icon;
                  return (
                    <li key={str(e.id)} className="flex gap-3 text-sm">
                      <span
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                          look.wrap,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold text-slate-800">{look.title}</span>
                        <span className="text-xs text-slate-500">{str(e.description)}</span>
                      </span>
                      <span className="whitespace-nowrap text-xs text-slate-400">
                        {fmt(e.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      ) : null}

      {tab === 'sessions' ? (
        <section className="rounded-2xl border border-white bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Current sessions</h2>
          {!sessions.length ? (
            <p className="mt-3 text-sm text-slate-500">No active refresh sessions for this user.</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {sessions.map((s) => (
                <li key={str(s.id)} className="py-3">
                  Logged in {fmt(s.createdAt)} · expires {fmt(s.expiresAt)}
                  {s.ipAddress ? ` · ${str(s.ipAddress)}` : ''}
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-6 font-semibold">All devices ({siblings.length})</h3>
          <ul className="mt-2 divide-y">
            {siblings.map((s) => (
              <li key={str(s.id)} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {str(s.deviceModel)} · {str(s.deviceStatus)}
                </span>
                <Link
                  className="font-semibold text-sky-700"
                  href={`/admin/school-sis/device-control/${str(s.id)}`}
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'activity' || tab === 'logs' ? (
        <section className="rounded-2xl border border-white bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{tab === 'logs' ? 'Security logs' : 'Device activity'}</h2>
          {!events.length ? (
            <p className="mt-3 text-sm text-slate-500">No events recorded.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {events.map((e) => {
                const look = eventLook(str(e.eventType), str(e.description));
                const Icon = look.icon;
                return (
                  <li key={str(e.id)} className="flex gap-3 border-b border-slate-50 pb-3 text-sm">
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        look.wrap,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{look.title}</span>
                      <span className="text-slate-500">{str(e.description)}</span>
                    </span>
                    <span className="text-xs text-slate-400">{fmt(e.createdAt)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : null}

      {tab === 'ip' ? (
        <section className="rounded-2xl border border-white bg-white p-5 shadow-sm">
          <h2 className="font-semibold">IP History</h2>
          <p className="mt-1 text-xs text-slate-500">
            IP addresses are security metadata, not a precise physical location.
          </p>
          {!ipHistory.length ? (
            <p className="mt-3 text-sm text-slate-500">No IP history available for this account.</p>
          ) : (
            <table className="mt-3 min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2">Date & time</th>
                  <th>IP</th>
                  <th>Network</th>
                </tr>
              </thead>
              <tbody>
                {ipHistory.map((h) => (
                  <tr key={str(h.id)} className="border-t">
                    <td className="py-2">{fmt(h.observedAt)}</td>
                    <td>{str(h.ipAddress)}</td>
                    <td>{str(h.networkType) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

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
