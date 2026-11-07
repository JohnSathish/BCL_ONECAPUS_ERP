'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminGlassCard, AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  acceptSecurityFile,
  acknowledgeSecurityAlert,
  exportSecurityTrail,
  fetchSecurityAlerts,
  fetchSecurityDashboard,
  fetchSecurityIntegrity,
  fetchSecurityPolicy,
  fetchSecurityTrail,
  scanSecurityFiles,
  updateSecurityPolicy,
  type SecurityPolicy,
} from '@/services/security-centre';
import { formatDisplayDateTime } from '@/utils/format-date';

type Tab = 'overview' | 'alerts' | 'audit' | 'integrity' | 'protection';

const SOURCES = [
  ['security', 'Security events'],
  ['students', 'Student profiles'],
  ['exams', 'Examination marks'],
  ['attendance', 'Attendance'],
  ['fees', 'Fees and payments'],
  ['payroll', 'Salary records'],
  ['staff', 'Staff records'],
  ['permissions', 'Denied permissions'],
  ['platform', 'Roles and configuration'],
] as const;

function severityVariant(severity: string): 'destructive' | 'secondary' | 'outline' {
  if (
    severity === 'CRITICAL' ||
    severity === 'critical' ||
    severity === 'HIGH' ||
    severity === 'high'
  ) {
    return 'destructive';
  }
  if (severity === 'MEDIUM' || severity === 'medium') return 'secondary';
  return 'outline';
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SecurityCentrePage() {
  useRequireAuth();
  const { isAdmin, roles } = usePermissions();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [source, setSource] = useState('security');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [alertStatus, setAlertStatus] = useState('');
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);

  const dashboardQ = useQuery({
    queryKey: ['security-centre', 'dashboard'],
    queryFn: fetchSecurityDashboard,
    enabled: isAdmin && tab === 'overview',
  });
  const alertsQ = useQuery({
    queryKey: ['security-centre', 'alerts', alertStatus],
    queryFn: () => fetchSecurityAlerts(alertStatus),
    enabled: isAdmin && tab === 'alerts',
  });
  const trailQ = useQuery({
    queryKey: ['security-centre', 'trail', source, search],
    queryFn: () => fetchSecurityTrail({ source, q: search || undefined, limit: '40' }),
    enabled: isAdmin && tab === 'audit',
  });
  const integrityQ = useQuery({
    queryKey: ['security-centre', 'integrity'],
    queryFn: fetchSecurityIntegrity,
    enabled: isAdmin && tab === 'integrity',
  });
  const policyQ = useQuery({
    queryKey: ['security-centre', 'policy'],
    queryFn: fetchSecurityPolicy,
    enabled: isAdmin && tab === 'protection',
  });

  useEffect(() => {
    if (policyQ.data) setPolicy(policyQ.data);
  }, [policyQ.data]);

  const ack = useMutation({
    mutationFn: acknowledgeSecurityAlert,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['security-centre', 'alerts'] });
      void qc.invalidateQueries({ queryKey: ['security-centre', 'dashboard'] });
    },
  });
  const scan = useMutation({
    mutationFn: scanSecurityFiles,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['security-centre', 'integrity'] }),
  });
  const accept = useMutation({
    mutationFn: acceptSecurityFile,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['security-centre', 'integrity'] }),
  });
  const savePolicy = useMutation({
    mutationFn: updateSecurityPolicy,
    onSuccess: (saved) => {
      setPolicy(saved);
      void qc.invalidateQueries({ queryKey: ['security-centre', 'policy'] });
    },
  });

  if (!isAdmin) {
    return (
      <DashboardShell role="admin" title="Security Centre">
        <AdminShell>
          <AdminPageHeader
            title="Security Centre"
            subtitle="This area is limited to super administrators."
          />
          <AdminGlassCard className="p-5 text-sm text-muted-foreground">
            Your roles ({roles.join(', ') || 'none'}) cannot open security monitoring.
          </AdminGlassCard>
        </AdminShell>
      </DashboardShell>
    );
  }

  const cards = dashboardQ.data
    ? [
        ['Successful sign-ins', dashboardQ.data.successfulLogins],
        ['Failed sign-ins (24h)', dashboardQ.data.failedLogins24h],
        ['Suspicious addresses', dashboardQ.data.suspiciousIps.length],
        ['Unauthorized API (7d)', dashboardQ.data.unauthorizedApi7d],
        ['Accounts locked now', dashboardQ.data.accountLockouts],
        ['Lockout events (7d)', dashboardQ.data.lockouts7d],
        ['Sensitive changes (24h)', dashboardQ.data.sensitiveModifications24h],
        ['Open alerts', dashboardQ.data.openAlerts],
      ]
    : [];

  return (
    <DashboardShell role="admin" title="Security Centre">
      <AdminShell>
        <AdminPageHeader
          title="Security Centre"
          subtitle="Sign-in monitoring, tamper-evident history, and threat alerts for super administrators."
        />
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ['overview', 'Overview'],
              ['alerts', 'Alerts'],
              ['audit', 'Audit trail'],
              ['integrity', 'Integrity'],
              ['protection', 'Protection'],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? 'default' : 'outline'}
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>

        {tab === 'overview' && dashboardQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading security overview…</p>
        ) : null}
        {tab === 'overview' && dashboardQ.isError ? (
          <AdminGlassCard className="p-5 text-sm">
            Security Centre data is unavailable. Apply the security centre database migration, then
            reload.
          </AdminGlassCard>
        ) : null}

        {tab === 'overview' && dashboardQ.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map(([label, value]) => (
                <AdminGlassCard key={String(label)} className="p-4">
                  <p className="text-xs uppercase text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold">{value}</p>
                </AdminGlassCard>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <AdminGlassCard className="p-4">
                <h2 className="mb-2 text-sm font-semibold">Server status</h2>
                <dl className="space-y-1 text-sm">
                  {Object.entries(dashboardQ.data.server).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="text-right">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </AdminGlassCard>
              <AdminGlassCard className="p-4">
                <h2 className="mb-2 text-sm font-semibold">Last successful backup</h2>
                <p className="text-sm">
                  {dashboardQ.data.backup.lastSuccessAt
                    ? formatDisplayDateTime(dashboardQ.data.backup.lastSuccessAt)
                    : 'No successful backup yet'}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Encryption{' '}
                  {dashboardQ.data.backup.encryptionConfigured ? 'configured' : 'not configured'}
                </p>
                <h3 className="mb-2 mt-4 text-sm font-semibold">Suspicious addresses (24h)</h3>
                {dashboardQ.data.suspiciousIps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None over the threshold.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {dashboardQ.data.suspiciousIps.map((row) => (
                      <li key={row.ipAddress} className="flex justify-between font-mono">
                        <span>{row.ipAddress}</span>
                        <span>{row.failures} failures</span>
                      </li>
                    ))}
                  </ul>
                )}
              </AdminGlassCard>
            </div>
            <AdminGlassCard className="p-4">
              <h2 className="mb-2 text-sm font-semibold">Recent incidents</h2>
              {dashboardQ.data.recentAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No security alerts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {dashboardQ.data.recentAlerts.map((alert) => (
                    <li key={alert.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant={severityVariant(alert.severity)}>{alert.severity}</Badge>
                      <span className="font-medium">{alert.title}</span>
                      <span className="text-muted-foreground">
                        {formatDisplayDateTime(alert.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AdminGlassCard>
          </div>
        ) : null}

        {tab === 'alerts' ? (
          <AdminGlassCard className="overflow-x-auto p-0">
            <div className="flex gap-2 p-3">
              <Button
                size="sm"
                variant={alertStatus === '' ? 'default' : 'outline'}
                onClick={() => setAlertStatus('')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={alertStatus === 'open' ? 'default' : 'outline'}
                onClick={() => setAlertStatus('open')}
              >
                Open
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Alert</th>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(alertsQ.data?.items ?? []).map((alert) => (
                  <tr key={alert.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <Badge variant={severityVariant(alert.severity)}>{alert.severity}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-muted-foreground">{alert.summary}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">{formatDisplayDateTime(alert.createdAt)}</td>
                    <td className="px-3 py-2">
                      {alert.status === 'open' ? (
                        <Button size="sm" variant="outline" onClick={() => ack.mutate(alert.id)}>
                          Acknowledge
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Acknowledged</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminGlassCard>
        ) : null}

        {tab === 'audit' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <Label className="grid gap-1 text-xs">
                Source
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                >
                  {SOURCES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Label>
              <Label className="grid gap-1 text-xs">
                Search
                <Input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Action, summary, or address"
                />
              </Label>
              <Button size="sm" onClick={() => setSearch(q)}>
                Filter
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const file = await exportSecurityTrail({ source, q: search || undefined });
                  downloadCsv(file.filename, file.csv);
                }}
              >
                Export CSV
              </Button>
            </div>
            <AdminGlassCard className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {(trailQ.data?.items ?? []).map((row) => (
                    <tr
                      key={`${row.source}-${row.id}`}
                      className="border-b border-border/60 align-top"
                    >
                      <td className="px-3 py-2 text-xs">{formatDisplayDateTime(row.at)}</td>
                      <td className="px-3 py-2">
                        <p>{row.summary}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.module} · {row.action}
                        </p>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.actorUserId ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.entityId ?? '—'}
                        {row.ipAddress ? <p>{row.ipAddress}</p> : null}
                        {row.previousValue != null || row.newValue != null ? (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-muted-foreground">
                              Values
                            </summary>
                            <pre className="mt-1 max-w-md whitespace-pre-wrap break-all text-[11px]">
                              {JSON.stringify(
                                { previous: row.previousValue, updated: row.newValue },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminGlassCard>
          </div>
        ) : null}

        {tab === 'integrity' && integrityQ.data ? (
          <div className="space-y-3">
            <AdminGlassCard className="p-4 text-sm">
              <p>
                Recent hash chain: {integrityQ.data.chain.ok ? 'intact' : 'broken'} (
                {integrityQ.data.chain.checked} events).
              </p>
              <p className="mt-1 text-muted-foreground">{integrityQ.data.chain.limitation}</p>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => scan.mutate()}
                disabled={scan.isPending}
              >
                Scan watched files
              </Button>
            </AdminGlassCard>
            <AdminGlassCard className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {integrityQ.data.files.files.map((file) => (
                    <tr key={file.relativePath} className="border-b border-border/60">
                      <td className="px-3 py-2 font-mono text-xs">{file.relativePath}</td>
                      <td className="px-3 py-2">{file.status}</td>
                      <td className="px-3 py-2">
                        {file.status === 'CHANGED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => accept.mutate(file.relativePath)}
                          >
                            Accept checksum
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {integrityQ.data.files.files.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-muted-foreground" colSpan={3}>
                        No baseline yet. Scan watched files to record the current checksums.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </AdminGlassCard>
          </div>
        ) : null}

        {tab === 'protection' && policy ? (
          <AdminGlassCard className="grid max-w-xl gap-3 p-4">
            {(
              [
                ['maxFailures', 'Failed attempts before lock'],
                ['windowMinutes', 'Failure window (minutes)'],
                ['lockMinutes', 'Lock duration (minutes)'],
                ['escalatedLockMinutes', 'Escalated lock (minutes)'],
                ['failedLoginAlertThreshold', 'Failed sign-in alert threshold'],
                ['suspiciousIpMinIdentifiers', 'Accounts per suspicious address'],
                ['unauthorizedApiThreshold', 'Denied API alert threshold'],
                ['bulkDownloadThreshold', 'Bulk download threshold'],
                ['bulkMutationThreshold', 'Mass change threshold'],
              ] as const
            ).map(([key, label]) => (
              <Label key={key} className="grid gap-1 text-xs">
                {label}
                <Input
                  type="number"
                  value={policy[key]}
                  onChange={(event) => setPolicy({ ...policy, [key]: Number(event.target.value) })}
                />
              </Label>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policy.notifyInApp}
                onChange={(event) => setPolicy({ ...policy, notifyInApp: event.target.checked })}
              />
              In-app notices to super administrators
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policy.notifyEmail}
                onChange={(event) => setPolicy({ ...policy, notifyEmail: event.target.checked })}
              />
              Email notices to super administrators
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policy.fileIntegrityEnabled}
                onChange={(event) =>
                  setPolicy({ ...policy, fileIntegrityEnabled: event.target.checked })
                }
              />
              Hourly file integrity checks
            </label>
            <Button
              size="sm"
              onClick={() => savePolicy.mutate(policy)}
              disabled={savePolicy.isPending}
            >
              Save protection settings
            </Button>
          </AdminGlassCard>
        ) : null}
      </AdminShell>
    </DashboardShell>
  );
}
