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
import { downloadDeviceReport, fetchDeviceLoginHistory } from '@/services/device-security';
import { formatDisplayDateTime } from '@/utils/format-date';
import { DeviceLoginNav } from './device-login-nav';
import {
  DeviceLoginTable,
  DeviceLoginThead,
  EmptyTableState,
  FlagBadges,
  OutcomeBadge,
} from './device-login-ui';
import { formatClientIp } from './device-login-utils';

export function DeviceLoginHistoryPage() {
  useRequireAuth();
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'device-security', 'history', search],
    queryFn: () => fetchDeviceLoginHistory(search ? { search } : undefined),
  });
  const items = q.data?.items ?? [];

  return (
    <DashboardShell role="admin" title="Login History">
      <AdminShell>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <AdminPageHeader
            title="Login History"
            subtitle="Successful and failed authentication events with risk flags"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void downloadDeviceReport('login-activity')}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
        <DeviceLoginNav />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search identifier or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : items.length === 0 ? (
          <DeviceLoginTable>
            <tbody>
              <tr>
                <td colSpan={6}>
                  <EmptyTableState
                    title="No login events found"
                    description="Try clearing the search or wait for the next sign-in attempt."
                  />
                </td>
              </tr>
            </tbody>
          </DeviceLoginTable>
        ) : (
          <DeviceLoginTable>
            <DeviceLoginThead columns={['When', 'User', 'Outcome', 'Flags', 'IP', 'Country']} />
            <tbody>
              {items.map((ev) => (
                <tr key={ev.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDisplayDateTime(ev.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {ev.user?.displayName || ev.user?.email || ev.identifier}
                    </div>
                    {ev.accessDeviceId ? (
                      <Link
                        href={`/admin/administration/device-login/devices/${ev.accessDeviceId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Open device
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <OutcomeBadge outcome={ev.outcome} />
                  </td>
                  <td className="px-4 py-3">
                    <FlagBadges flags={ev.suspiciousFlags} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{formatClientIp(ev.ipAddress)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ev.country ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </DeviceLoginTable>
        )}
      </AdminShell>
    </DashboardShell>
  );
}
