'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { api } from '@/services/api';
import { apiErrorMessage } from '@/utils/api-error';
import { formatDisplayDateTime } from '@/utils/format-date';
import { DeviceLoginNav } from './device-login-nav';

type TrustedDevice = {
  id: string;
  label: string;
  lastIp: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
};

export function TrustedDevicesPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['admin', 'trusted-devices'],
    queryFn: async () => {
      const { data } = await api.get<{ items: TrustedDevice[] }>(
        '/v1/auth/admin-email-otp/devices',
      );
      return data;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'trusted-devices'] });

  const revokeOne = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/auth/admin-email-otp/devices/${id}`),
    onSuccess: () => {
      setError(null);
      setMessage('That device must verify by email the next time it signs in.');
      refresh();
    },
    onError: (err) => setError(apiErrorMessage(err, 'The device could not be removed.')),
  });

  const revokeAll = useMutation({
    mutationFn: () => api.post('/v1/auth/admin-email-otp/devices/revoke-all'),
    onSuccess: () => {
      setError(null);
      setMessage(
        'Every trusted device was removed. The next admin sign-in on each of them needs a code.',
      );
      refresh();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Trusted devices could not be removed.')),
  });

  const signOutOthers = useMutation({
    mutationFn: () => api.post('/v1/auth/sessions/revoke-others'),
    onSuccess: () => {
      setError(null);
      setMessage('Other signed-in sessions were ended. This browser stays signed in.');
    },
    onError: (err) => setError(apiErrorMessage(err, 'Other sessions could not be ended.')),
  });

  const items = q.data?.items ?? [];

  return (
    <DashboardShell role="admin" title="Trusted devices">
      <AdminShell>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
          <AdminPageHeader
            title="Trusted devices"
            subtitle="Admin browsers you chose to remember for 30 days. Other accounts are not asked for an email code."
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => signOutOthers.mutate()}>
              Sign out other devices
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => revokeAll.mutate()}
              disabled={items.length === 0}
            >
              Revoke all
            </Button>
          </div>
        </div>
        <DeviceLoginNav />
        {message ? (
          <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-border/80">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Last used</th>
                <th className="px-3 py-2 font-medium">Trusted until</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    No trusted devices yet. After an admin email code, choose “Trust this device for
                    30 days”.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-border/70">
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">{item.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.current ? 'This browser' : 'Another browser'}
                        {item.lastIp ? ` · ${item.lastIp}` : ''}
                        {' · added '}
                        {formatDisplayDateTime(item.createdAt)}
                      </div>
                    </td>
                    <td className="px-3 py-3">{formatDisplayDateTime(item.lastUsedAt)}</td>
                    <td className="px-3 py-3">{formatDisplayDateTime(item.expiresAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => revokeOne.mutate(item.id)}>
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
