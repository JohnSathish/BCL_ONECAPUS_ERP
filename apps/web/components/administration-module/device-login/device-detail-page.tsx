'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  blockAccessDevice,
  fetchAccessDevice,
  trustAccessDevice,
  unblockAccessDevice,
} from '@/services/device-security';
import { formatDisplayDateTime } from '@/utils/format-date';
import { DeviceLoginNav } from './device-login-nav';
import {
  DeviceLoginTable,
  DeviceLoginThead,
  EmptyTableState,
  FlagBadges,
  OutcomeBadge,
  StatusBadge,
} from './device-login-ui';
import { formatClientIp } from './device-login-utils';

export function DeviceLoginDeviceDetailPage() {
  useRequireAuth();
  const params = useParams();
  const id = String(params.id ?? '');
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'device-security', 'device', id],
    queryFn: () => fetchAccessDevice(id),
    enabled: Boolean(id),
  });
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['admin', 'device-security', 'device', id] });

  const blockMut = useMutation({
    mutationFn: () => blockAccessDevice(id, 'Blocked by administrator'),
    onSuccess: invalidate,
  });
  const unblockMut = useMutation({
    mutationFn: () => unblockAccessDevice(id),
    onSuccess: invalidate,
  });
  const trustMut = useMutation({
    mutationFn: () => trustAccessDevice(id),
    onSuccess: invalidate,
  });

  const device = q.data?.device;
  const timeline = q.data?.timeline ?? [];

  return (
    <DashboardShell role="admin" title="Device Detail">
      <AdminShell>
        <AdminPageHeader
          title={device?.deviceName || 'Device'}
          subtitle="Inspect fingerprint, location, sessions, and take security actions"
        />
        <DeviceLoginNav />
        {q.isLoading || !device ? (
          <p className="text-sm text-muted-foreground">Loading device…</p>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <StatusBadge status={device.status} />
                <StatusBadge status={device.clientType || 'WEB'} />
                {device.status !== 'BLOCKED' ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={blockMut.isPending}
                    onClick={() => {
                      if (window.confirm('Block this device from signing in?')) {
                        blockMut.mutate();
                      }
                    }}
                  >
                    Block device
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={unblockMut.isPending}
                    onClick={() => unblockMut.mutate()}
                  >
                    Unblock
                  </Button>
                )}
                {device.status !== 'TRUSTED' && device.status !== 'BLOCKED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={trustMut.isPending}
                    onClick={() => trustMut.mutate()}
                  >
                    Mark trusted
                  </Button>
                ) : null}
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['User', device.user?.displayName || device.user?.email || device.userId],
                  [
                    'Platform',
                    [device.platform, device.osVersion].filter(Boolean).join(' ') || '—',
                  ],
                  [
                    'Browser',
                    [device.browserName, device.browserVersion].filter(Boolean).join(' ') || '—',
                  ],
                  ['IP (masked)', formatClientIp(device.lastIpMasked ?? device.lastIp)],
                  [
                    'Location',
                    [device.lastCity, device.lastRegion, device.lastCountry]
                      .filter(Boolean)
                      .join(', ') || '—',
                  ],
                  ['Login count', String(device.loginCount)],
                  ['First seen', formatDisplayDateTime(device.firstSeenAt)],
                  ['Last seen', formatDisplayDateTime(device.lastSeenAt)],
                  ['Timezone', device.timeZone || '—'],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                  >
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="mt-0.5 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              {device.blockReason ? (
                <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
                  Block reason: {device.blockReason}
                </p>
              ) : null}
            </div>

            <div className="mb-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold">Active sessions on this device</h3>
              <p className="mb-3 text-xs text-muted-foreground">
                {(q.data?.activeSessions ?? []).length} open session
                {(q.data?.activeSessions ?? []).length === 1 ? '' : 's'}
              </p>
              {(q.data?.activeSessions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No active sessions right now.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(q.data?.activeSessions ?? []).map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <span className="font-mono text-xs">{s.id.slice(0, 8)}…</span>
                      <span className="text-muted-foreground">
                        Expires {formatDisplayDateTime(s.expiresAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {timeline.length === 0 ? (
              <DeviceLoginTable>
                <tbody>
                  <tr>
                    <td colSpan={5}>
                      <EmptyTableState
                        title="No linked login events yet"
                        description="Successful and failed attempts tied to this device will appear here."
                      />
                    </td>
                  </tr>
                </tbody>
              </DeviceLoginTable>
            ) : (
              <DeviceLoginTable>
                <DeviceLoginThead columns={['When', 'Outcome', 'Method', 'Flags', 'IP']} />
                <tbody>
                  {timeline.map((ev) => (
                    <tr key={ev.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatDisplayDateTime(ev.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <OutcomeBadge outcome={ev.outcome} />
                      </td>
                      <td className="px-4 py-3">{ev.method}</td>
                      <td className="px-4 py-3">
                        <FlagBadges flags={ev.suspiciousFlags} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {formatClientIp(ev.ipAddress)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DeviceLoginTable>
            )}
          </>
        )}
      </AdminShell>
    </DashboardShell>
  );
}
