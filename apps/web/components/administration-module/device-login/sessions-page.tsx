'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  downloadDeviceReport,
  fetchDeviceSessions,
  revokeAllUserDeviceSessions,
  revokeDeviceSession,
} from '@/services/device-security';
import { formatDisplayDateTime } from '@/utils/format-date';
import { DeviceLoginNav } from './device-login-nav';
import {
  DeviceLoginTable,
  DeviceLoginThead,
  EmptyTableState,
  StatusBadge,
} from './device-login-ui';
import { formatClientIp } from './device-login-utils';

export function DeviceLoginSessionsPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['admin', 'device-security', 'sessions', search],
    queryFn: () => fetchDeviceSessions(search ? { search } : undefined),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeDeviceSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'device-security', 'sessions'] }),
  });
  const revokeAllMut = useMutation({
    mutationFn: (userId: string) => revokeAllUserDeviceSessions(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'device-security', 'sessions'] }),
  });

  const items = q.data?.items ?? [];

  return (
    <DashboardShell role="admin" title="Active Sessions">
      <AdminShell>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <AdminPageHeader
            title="Active Sessions"
            subtitle="See who is signed in and force-logout web or mobile sessions when needed"
          />
          <Button size="sm" variant="outline" onClick={() => void downloadDeviceReport('sessions')}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
        <DeviceLoginNav />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by email or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {q.data ? `${q.data.total} active` : null}
          </span>
        </div>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading sessions…</p>
        ) : items.length === 0 ? (
          <DeviceLoginTable>
            <tbody>
              <tr>
                <td colSpan={6}>
                  <EmptyTableState
                    title="No active sessions"
                    description="Sessions appear here after users sign in successfully."
                  />
                </td>
              </tr>
            </tbody>
          </DeviceLoginTable>
        ) : (
          <DeviceLoginTable>
            <DeviceLoginThead
              columns={['User', 'Device', 'Client', 'Status', 'Last activity', 'Actions']}
            />
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.user?.displayName || s.user?.email}</div>
                    <div className="text-xs text-muted-foreground">{s.user?.email}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {formatClientIp(s.ipAddress)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{s.device}</div>
                    <div className="text-xs text-muted-foreground">{s.browser}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.clientType || 'WEB'} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDisplayDateTime(s.lastActivity)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={revokeMut.isPending}
                        onClick={() => revokeMut.mutate(s.id)}
                      >
                        Revoke
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={revokeAllMut.isPending}
                        onClick={() => {
                          if (
                            window.confirm('Revoke all sessions for this user on every device?')
                          ) {
                            revokeAllMut.mutate(s.userId);
                          }
                        }}
                      >
                        Revoke all
                      </Button>
                    </div>
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
