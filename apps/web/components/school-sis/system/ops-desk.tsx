'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import {
  cancelSchoolOpsJob,
  clearSchoolOpsCache,
  createSchoolOpsBackup,
  deleteSchoolOpsBackup,
  downloadSchoolOpsBackup,
  exportSchoolOpsLogs,
  fetchSchoolOpsAbout,
  fetchSchoolOpsAudit,
  fetchSchoolOpsBackups,
  fetchSchoolOpsCache,
  fetchSchoolOpsConfig,
  fetchSchoolOpsDashboard,
  fetchSchoolOpsJobs,
  fetchSchoolOpsLogs,
  fetchSchoolOpsMaintenance,
  fetchSchoolOpsStatus,
  fetchSchoolOpsStorage,
  purgeSchoolOpsLogs,
  restoreSchoolOpsBackup,
  retrySchoolOpsJob,
  saveSchoolOpsBackupSchedule,
  saveSchoolOpsConfig,
  saveSchoolOpsMaintenance,
  testSchoolOpsChannel,
  verifySchoolOpsBackup,
} from '@/services/school-ops';

const LINKS = [
  ['Dashboard', '/admin/school-sis/system'],
  ['Status', '/admin/school-sis/system/status'],
  ['Cache', '/admin/school-sis/system/cache'],
  ['Backups', '/admin/school-sis/system/backups'],
  ['Logs', '/admin/school-sis/system/logs'],
  ['Security & Audit', '/admin/school-sis/system/audit'],
  ['Jobs', '/admin/school-sis/system/jobs'],
  ['Storage', '/admin/school-sis/system/storage'],
  ['Maintenance', '/admin/school-sis/system/maintenance'],
  ['Configuration', '/admin/school-sis/system/configuration'],
  ['About & License', '/admin/school-sis/system/about'],
] as const;

function Panel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      {children}
    </div>
  );
}

function Tone({ value }: { value?: string | null }) {
  const v = String(value ?? '—');
  const tone = /healthy|operational|active|success/i.test(v)
    ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    : /warn|degraded|expiring/i.test(v)
      ? 'bg-amber-50 text-amber-800 ring-amber-200'
      : /crit|offline|expired|failed|suspended/i.test(v)
        ? 'bg-rose-50 text-rose-800 ring-rose-200'
        : 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span
      className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', tone)}
    >
      {v}
    </span>
  );
}

function str(v: unknown) {
  if (v == null) return '—';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function OpsDesk() {
  const path = usePathname() ?? '/admin/school-sis/system';
  const section =
    path.replace(/\/+$/, '') === '/admin/school-sis/system' ? 'dashboard' : path.split('/').pop()!;
  const ready = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    run: () => Promise<unknown>;
  } | null>(null);
  const [logQ, setLogQ] = useState({ level: '', module: '', search: '' });
  const [maint, setMaint] = useState({ enabled: false, message: '', start: '', end: '' });
  const [cfg, setCfg] = useState<Record<string, unknown>>({});

  const dash = useQuery({
    queryKey: ['ops-dash'],
    queryFn: fetchSchoolOpsDashboard,
    enabled: ready,
    refetchInterval: section === 'dashboard' ? 15_000 : false,
  });
  const status = useQuery({
    queryKey: ['ops-status'],
    queryFn: fetchSchoolOpsStatus,
    enabled: ready && ['status', 'dashboard'].includes(section),
    refetchInterval: section === 'status' ? 20_000 : false,
  });
  const cache = useQuery({
    queryKey: ['ops-cache'],
    queryFn: fetchSchoolOpsCache,
    enabled: ready && section === 'cache',
  });
  const backups = useQuery({
    queryKey: ['ops-backups'],
    queryFn: fetchSchoolOpsBackups,
    enabled: ready && section === 'backups',
  });
  const logs = useQuery({
    queryKey: ['ops-logs', logQ],
    queryFn: () => fetchSchoolOpsLogs({ ...logQ, limit: 50 }),
    enabled: ready && section === 'logs',
  });
  const audit = useQuery({
    queryKey: ['ops-audit'],
    queryFn: fetchSchoolOpsAudit,
    enabled: ready && section === 'audit',
  });
  const jobs = useQuery({
    queryKey: ['ops-jobs'],
    queryFn: fetchSchoolOpsJobs,
    enabled: ready && section === 'jobs',
  });
  const storage = useQuery({
    queryKey: ['ops-storage'],
    queryFn: fetchSchoolOpsStorage,
    enabled: ready && section === 'storage',
  });
  const maintenance = useQuery({
    queryKey: ['ops-maint'],
    queryFn: fetchSchoolOpsMaintenance,
    enabled: ready && section === 'maintenance',
  });
  const config = useQuery({
    queryKey: ['ops-cfg'],
    queryFn: fetchSchoolOpsConfig,
    enabled: ready && section === 'configuration',
  });
  const about = useQuery({
    queryKey: ['ops-about'],
    queryFn: fetchSchoolOpsAbout,
    enabled: ready && section === 'about',
  });

  const d = (dash.data ?? {}) as Record<string, unknown>;
  const license = (d.license ?? {}) as Record<string, unknown>;
  const schedule = ((backups.data as { schedule?: Record<string, unknown> } | undefined)
    ?.schedule ?? {}) as Record<string, unknown>;

  useEffect(() => {
    if (maintenance.data) {
      const m = maintenance.data as Record<string, unknown>;
      setMaint({
        enabled: Boolean(m.enabled),
        message: String(m.message ?? ''),
        start: m.start ? String(m.start).slice(0, 16) : '',
        end: m.end ? String(m.end).slice(0, 16) : '',
      });
    }
  }, [maintenance.data]);

  useEffect(() => {
    if (config.data) setCfg(config.data);
  }, [config.data]);

  const run = async (fn: () => Promise<unknown>, ok = 'Done') => {
    try {
      const res = await fn();
      setNotice(ok);
      await qc.invalidateQueries({ queryKey: ['ops'] });
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('ops-') });
      return res;
    } catch (e) {
      setNotice(apiErrorMessage(e));
      throw e;
    }
  };

  const cards = [
    ['Health', d.overall],
    ['API', d.api],
    ['Database', d.database],
    ['Redis', d.redis],
    ['CPU', `${str((d.cpu as number) ?? '—')}%`],
    ['Memory', str((d.memory as { usedPct?: number })?.usedPct) + '%'],
    ['Disk', str((d.disk as { usedPct?: number })?.usedPct) + '%'],
    ['DB size', d.databaseSize],
    ['Active users', d.activeUsers],
    ['Sessions', d.activeSessions],
    ['Failed logins 24h', d.failedLogins],
    ['ERP version', d.version],
    ['License', license.status],
    ['License expiry', license.expiry],
    ['Maintenance', (d.maintenance as { enabled?: boolean })?.enabled ? 'ON' : 'Off'],
    [
      'Last backup',
      (d.lastBackup as { at?: string })?.at
        ? new Date(String((d.lastBackup as { at?: string }).at)).toLocaleString()
        : 'Never',
    ],
  ];

  return (
    <div className="space-y-4 p-4 md:p-6" style={{ background: '#f4f7fb', minHeight: '100%' }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Operations
          </p>
          <h1 className="text-xl font-semibold text-slate-900">System &amp; Administration</h1>
          <p className="text-sm text-slate-500">
            Health, backups, logs and maintenance for St. Luke&apos;s School ERP.
          </p>
        </div>
        <GhostButton
          onClick={() =>
            void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('ops') })
          }
        >
          Refresh status
        </GhostButton>
      </div>
      <nav className="flex flex-wrap gap-2">
        {LINKS.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              path === href || (href !== '/admin/school-sis/system' && path.startsWith(href))
                ? 'border-blue-700 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-600',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {notice ? <p className="rounded-lg border bg-white px-3 py-2 text-sm">{notice}</p> : null}

      {section === 'dashboard' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, value]) => (
            <Panel key={String(label)} className="p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-lg font-semibold text-slate-900">{str(value)}</p>
                {/health|api|database|redis|license|maintenance/i.test(String(label)) ? (
                  <Tone value={str(value)} />
                ) : null}
              </div>
            </Panel>
          ))}
          <Panel className="sm:col-span-2">
            <p className="text-xs text-slate-500">Next scheduled backup</p>
            <p className="mt-1 font-medium">
              {d.nextBackup ? new Date(String(d.nextBackup)).toLocaleString() : '—'}
            </p>
          </Panel>
        </div>
      ) : null}

      {section === 'status' ? <StatusView data={status.data} /> : null}

      {section === 'cache' ? (
        <Panel>
          <div className="mb-3 flex flex-wrap gap-3 text-sm">
            <span>
              Redis{' '}
              <Tone
                value={
                  (cache.data as { connected?: boolean })?.connected ? 'Operational' : 'Offline'
                }
              />
            </span>
            <span>Keys {str((cache.data as { keys?: number })?.keys)}</span>
            <span>Memory {str((cache.data as { memoryPretty?: string })?.memoryPretty)}</span>
            <span>Hit rate {str((cache.data as { hitRate?: number })?.hitRate)}%</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {['application', 'configuration', 'api', 'session', 'redis'].map((scope) => (
              <GhostButton
                key={scope}
                onClick={() =>
                  setConfirm({
                    title: `Clear ${scope} cache`,
                    body: 'This cannot be undone. Redis credentials are never shown.',
                    run: () => run(() => clearSchoolOpsCache(scope), `${scope} cache cleared`),
                  })
                }
              >
                Clear {scope}
              </GhostButton>
            ))}
          </div>
        </Panel>
      ) : null}

      {section === 'backups' ? (
        <div className="space-y-3">
          <Panel>
            <p className="text-sm">
              Last backup:{' '}
              <strong>
                {str((backups.data as { lastBackup?: { status?: string } })?.lastBackup?.status)}
              </strong>
              {' · '}
              Next: {str((backups.data as { nextBackup?: string })?.nextBackup)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton
                onClick={() =>
                  run(() => createSchoolOpsBackup('DATABASE'), 'Database backup queued')
                }
              >
                Database backup
              </PrimaryButton>
              <GhostButton
                onClick={() => run(() => createSchoolOpsBackup('FULL'), 'Full backup queued')}
              >
                Full backup
              </GhostButton>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {['DAILY', 'WEEKLY', 'MONTHLY'].map((c) => (
                <GhostButton
                  key={c}
                  onClick={() =>
                    run(
                      () => saveSchoolOpsBackupSchedule({ ...schedule, backupSchedule: c }),
                      'Schedule saved',
                    )
                  }
                >
                  {c}
                </GhostButton>
              ))}
            </div>
          </Panel>
          <Panel className="overflow-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {['When', 'Kind', 'Size', 'Status', 'SHA', ''].map((h) => (
                    <th key={h} className="p-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  ((backups.data as { items?: Array<Record<string, unknown>> })?.items ??
                    []) as Array<Record<string, unknown>>
                ).map((b) => (
                  <tr key={String(b.id)} className="border-t">
                    <td className="p-2">{new Date(String(b.createdAt)).toLocaleString()}</td>
                    <td className="p-2">{str(b.kind)}</td>
                    <td className="p-2">{str(b.sizeBytes)}</td>
                    <td className="p-2">
                      <Tone value={str(b.status)} />
                    </td>
                    <td className="p-2 font-mono text-[11px]">
                      {String(b.sha256 ?? '—').slice(0, 12)}
                    </td>
                    <td className="p-2 text-right">
                      <GhostButton
                        onClick={() => run(() => verifySchoolOpsBackup(String(b.id)), 'Verified')}
                      >
                        Verify
                      </GhostButton>
                      <GhostButton
                        onClick={async () => {
                          const blob = await downloadSchoolOpsBackup(String(b.id));
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = `${b.kind}.json.gz`;
                          a.click();
                        }}
                      >
                        Download
                      </GhostButton>
                      <GhostButton
                        onClick={() =>
                          setConfirm({
                            title: 'Restore production backup',
                            body: 'Super Admin only. This is audited and will not silently overwrite live tables.',
                            run: () =>
                              run(() => restoreSchoolOpsBackup(String(b.id)), 'Restore recorded'),
                          })
                        }
                      >
                        Restore
                      </GhostButton>
                      <GhostButton
                        onClick={() =>
                          setConfirm({
                            title: 'Delete backup',
                            body: 'The archive will be removed permanently.',
                            run: () => run(() => deleteSchoolOpsBackup(String(b.id)), 'Deleted'),
                          })
                        }
                      >
                        Delete
                      </GhostButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      ) : null}

      {section === 'logs' ? (
        <Panel className="overflow-auto p-0">
          <div className="flex flex-wrap gap-2 border-b p-3">
            <select
              className="h-9 rounded border px-2 text-sm"
              value={logQ.level}
              onChange={(e) => setLogQ((s) => ({ ...s, level: e.target.value }))}
            >
              <option value="">All levels</option>
              {['INFO', 'WARNING', 'ERROR', 'CRITICAL'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <input
              className="h-9 rounded border px-3 text-sm"
              placeholder="Module, request ID, search"
              value={logQ.search}
              onChange={(e) => setLogQ((s) => ({ ...s, search: e.target.value }))}
            />
            <GhostButton
              onClick={async () => {
                const rows = await exportSchoolOpsLogs();
                const blob = new Blob([JSON.stringify(rows, null, 2)], {
                  type: 'application/json',
                });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'school-ops-logs.json';
                a.click();
              }}
            >
              Export
            </GhostButton>
            <GhostButton
              onClick={() =>
                setConfirm({
                  title: 'Purge old logs',
                  body: 'Deletes logs older than the retention policy.',
                  run: () => run(() => purgeSchoolOpsLogs(), 'Purged'),
                })
              }
            >
              Clear by retention
            </GhostButton>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs">
              <tr>
                {['Time', 'Level', 'Module', 'Message', 'Request'].map((h) => (
                  <th key={h} className="p-2 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(logs.data?.items ?? []).map((row) => (
                <tr key={String(row.id)} className="border-t">
                  <td className="p-2 text-xs">
                    {new Date(String(row.createdAt)).toLocaleString()}
                  </td>
                  <td className="p-2">
                    <Tone value={str(row.level)} />
                  </td>
                  <td className="p-2">{str(row.module)}</td>
                  <td className="p-2">{str(row.message)}</td>
                  <td className="p-2 font-mono text-[11px]">{str(row.requestId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.data?.items?.length ? (
            <p className="p-6 text-sm text-slate-500">No logs yet.</p>
          ) : null}
        </Panel>
      ) : null}

      {section === 'audit' ? (
        <Panel className="overflow-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs">
              <tr>
                {['Time', 'User', 'Action', 'Module', 'IP', 'Request'].map((h) => (
                  <th key={h} className="p-2 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(audit.data?.items ?? []).map((row) => (
                <tr key={String(row.id)} className="border-t">
                  <td className="p-2 text-xs">{new Date(String(row.at)).toLocaleString()}</td>
                  <td className="p-2">{str(row.user)}</td>
                  <td className="p-2">{str(row.action)}</td>
                  <td className="p-2">{str(row.module)}</td>
                  <td className="p-2">{str(row.ip)}</td>
                  <td className="p-2 font-mono text-[11px]">{str(row.requestId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {section === 'jobs' ? (
        <div className="space-y-3">
          {(jobs.data?.queues ?? []).map((q) => (
            <Panel key={String(q.name)}>
              <h3 className="font-semibold capitalize">{str(q.name)}</h3>
              <p className="text-xs text-slate-500">{JSON.stringify(q.counts)}</p>
              <div className="mt-2 overflow-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {((q.items as Array<Record<string, unknown>>) ?? []).slice(0, 12).map((j) => (
                      <tr key={String(j.id)} className="border-t">
                        <td className="p-2">{str(j.name)}</td>
                        <td className="p-2">
                          <Tone value={str(j.state)} />
                        </td>
                        <td className="p-2">tries {str(j.attempts)}</td>
                        <td className="p-2 text-right">
                          <GhostButton
                            onClick={() =>
                              run(() => retrySchoolOpsJob(String(q.name), String(j.id)))
                            }
                          >
                            Retry
                          </GhostButton>
                          <GhostButton
                            onClick={() =>
                              run(() => cancelSchoolOpsJob(String(q.name), String(j.id)))
                            }
                          >
                            Cancel
                          </GhostButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {section === 'storage' ? <StorageView data={storage.data} /> : null}

      {section === 'maintenance' ? (
        <Panel className="max-w-xl space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={maint.enabled}
              onChange={(e) => setMaint((s) => ({ ...s, enabled: e.target.checked }))}
            />
            Enable maintenance mode
          </label>
          <textarea
            className="h-28 w-full rounded-lg border p-3 text-sm"
            value={maint.message}
            onChange={(e) => setMaint((s) => ({ ...s, message: e.target.value }))}
          />
          <p className="text-xs text-slate-500">
            Super Admin and system.maintenance users are never locked out.
          </p>
          <PrimaryButton
            onClick={() => run(() => saveSchoolOpsMaintenance(maint), 'Maintenance updated')}
          >
            Save
          </PrimaryButton>
        </Panel>
      ) : null}

      {section === 'configuration' ? (
        <Panel className="max-w-2xl space-y-3">
          {[
            ['timezone', 'Timezone'],
            ['dateFormat', 'Date format'],
            ['currency', 'Currency'],
            ['language', 'Language'],
            ['academicYearLabel', 'Academic year'],
            ['allowedFileTypes', 'Allowed file types'],
          ].map(([k, label]) => (
            <label key={k} className="block text-sm">
              {label}
              <input
                className="mt-1 h-10 w-full rounded-lg border px-3"
                value={str(cfg[k]).replace(/^—$/, '')}
                onChange={(e) => setCfg((s) => ({ ...s, [k]: e.target.value }))}
              />
            </label>
          ))}
          <p className="text-xs text-slate-500">
            Secrets such as SMTP passwords are never shown here.
          </p>
          <div className="flex flex-wrap gap-2">
            {['email', 'sms', 'whatsapp', 'push'].map((c) => (
              <GhostButton
                key={c}
                onClick={() => run(() => testSchoolOpsChannel(c), `Tested ${c}`)}
              >
                Test {c}
              </GhostButton>
            ))}
          </div>
          <PrimaryButton onClick={() => run(() => saveSchoolOpsConfig(cfg), 'Configuration saved')}>
            Save configuration
          </PrimaryButton>
        </Panel>
      ) : null}

      {section === 'about' ? (
        <Panel className="max-w-xl space-y-2 text-sm">
          {Object.entries((about.data ?? {}) as Record<string, unknown>)
            .filter(([k]) => k !== 'license')
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b py-1">
                <span className="text-slate-500">{k}</span>
                <span className="font-medium">
                  {typeof v === 'object' ? JSON.stringify(v) : str(v)}
                </span>
              </div>
            ))}
          <div className="pt-2">
            <p className="text-xs text-slate-500">License</p>
            <p>
              <Tone
                value={str(
                  ((about.data as { license?: { status?: string } })?.license ?? {}).status,
                )}
              />{' '}
              {str(((about.data as { license?: { key?: string } })?.license ?? {}).key)}
            </p>
          </div>
        </Panel>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <Panel className="max-w-md space-y-3">
            <h3 className="font-semibold">{confirm.title}</h3>
            <p className="text-sm text-slate-600">{confirm.body}</p>
            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setConfirm(null)}>Cancel</GhostButton>
              <PrimaryButton
                onClick={() => {
                  void confirm.run().finally(() => setConfirm(null));
                }}
              >
                Confirm
              </PrimaryButton>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function StatusView({ data }: { data?: Record<string, unknown> }) {
  if (!data) return <p className="text-sm text-slate-500">Loading health…</p>;
  const server = (data.server ?? {}) as Record<string, unknown>;
  const app = (data.application ?? {}) as Record<string, unknown>;
  const db = (data.database ?? {}) as Record<string, unknown>;
  const services = (data.services ?? {}) as Record<string, string>;
  const perf = (data.performance ?? {}) as Record<string, unknown>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel>
        <h3 className="mb-2 font-semibold">Server</h3>
        <p>CPU {str(server.cpuPct)}%</p>
        <p>RAM {str((server.ram as { usedPretty?: string })?.usedPretty)}</p>
        <p>Disk {str((server.disk as { usedPretty?: string })?.usedPretty)}</p>
        <p>Uptime {str(server.uptimeSec)}s</p>
        <p>Node {str(server.node)}</p>
        <p>OS {str(server.os)}</p>
      </Panel>
      <Panel>
        <h3 className="mb-2 font-semibold">Application</h3>
        <p>{str(app.name)}</p>
        <p>v{str(app.version)}</p>
        <p>Env {str(app.environment)}</p>
        <p>
          API {str(app.api)} · {str(app.apiMs)} ms
        </p>
        <p>WebSocket {str(app.websocket)}</p>
      </Panel>
      <Panel>
        <h3 className="mb-2 font-semibold">Database</h3>
        <p>
          <Tone value={str(db.connection)} /> {str(db.sizePretty)}
        </p>
        <p>Last migration {str(db.lastMigration)}</p>
      </Panel>
      <Panel>
        <h3 className="mb-2 font-semibold">Services</h3>
        {Object.entries(services).map(([k, v]) => (
          <div key={k} className="flex justify-between py-1 text-sm">
            <span className="capitalize">{k}</span>
            <Tone value={v} />
          </div>
        ))}
      </Panel>
      <Panel className="lg:col-span-2">
        <h3 className="mb-2 font-semibold">API performance (15 min)</h3>
        <p>
          {str(perf.requestCount)} requests · avg {str(perf.averageMs)} ms · errors{' '}
          {str(perf.errorRate)}%
        </p>
      </Panel>
    </div>
  );
}

function StorageView({ data }: { data?: Record<string, unknown> }) {
  if (!data) return <p className="text-sm text-slate-500">Loading storage…</p>;
  const pct = Number(data.usedPct ?? 0);
  const buckets = (data.buckets ?? {}) as Record<string, number>;
  return (
    <Panel>
      <div className="mb-3 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            'h-full',
            pct >= 90 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500',
          )}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="text-sm">
        Used {str(data.usedPretty)} of {str(data.totalPretty)} ({pct}%) · free{' '}
        {str(data.freePretty)}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {Object.entries(buckets).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 p-2 text-sm">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="font-medium">{v.toLocaleString()} bytes</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
