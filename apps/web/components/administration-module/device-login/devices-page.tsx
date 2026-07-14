'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { downloadDeviceReport, fetchAccessDevices } from '@/services/device-security';
import { formatDisplayDateTime } from '@/utils/format-date';
import { DeviceLoginNav } from './device-login-nav';
import {
  DeviceLoginTable,
  DeviceLoginThead,
  EmptyTableState,
  StatusBadge,
} from './device-login-ui';
import { formatClientIp } from './device-login-utils';

export function DeviceLoginDevicesPage({ statusFilter }: { statusFilter?: string }) {
  useRequireAuth();
  const [search, setSearch] = useState('');
  const blockedOnly = statusFilter === 'BLOCKED';
  const q = useQuery({
    queryKey: ['admin', 'device-security', 'devices', search, statusFilter],
    queryFn: () =>
      fetchAccessDevices({
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  });

  const items = q.data?.items ?? [];

  return (
    <DashboardShell role="admin" title={blockedOnly ? 'Blocked Devices' : 'Devices'}>
      <AdminShell>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <AdminPageHeader
            title={blockedOnly ? 'Blocked Devices' : 'Registered Devices'}
            subtitle={
              blockedOnly
                ? 'Devices that cannot sign in until an administrator unblocks them'
                : 'Web and mobile access devices linked to portal users'
            }
          />
          <Button size="sm" variant="outline" onClick={() => void downloadDeviceReport('devices')}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
        <DeviceLoginNav />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search device, browser, user…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {q.data ? `${q.data.total} device${q.data.total === 1 ? '' : 's'}` : null}
          </span>
        </div>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading devices…</p>
        ) : items.length === 0 ? (
          <DeviceLoginTable>
            <tbody>
              <tr>
                <td colSpan={6}>
                  <EmptyTableState
                    title={blockedOnly ? 'No blocked devices' : 'No devices yet'}
                    description={
                      blockedOnly
                        ? 'Blocked devices will appear here after an admin takes action.'
                        : 'Devices are registered automatically when users sign in.'
                    }
                  />
                </td>
              </tr>
            </tbody>
          </DeviceLoginTable>
        ) : (
          <DeviceLoginTable>
            <DeviceLoginThead
              columns={['Device', 'User', 'Client', 'Status', 'Location', 'Last seen']}
            />
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/administration/device-login/devices/${d.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {d.deviceName || d.id.slice(0, 8)}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[d.browserName, d.platform].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {formatClientIp(d.lastIpMasked || d.lastIp)}
                    </div>
                  </td>
                  <td className="px-4 py-3">{d.user?.displayName || d.user?.email || d.userId}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.clientType || 'WEB'} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {[d.lastCity, d.lastCountry].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDisplayDateTime(d.lastSeenAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </DeviceLoginTable>
        )}
      </AdminShell>
    </DashboardShell>
  );
}
