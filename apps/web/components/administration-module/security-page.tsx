'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import type { ActiveSessionRow } from '@/types/administration';
import {
  fetchActiveSessions,
  fetchLoginHistory,
  fetchSecuritySettings,
  revokeSession,
  updateSecuritySettings,
} from '@/services/administration';
import { formatDisplayDateTime } from '@/utils/format-date';

type Tab = 'sessions' | 'history' | 'policy';

export function SecurityPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('sessions');

  const settingsQ = useQuery({
    queryKey: ['admin', 'security', 'settings'],
    queryFn: fetchSecuritySettings,
  });
  const sessionsQ = useQuery({
    queryKey: ['admin', 'security', 'sessions'],
    queryFn: () => fetchActiveSessions(),
    enabled: tab === 'sessions',
  });
  const historyQ = useQuery({
    queryKey: ['admin', 'security', 'history'],
    queryFn: () => fetchLoginHistory(),
    enabled: tab === 'history',
  });

  const saveMut = useMutation({
    mutationFn: updateSecuritySettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'security', 'settings'] }),
  });

  const [policy, setPolicy] = useState({
    minPasswordLength: 8,
    passwordHistoryCount: 5,
    forceResetOnFirstLogin: true,
    sessionTimeoutMinutes: 480,
    mfaEnforced: false,
  });

  useEffect(() => {
    if (settingsQ.data) {
      setPolicy({
        minPasswordLength: settingsQ.data.minPasswordLength,
        passwordHistoryCount: settingsQ.data.passwordHistoryCount,
        forceResetOnFirstLogin: settingsQ.data.forceResetOnFirstLogin,
        sessionTimeoutMinutes: settingsQ.data.sessionTimeoutMinutes,
        mfaEnforced: settingsQ.data.mfaEnforced,
      });
    }
  }, [settingsQ.data]);

  return (
    <DashboardShell role="admin" title="Security">
      <AdminShell>
        <AdminPageHeader
          title="Security & Sessions"
          subtitle="Active sessions, login history, password policy"
        />
        <div className="mb-4 flex gap-2">
          {(['sessions', 'history', 'policy'] as Tab[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? 'default' : 'outline'}
              onClick={() => setTab(t)}
            >
              {t === 'sessions'
                ? 'Active Sessions'
                : t === 'history'
                  ? 'Login History'
                  : 'Password Policy'}
            </Button>
          ))}
        </div>

        {tab === 'sessions' ? (
          <AdminGlassCard className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Device</th>
                  <th className="px-4 py-3">Browser</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">Login</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(sessionsQ.data?.items ?? []).map((s: ActiveSessionRow) => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="px-4 py-2">{s.user?.email ?? 'Deleted user'}</td>
                    <td className="px-4 py-2">{s.device}</td>
                    <td className="px-4 py-2">{s.browser}</td>
                    <td className="px-4 py-2 font-mono text-xs">{s.ipAddress ?? '—'}</td>
                    <td className="px-4 py-2 text-xs">{formatDisplayDateTime(s.loginAt)}</td>
                    <td className="px-4 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await revokeSession(s.id);
                          sessionsQ.refetch();
                        }}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminGlassCard>
        ) : null}

        {tab === 'history' ? (
          <AdminGlassCard className="p-4 space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Time</th>
                  <th className="py-2">User</th>
                  <th className="py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {(historyQ.data?.items ?? []).map(
                  (h: { id: string; createdAt: string; email?: string; type: string }) => (
                    <tr key={h.id} className="border-b border-border/50">
                      <td className="py-2 text-xs">{formatDisplayDateTime(h.createdAt)}</td>
                      <td className="py-2">{h.email ?? '—'}</td>
                      <td className="py-2 capitalize">{h.type}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            {(historyQ.data?.failedAttempts ?? []).length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Recent failed attempts</h3>
                <ul className="text-sm text-muted-foreground">
                  {historyQ.data!.failedAttempts.map(
                    (f: { email: string; ipAddress: string; failedCount: number }, i: number) => (
                      <li key={i}>
                        {f.email} · {f.ipAddress} · {f.failedCount} failures
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}
          </AdminGlassCard>
        ) : null}

        {tab === 'policy' ? (
          <AdminGlassCard className="max-w-lg space-y-4 p-5">
            <div className="space-y-2">
              <Label>Minimum password length</Label>
              <Input
                type="number"
                value={settingsQ.data?.minPasswordLength ?? policy.minPasswordLength}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, minPasswordLength: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Password history count</Label>
              <Input
                type="number"
                value={settingsQ.data?.passwordHistoryCount ?? policy.passwordHistoryCount}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, passwordHistoryCount: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Session timeout (minutes)</Label>
              <Input
                type="number"
                value={settingsQ.data?.sessionTimeoutMinutes ?? policy.sessionTimeoutMinutes}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, sessionTimeoutMinutes: Number(e.target.value) }))
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settingsQ.data?.forceResetOnFirstLogin ?? policy.forceResetOnFirstLogin}
                onChange={(e) =>
                  setPolicy((p) => ({ ...p, forceResetOnFirstLogin: e.target.checked }))
                }
              />
              Force password reset on first login
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settingsQ.data?.mfaEnforced ?? policy.mfaEnforced}
                onChange={(e) => setPolicy((p) => ({ ...p, mfaEnforced: e.target.checked }))}
              />
              MFA enforced (policy flag)
            </label>
            <Button
              onClick={() =>
                saveMut.mutate({
                  minPasswordLength: policy.minPasswordLength,
                  passwordHistoryCount: policy.passwordHistoryCount,
                  sessionTimeoutMinutes: policy.sessionTimeoutMinutes,
                  forceResetOnFirstLogin: policy.forceResetOnFirstLogin,
                  mfaEnforced: policy.mfaEnforced,
                })
              }
            >
              Save policy
            </Button>
          </AdminGlassCard>
        ) : null}
      </AdminShell>
    </DashboardShell>
  );
}
