'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Code2,
  Database,
  Download,
  Fingerprint,
  Globe,
  HardDrive,
  History,
  Info,
  KeyRound,
  Lock,
  RotateCcw,
  ScrollText,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { fetchSecuritySettings } from '@/services/administration';
import type { SecuritySettings } from '@/types/administration';
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
  type SecurityDashboard,
  type SecurityPolicy,
} from '@/services/security-centre';
import { cn } from '@/utils/cn';
import { formatDisplayDateTime } from '@/utils/format-date';

type Tab = 'overview' | 'alerts' | 'audit' | 'integrity' | 'protection';

const TABS: Array<{ id: Tab; label: string; icon: typeof Shield }> = [
  { id: 'overview', label: 'Overview', icon: Shield },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'audit', label: 'Audit Trail', icon: ScrollText },
  { id: 'integrity', label: 'Integrity', icon: Fingerprint },
  { id: 'protection', label: 'Protection', icon: Lock },
];

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

const POLICY_DEFAULTS: SecurityPolicy = {
  maxFailures: 8,
  windowMinutes: 20,
  lockMinutes: 5,
  escalatedLockMinutes: 15,
  failedLoginAlertThreshold: 5,
  suspiciousIpMinIdentifiers: 4,
  unauthorizedApiThreshold: 10,
  bulkDownloadThreshold: 15,
  bulkMutationThreshold: 25,
  notifyInApp: true,
  notifyEmail: true,
  fileIntegrityEnabled: true,
};

type NumericPolicyKey = {
  [K in keyof SecurityPolicy]: SecurityPolicy[K] extends number ? K : never;
}[keyof SecurityPolicy];

const PROTECTION_FIELDS: Array<{
  key: NumericPolicyKey;
  label: string;
  unit: string;
  hint: string;
}> = [
  {
    key: 'maxFailures',
    label: 'Failed attempts before lock',
    unit: 'attempts',
    hint: 'Sign-in attempts from the same address before the account locks.',
  },
  {
    key: 'windowMinutes',
    label: 'Failure window',
    unit: 'minutes',
    hint: 'How far back failed attempts are counted.',
  },
  {
    key: 'lockMinutes',
    label: 'Lock duration',
    unit: 'minutes',
    hint: 'How long the first lock lasts.',
  },
  {
    key: 'escalatedLockMinutes',
    label: 'Escalated lock (repeat offenders)',
    unit: 'minutes',
    hint: 'Longer lock after repeated lockouts.',
  },
  {
    key: 'failedLoginAlertThreshold',
    label: 'Failed sign-in alert threshold',
    unit: 'attempts',
    hint: 'Failures that raise a security alert.',
  },
  {
    key: 'suspiciousIpMinIdentifiers',
    label: 'Accounts per suspicious address',
    unit: 'accounts',
    hint: 'Different accounts failing from one address before it is flagged.',
  },
  {
    key: 'unauthorizedApiThreshold',
    label: 'Denied API alert threshold',
    unit: 'attempts',
    hint: 'Denied API calls that raise an alert.',
  },
  {
    key: 'bulkDownloadThreshold',
    label: 'Bulk download threshold',
    unit: 'requests',
    hint: 'Downloads that raise a bulk-export alert.',
  },
  {
    key: 'bulkMutationThreshold',
    label: 'Mass change threshold',
    unit: 'records',
    hint: 'Records changed in one action that raise an alert.',
  },
];

const SERVER_LABELS: Record<string, string> = {
  nodeEnv: 'Environment',
  jwtConfigured: 'JWT Configured',
  backupEncryptionConfigured: 'Backup Encryption',
  globalRateLimit: 'Global Rate Limit',
  validation: 'Input Validation',
  authentication: 'Authentication',
  authorization: 'Authorization',
  securityCentre: 'Security Centre',
  appendOnlyAudit: 'Append Only Audit',
  checkedAt: 'Last Checked At',
};

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatCount(value: number) {
  return value.toLocaleString('en-IN');
}

function formatEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function periodChange(current: number, previous: number, caption: string) {
  if (previous <= 0) {
    return {
      text: current === 0 ? `No change ${caption}` : `${formatCount(current)} ${caption}`,
      up: current > 0,
      flat: current === 0,
    };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? '+' : '';
  return { text: `${sign}${pct}% ${caption}`, up: pct > 0, flat: pct === 0 };
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-white/80 bg-white/90 shadow-[0_18px_40px_-28px_rgba(37,99,235,0.65)] backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </section>
  );
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
    enabled: isAdmin && (tab === 'overview' || tab === 'protection'),
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
  const settingsQ = useQuery({
    queryKey: ['security-settings'],
    queryFn: fetchSecuritySettings,
    enabled: isAdmin && tab === 'protection',
  });
  const policyTrailQ = useQuery({
    queryKey: ['security-centre', 'policy-updated'],
    queryFn: () => fetchSecurityTrail({ source: 'security', limit: '30' }),
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
      void qc.invalidateQueries({ queryKey: ['security-centre', 'policy-updated'] });
    },
  });

  return (
    <DashboardShell role="admin" title="Security Centre">
      <div className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,0.45),transparent_32%),linear-gradient(180deg,#f3f8ff_0%,#f7fbff_42%,#ffffff_100%)] p-3 sm:p-5">
        <div
          className="pointer-events-none absolute -right-8 -top-10 hidden h-48 w-64 lg:block"
          aria-hidden
        >
          <div className="absolute inset-6 rounded-full bg-sky-200/70 blur-3xl" />
          <Shield className="absolute right-8 top-6 h-28 w-28 text-sky-400/90" strokeWidth={1.15} />
          <Lock className="absolute right-[4.3rem] top-16 h-8 w-8 text-sky-700" />
        </div>

        <header className="relative mb-4 flex flex-wrap items-start gap-3 pr-4">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/30">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Security Centre
            </h1>
            <p className="text-sm text-slate-500">
              Sign-in monitoring, tamper-evident history, and threat alerts for super
              administrators.
            </p>
          </div>
        </header>

        {!isAdmin ? (
          <Panel className="relative p-5 text-sm text-slate-600">
            This area is limited to super administrators. Your roles ({roles.join(', ') || 'none'})
            cannot open security monitoring.
          </Panel>
        ) : (
          <>
            <div
              className="relative mb-4 inline-flex max-w-full flex-wrap gap-1 rounded-full bg-white/80 p-1 shadow-sm"
              role="tablist"
              aria-label="Security Centre sections"
            >
              {TABS.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(item.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition',
                      active
                        ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {tab === 'overview' ? (
              <Overview
                loading={dashboardQ.isLoading}
                error={dashboardQ.isError}
                data={dashboardQ.data}
                onViewEvents={() => setTab('audit')}
              />
            ) : null}

            {tab === 'alerts' ? (
              <Panel className="overflow-x-auto">
                <div className="flex gap-2 border-b border-slate-100 p-3">
                  <FilterChip active={alertStatus === ''} onClick={() => setAlertStatus('')}>
                    All
                  </FilterChip>
                  <FilterChip
                    active={alertStatus === 'open'}
                    onClick={() => setAlertStatus('open')}
                  >
                    Open
                  </FilterChip>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2">Severity</th>
                      <th className="px-4 py-2">Alert</th>
                      <th className="px-4 py-2">When</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(alertsQ.data?.items ?? []).map((alert) => (
                      <tr key={alert.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <SeverityPill severity={alert.severity} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{alert.title}</p>
                          <p className="text-slate-500">{alert.summary}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatDisplayDateTime(alert.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {alert.status === 'open' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => ack.mutate(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">Acknowledged</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {alertsQ.data && alertsQ.data.items.length === 0 ? (
                      <tr>
                        <td className="px-4 py-8 text-slate-500" colSpan={4}>
                          No alerts in this view.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </Panel>
            ) : null}

            {tab === 'audit' ? (
              <div className="space-y-3">
                <Panel className="flex flex-wrap items-end gap-2 p-3">
                  <Label className="grid gap-1 text-xs text-slate-500">
                    Source
                    <select
                      className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-800"
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
                  <Label className="grid gap-1 text-xs text-slate-500">
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
                </Panel>
                <Panel className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">When</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Actor</th>
                        <th className="px-4 py-3">Record</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(trailQ.data?.items ?? []).map((row) => (
                        <tr
                          key={`${row.source}-${row.id}`}
                          className="border-t border-slate-100 align-top"
                        >
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatDisplayDateTime(row.at)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-800">{row.summary}</p>
                            <p className="text-xs text-slate-400">
                              {row.module} · {row.action}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{row.actorUserId ?? '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {row.entityId ?? '—'}
                            {row.ipAddress ? <p>{row.ipAddress}</p> : null}
                            {row.previousValue != null || row.newValue != null ? (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-slate-400">Values</summary>
                                <pre className="mt-1 max-w-md whitespace-pre-wrap break-all text-[11px] text-slate-600">
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
                </Panel>
              </div>
            ) : null}

            {tab === 'integrity' && integrityQ.data ? (
              <div className="space-y-3">
                <Panel className="p-4 text-sm text-slate-700">
                  <p>
                    Recent hash chain: {integrityQ.data.chain.ok ? 'intact' : 'broken'} (
                    {integrityQ.data.chain.checked} events).
                  </p>
                  <p className="mt-1 text-slate-500">{integrityQ.data.chain.limitation}</p>
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => scan.mutate()}
                    disabled={scan.isPending}
                  >
                    Scan watched files
                  </Button>
                </Panel>
                <Panel className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">File</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {integrityQ.data.files.files.map((file) => (
                        <tr key={file.relativePath} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono text-xs">{file.relativePath}</td>
                          <td className="px-4 py-3">{file.status}</td>
                          <td className="px-4 py-3">
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
                          <td className="px-4 py-6 text-slate-500" colSpan={3}>
                            No baseline yet. Scan watched files to record the current checksums.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </Panel>
              </div>
            ) : null}

            {tab === 'protection' ? (
              <ProtectionBoard
                loading={policyQ.isLoading}
                error={policyQ.isError}
                policy={policy}
                settings={settingsQ.data}
                openAlerts={dashboardQ.data?.openAlerts}
                lastUpdated={
                  policyTrailQ.data?.items.find((row) => row.action === 'monitor_policy_updated')
                    ?.at
                }
                saving={savePolicy.isPending}
                saveError={savePolicy.isError}
                onChange={setPolicy}
                onSave={() => {
                  if (policy) savePolicy.mutate(policy);
                }}
                onReset={() => setPolicy({ ...POLICY_DEFAULTS })}
                onHistory={() => {
                  setSource('security');
                  setSearch('');
                  setQ('');
                  setTab('audit');
                }}
              />
            ) : null}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function formatMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  if (minutes % 60 === 0 && minutes >= 60) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${minutes} minutes`;
}

function ProtectionBoard({
  loading,
  error,
  policy,
  settings,
  openAlerts,
  lastUpdated,
  saving,
  saveError,
  onChange,
  onSave,
  onReset,
  onHistory,
}: {
  loading: boolean;
  error: boolean;
  policy: SecurityPolicy | null;
  settings: SecuritySettings | undefined;
  openAlerts: number | undefined;
  lastUpdated: string | undefined;
  saving: boolean;
  saveError: boolean;
  onChange: (policy: SecurityPolicy) => void;
  onSave: () => void;
  onReset: () => void;
  onHistory: () => void;
}) {
  if (loading) {
    return <div className="h-96 animate-pulse rounded-2xl bg-white/70" />;
  }
  if (error || !policy) {
    return (
      <Panel className="p-5 text-sm text-slate-600">
        Protection settings are unavailable. Apply the security centre database migration, then
        reload.
      </Panel>
    );
  }

  const strongPassword = Boolean(
    settings?.requireUppercase &&
    settings.requireLowercase &&
    settings.requireNumber &&
    settings.requireSpecial,
  );
  const historyCount = settings?.passwordHistoryCount ?? 5;
  const healthy = openAlerts === 0;
  const controls = [
    { name: 'Data Change Monitoring', state: 'Active', on: true, icon: Database },
    {
      name: 'File Integrity Monitoring',
      state: policy.fileIntegrityEnabled ? 'Active' : 'Off',
      on: policy.fileIntegrityEnabled,
      icon: Fingerprint,
    },
    { name: 'Two-Factor Authentication', state: 'Active', on: true, icon: KeyRound },
    { name: 'Security Logging', state: 'Active', on: true, icon: ScrollText },
    {
      name: 'Real-time Alerts',
      state: policy.notifyInApp || policy.notifyEmail ? 'Active' : 'Off',
      on: policy.notifyInApp || policy.notifyEmail,
      icon: Bell,
    },
  ];

  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Protection Settings</h2>
            <p className="text-xs text-slate-500">
              Configure access security, rate limits, session policy and threat protection for your
              ERP.
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">
            Current Protection Status{' '}
            <span
              className={cn(
                'ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                healthy ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700',
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {openAlerts === undefined ? 'Checking' : healthy ? 'Active' : 'Review'}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {openAlerts === undefined
              ? 'Reading open alerts'
              : healthy
                ? 'No critical issues'
                : `${formatCount(openAlerts)} open alert${openAlerts === 1 ? '' : 's'}`}
            {lastUpdated ? ` · Last updated: ${formatEventTime(lastUpdated)}` : ''}
          </p>
        </div>
      </Panel>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Panel className="p-4">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Login & Access Protection</h3>
              <p className="text-xs text-slate-500">
                Configure login attempt limits and automatic account lockout.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {PROTECTION_FIELDS.map((field) => (
              <label
                key={field.key}
                title={field.hint}
                className="grid items-center gap-3 sm:grid-cols-[1fr_auto]"
              >
                <span className="flex items-center gap-1.5 text-sm text-slate-700">
                  {field.label}
                  <Info className="h-3.5 w-3.5 text-slate-400" aria-label={field.hint} />
                </span>
                <span className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={Number(policy[field.key])}
                    onChange={(event) =>
                      onChange({ ...policy, [field.key]: Number(event.target.value) })
                    }
                    className="h-9 w-[4.5rem] rounded-lg border-slate-200 bg-slate-50 text-center"
                  />
                  <span className="w-16 text-xs text-slate-400">{field.unit}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <NoticeToggle
              checked={policy.notifyInApp}
              title="In-app notices to super administrators"
              detail="Show security alerts inside the ERP."
              onChange={(checked) => onChange({ ...policy, notifyInApp: checked })}
            />
            <NoticeToggle
              checked={policy.notifyEmail}
              title="Email notices to super administrators"
              detail="Send critical security alerts by email."
              onChange={(checked) => onChange({ ...policy, notifyEmail: checked })}
            />
            <NoticeToggle
              checked={policy.fileIntegrityEnabled}
              title="File integrity checks"
              detail="Keep checksums for watched application files."
              onChange={(checked) => onChange({ ...policy, fileIntegrityEnabled: checked })}
            />
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-500">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Attack & Access Controls</h3>
                <p className="text-xs text-slate-500">
                  Additional protection against common attacks and abuse.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <PlatformControl
                icon={Globe}
                title="IP Address Blocking"
                detail="Repeated failures from the same address lock that sign-in."
              />
              <PlatformControl
                icon={Shield}
                title="Brute-force Protection"
                detail="Detect and block repeated login attempts."
              />
              <PlatformControl
                icon={Code2}
                title="API Access Protection"
                detail="Restrict and monitor unauthorized API requests."
              />
            </div>
          </Panel>

          <Panel className="p-4">
            <h3 className="text-sm font-semibold text-slate-900">Rate Limiting</h3>
            <p className="mb-3 text-xs text-slate-500">
              Limit excessive requests from a single user or IP address.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <RateTile
                icon={UserRound}
                label="Login Attempts"
                value="60"
                unit="/ 15 min"
                className="bg-sky-50 text-sky-700"
              />
              <RateTile
                icon={Code2}
                label="API Requests"
                value="300"
                unit="/ minute"
                className="bg-violet-50 text-violet-700"
              />
              <RateTile
                icon={Download}
                label="Download alerts"
                value={formatCount(policy.bulkDownloadThreshold)}
                unit="requests"
                className="bg-amber-50 text-amber-700"
              />
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Session & Password Policy</h3>
                <p className="text-xs text-slate-500">
                  Current inactivity limit, session length, and password rules.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyChoice label="Session timeout (inactivity)" value="15 minutes" />
              <ReadOnlyChoice
                label="Maximum session duration"
                value={
                  settings ? formatMinutes(settings.sessionTimeoutMinutes) : 'Reading settings'
                }
              />
              <ReadOnlyChoice
                label="Minimum password length"
                value={settings ? `${settings.minPasswordLength} characters` : 'Reading settings'}
                className="sm:col-span-2"
              />
            </div>
            <div className="mt-3 space-y-2">
              <ReadOnlyCheck
                checked={settings ? strongPassword : true}
                label="Require strong password (upper, lower, number, special character)"
              />
              <ReadOnlyCheck
                checked={historyCount > 0}
                label={`Prevent reuse of last ${historyCount} passwords`}
              />
            </div>
          </Panel>

          <Panel className="p-4">
            <h3 className="text-sm font-semibold text-slate-900">Security Controls</h3>
            <p className="mb-3 text-xs text-slate-500">
              System-wide protection and monitoring options.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {controls.map((control) => (
                <div
                  key={control.name}
                  className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-2 py-3 text-center"
                >
                  <control.icon className="mx-auto h-4 w-4 text-emerald-600" />
                  <p className="mt-2 text-[11px] font-medium leading-tight text-slate-700">
                    {control.name}
                  </p>
                  <p
                    className={cn(
                      'mt-2 inline-flex items-center gap-1 text-[11px] font-medium',
                      control.on ? 'text-emerald-600' : 'text-slate-400',
                    )}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    {control.state}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={onSave}
          disabled={saving}
          className="rounded-full bg-sky-600 px-4 text-white hover:bg-sky-700"
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          {saving ? 'Saving…' : 'Save Protection Settings'}
        </Button>
        <Button type="button" variant="outline" onClick={onReset} className="rounded-full bg-white">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to Default
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onHistory}
          className="rounded-full bg-white"
        >
          <History className="mr-2 h-4 w-4" />
          View Change History
        </Button>
        {saveError ? (
          <p className="text-sm text-rose-600">The settings could not be saved. Try again.</p>
        ) : null}
      </div>
    </div>
  );
}

function NoticeToggle({
  checked,
  title,
  detail,
  onChange,
}: {
  checked: boolean;
  title: string;
  detail: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-800">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-sky-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="font-medium">{title}</span>
        <span className="block text-xs font-normal text-slate-500">{detail}</span>
      </span>
    </label>
  );
}

function PlatformControl({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Shield;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 text-sky-500" />
        <div>
          <p className="text-sm font-medium text-slate-800">{title}</p>
          <p className="text-xs text-slate-500">{detail}</p>
        </div>
      </div>
      <span
        className="relative inline-flex h-6 w-11 shrink-0 rounded-full bg-sky-500"
        role="img"
        aria-label={`${title} is on`}
      >
        <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
      </span>
    </div>
  );
}

function RateTile({
  icon: Icon,
  label,
  value,
  unit,
  className,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
  unit: string;
  className: string;
}) {
  return (
    <div className={cn('rounded-2xl px-3 py-3', className)}>
      <Icon className="h-4 w-4" />
      <p className="mt-2 text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-xs opacity-80">{unit}</p>
    </div>
  );
}

function ReadOnlyChoice({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 flex items-center gap-1.5 text-sm text-slate-700">
        {label}
        <Info className="h-3.5 w-3.5 text-slate-400" />
      </p>
      <div className="flex h-10 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800">
        {value}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </div>
    </div>
  );
}

function ReadOnlyCheck({ checked, label }: { checked: boolean; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 accent-sky-600" checked={checked} disabled />
      {label}
    </p>
  );
}

function Overview({
  loading,
  error,
  data,
  onViewEvents,
}: {
  loading: boolean;
  error: boolean;
  data: SecurityDashboard | undefined;
  onViewEvents: () => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-white/70" />
        ))}
      </div>
    );
  }
  if (error || !data) {
    return (
      <Panel className="p-5 text-sm text-slate-600">
        Security Centre data is unavailable. Apply the security centre database migration, then
        reload.
      </Panel>
    );
  }

  const comparison = data.comparison;
  const successDelta = periodChange(
    comparison?.successfulLogins7d ?? 0,
    comparison?.successfulLoginsPrev7d ?? 0,
    'vs previous 7 days',
  );
  const failedDelta = periodChange(
    data.failedLogins24h,
    comparison?.failedLoginsPrev24h ?? 0,
    'vs previous 24h',
  );
  const apiDelta = periodChange(
    data.unauthorizedApi7d,
    comparison?.unauthorizedApiPrev7d ?? 0,
    'vs previous 7 days',
  );
  const lockoutDelta = periodChange(
    data.lockouts7d,
    comparison?.lockoutsPrev7d ?? 0,
    'vs previous 7 days',
  );
  const sensitiveDelta = periodChange(
    data.sensitiveModifications24h,
    comparison?.sensitiveModificationsPrev24h ?? 0,
    'vs previous 24h',
  );
  const activity = data.activity7d ?? [];
  const events =
    data.recentEvents && data.recentEvents.length > 0
      ? data.recentEvents
      : data.recentAlerts.map((alert) => ({
          id: alert.id,
          createdAt: alert.createdAt,
          summary: alert.title,
          actor: alert.severity,
          ipAddress: null,
        }));

  const metrics: Array<{
    label: string;
    value: string;
    note: string;
    good: boolean;
    icon: typeof Shield;
    tint: string;
  }> = [
    {
      label: 'Successful Sign-ins',
      value: formatCount(data.successfulLogins),
      note: comparison ? successDelta.text : 'All recorded sign-ins',
      good: successDelta.flat || successDelta.up,
      icon: UserRound,
      tint: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'Failed Sign-ins (24h)',
      value: formatCount(data.failedLogins24h),
      note: comparison ? failedDelta.text : 'Failures in the last 24 hours',
      good: failedDelta.flat || !failedDelta.up,
      icon: ShieldAlert,
      tint: 'bg-rose-50 text-rose-500',
    },
    {
      label: 'Suspicious Addresses',
      value: formatCount(data.suspiciousIps.length),
      note:
        data.suspiciousIps.length === 0
          ? 'None over 5 failures'
          : `${formatCount(data.suspiciousIps.length)} over 5 failures in 24h`,
      good: data.suspiciousIps.length === 0,
      icon: Globe,
      tint: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Unauthorized API (7d)',
      value: formatCount(data.unauthorizedApi7d),
      note: comparison ? apiDelta.text : 'Denied calls in the last 7 days',
      good: apiDelta.flat || !apiDelta.up,
      icon: Code2,
      tint: 'bg-violet-50 text-violet-600',
    },
    {
      label: 'Accounts Locked Now',
      value: formatCount(data.accountLockouts),
      note: data.accountLockouts === 0 ? 'No locked accounts' : 'Still inside the lock window',
      good: data.accountLockouts === 0,
      icon: Lock,
      tint: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'Lockout Events (7d)',
      value: formatCount(data.lockouts7d),
      note: comparison ? lockoutDelta.text : 'Lockouts in the last 7 days',
      good: lockoutDelta.flat || !lockoutDelta.up,
      icon: CalendarClock,
      tint: 'bg-rose-50 text-rose-500',
    },
    {
      label: 'Sensitive Changes (24h)',
      value: formatCount(data.sensitiveModifications24h),
      note: comparison ? sensitiveDelta.text : 'Audited changes in the last 24 hours',
      good: sensitiveDelta.flat || !sensitiveDelta.up,
      icon: Database,
      tint: 'bg-sky-50 text-sky-600',
    },
    {
      label: 'Open Alerts',
      value: formatCount(data.openAlerts),
      note: data.openAlerts === 0 ? 'No active alerts' : 'Waiting for acknowledgement',
      good: data.openAlerts === 0,
      icon: TriangleAlert,
      tint: 'bg-orange-50 text-orange-500',
    },
  ];

  const serverEntries = Object.entries(data.server);
  const modules = [
    { name: 'Real-time Monitoring', state: 'Active', on: true },
    { name: 'Login Protection', state: 'Active', on: true },
    {
      name: 'Audit Logging',
      state: data.server.appendOnlyAudit ? 'Active' : 'Off',
      on: Boolean(data.server.appendOnlyAudit),
    },
    { name: 'File Integrity', state: 'Hash chain on', on: true },
    { name: 'Rate Limiting', state: '300/min', on: true },
    {
      name: 'Data Backup',
      state: data.backup.lastSuccessAt ? 'Automated' : 'No backup yet',
      on: Boolean(data.backup.lastSuccessAt),
    },
  ];

  return (
    <div className="relative space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel className="p-4 xl:col-span-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Threat Activity (Last 7 Days)</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#e8eef7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="failedSignIns"
                  name="Failed Sign-ins"
                  stroke="#3b82f6"
                  strokeWidth={2.4}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="suspiciousIps"
                  name="Suspicious IPs"
                  stroke="#8b5cf6"
                  strokeWidth={2.4}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="unauthorizedApi"
                  name="Unauthorized API"
                  stroke="#fb7185"
                  strokeWidth={2.4}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-4 xl:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Server className="h-4 w-4 text-sky-500" />
              Server Status
            </h2>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
              {data.server.jwtConfigured ? 'Healthy' : 'Check'}
            </span>
          </div>
          <dl className="space-y-2 text-sm">
            {serverEntries.map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-3">
                <dt className="text-slate-500">{SERVER_LABELS[key] ?? key}</dt>
                <dd className="max-w-[58%] text-right text-slate-800" title={String(value)}>
                  <StatusValue
                    value={key === 'checkedAt' ? formatDisplayDateTime(String(value)) : value}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className="grid gap-4 xl:col-span-3">
          <Panel className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <HardDrive className="h-4 w-4 text-sky-500" />
                Last Successful Backup
              </h2>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  data.backup.lastSuccessAt
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-700',
                )}
              >
                {data.backup.lastSuccessAt ? 'Completed' : 'None'}
              </span>
            </div>
            <p className="text-sm text-slate-800">
              {data.backup.lastSuccessAt
                ? formatEventTime(data.backup.lastSuccessAt)
                : 'No successful backup yet'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Encryption: {data.backup.encryptionConfigured ? 'Configured' : 'Not Configured'}
            </p>
            <Link
              href="/admin/administration/backups"
              className="mt-3 inline-flex rounded-full bg-sky-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-sky-500/30"
            >
              View Backup Logs
            </Link>
          </Panel>

          <Panel className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Suspicious Addresses (24h)</h2>
              <button
                type="button"
                className="text-xs font-medium text-sky-600"
                onClick={onViewEvents}
              >
                View All
              </button>
            </div>
            {data.suspiciousIps.length === 0 ? (
              <p className="text-sm text-slate-500">None over the threshold.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.suspiciousIps.map((row) => (
                  <li key={row.ipAddress} className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-700">{row.ipAddress}</span>
                    <span className="text-xs font-medium text-rose-500">
                      {row.failures} failures
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel className="overflow-hidden xl:col-span-7">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Recent Security Events</h2>
            <button
              type="button"
              className="text-xs font-medium text-sky-600"
              onClick={onViewEvents}
            >
              View All
            </button>
          </div>
          {events.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-slate-500">No security events yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {formatEventTime(event.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800">{event.summary}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{event.actor}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                      {event.ipAddress ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel className="p-4 xl:col-span-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Security Modules Status</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {modules.map((module) => (
              <div
                key={module.name}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
              >
                <span className="text-xs font-medium text-slate-700">{module.name}</span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium',
                    module.on ? 'text-emerald-600' : 'text-amber-700',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      module.on ? 'bg-emerald-500' : 'bg-amber-500',
                    )}
                  />
                  {module.state}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  good,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  note: string;
  good: boolean;
  icon: typeof Shield;
  tint: string;
}) {
  return (
    <Panel className="p-4">
      <span className={cn('mb-3 grid h-9 w-9 place-items-center rounded-full', tint)}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className={cn('mt-1 text-xs font-medium', good ? 'text-emerald-600' : 'text-rose-500')}>
        {note}
      </p>
    </Panel>
  );
}

function StatusValue({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return (
      <span className={value ? 'text-emerald-600' : 'text-rose-500'}>
        {value ? 'True' : 'False'}
      </span>
    );
  }
  return <span className="line-clamp-2">{value}</span>;
}

function SeverityPill({ severity }: { severity: string }) {
  const upper = severity.toUpperCase();
  const tone =
    upper === 'CRITICAL' || upper === 'HIGH'
      ? 'bg-rose-50 text-rose-600'
      : upper === 'MEDIUM'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tone)}>{severity}</span>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium',
        active ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600',
      )}
    >
      {children}
    </button>
  );
}
