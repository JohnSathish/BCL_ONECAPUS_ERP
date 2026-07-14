'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { downloadDeviceReport, fetchFailedLogins } from '@/services/device-security';
import { formatDisplayDateTime } from '@/utils/format-date';
import { DeviceLoginNav } from './device-login-nav';
import {
  DeviceLoginBadge,
  DeviceLoginTable,
  DeviceLoginThead,
  EmptyTableState,
} from './device-login-ui';
import { formatClientIp } from './device-login-utils';

function reasonTone(reason?: string | null, outcome?: string) {
  const key = `${reason ?? ''} ${outcome ?? ''}`.toLowerCase();
  if (key.includes('lock')) return 'warning' as const;
  if (key.includes('password') || key.includes('unknown') || key.includes('fail')) {
    return 'danger' as const;
  }
  return 'neutral' as const;
}

export function DeviceLoginFailedPage() {
  useRequireAuth();
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'device-security', 'failed', search],
    queryFn: () => fetchFailedLogins(search ? { search } : undefined),
  });
  const items = q.data?.items ?? [];

  return (
    <DashboardShell role="admin" title="Failed Logins">
      <AdminShell>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <AdminPageHeader
            title="Failed Logins"
            subtitle="Authentication failures and temporary lockouts — use this to spot brute-force attempts"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void downloadDeviceReport('failed-logins')}
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
              placeholder="Search identifier"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading failed logins…</p>
        ) : items.length === 0 ? (
          <DeviceLoginTable>
            <tbody>
              <tr>
                <td colSpan={5}>
                  <EmptyTableState
                    title="No failed logins found"
                    description="When passwords fail or accounts lock, events show up here."
                  />
                </td>
              </tr>
            </tbody>
          </DeviceLoginTable>
        ) : (
          <DeviceLoginTable>
            <DeviceLoginThead columns={['When', 'Identifier', 'Reason', 'IP', 'User agent']} />
            <tbody>
              {items.map((ev) => (
                <tr key={ev.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDisplayDateTime(ev.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-medium">{ev.identifier}</td>
                  <td className="px-4 py-3">
                    <DeviceLoginBadge tone={reasonTone(ev.reason, ev.outcome)}>
                      {(ev.reason ?? ev.outcome).replace(/_/g, ' ')}
                    </DeviceLoginBadge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{formatClientIp(ev.ipAddress)}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-xs text-muted-foreground">
                    {ev.userAgent ?? '—'}
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
