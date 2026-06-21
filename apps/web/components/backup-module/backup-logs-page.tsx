'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, Download, Minus, RefreshCw, XCircle } from 'lucide-react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import {
  backupRunTypeLabel,
  formatBackupDate,
  formatDuration,
} from '@/components/backup-module/backup-utils';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  downloadBackupRunLog,
  fetchBackupLogs,
  fetchBackupRuns,
  retryBackupRun,
  type BackupRunRow,
} from '@/services/backup';
import { formatDisplayDateTime } from '@/utils/format-date';
import { cn } from '@/utils/cn';

function StepIcon({ status }: { status?: string }) {
  if (status === 'pass') {
    return <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />;
  }
  if (status === 'fail') {
    return <XCircle className="mx-auto h-4 w-4 text-rose-600" />;
  }
  return <Minus className="mx-auto h-4 w-4 text-muted-foreground" />;
}

function statusBadge(status: string) {
  const tone =
    status === 'SUCCESS'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : status === 'FAILED'
        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
        : status === 'RUNNING'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-muted text-muted-foreground';
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tone)}>{status}</span>;
}

export function BackupLogsPage() {
  useRequireAuth();
  const { canAny } = usePermissions();
  const canManage = canAny('backup:manage');
  const qc = useQueryClient();
  const [tab, setTab] = useState<'execution' | 'audit'>('execution');
  const [statusFilter, setStatusFilter] = useState('');
  const [auditAction, setAuditAction] = useState('');

  const runsQ = useQuery({
    queryKey: ['backups', 'runs', 'logs', statusFilter],
    queryFn: () =>
      fetchBackupRuns({
        page: 1,
        limit: 50,
        status: statusFilter || undefined,
      }),
  });

  const auditQ = useQuery({
    queryKey: ['backups', 'logs', 'audit', auditAction],
    queryFn: () => fetchBackupLogs({ action: auditAction || undefined }),
    enabled: tab === 'audit',
  });

  const retry = useMutation({
    mutationFn: (id: string) => retryBackupRun(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  return (
    <DashboardShell role="admin" title="Backup Logs">
      <AdminShell>
        <AdminPageHeader
          title="Backup Logs"
          subtitle="Execution history with database/storage step status, duration, and error messages."
          showTitle={false}
        />

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={tab === 'execution' ? 'default' : 'outline'}
            onClick={() => setTab('execution')}
          >
            Execution logs
          </Button>
          <Button
            size="sm"
            variant={tab === 'audit' ? 'default' : 'outline'}
            onClick={() => setTab('audit')}
          >
            Admin audit trail
          </Button>
        </div>

        {tab === 'execution' ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {['', 'SUCCESS', 'FAILED', 'RUNNING', 'QUEUED'].map((s) => (
                <Button
                  key={s || 'all'}
                  size="sm"
                  variant={statusFilter === s ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(s)}
                >
                  {s || 'All'}
                </Button>
              ))}
            </div>
            <AdminGlassCard className="overflow-x-auto p-0">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Backup type</th>
                    <th className="px-4 py-3 text-center">Database</th>
                    <th className="px-4 py-3 text-center">Storage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Error message</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(runsQ.data?.items ?? []).map((run: BackupRunRow) => (
                    <tr key={run.id} className="border-b align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p>{formatBackupDate(run.completedAt ?? run.startedAt)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDisplayDateTime(run.completedAt ?? run.startedAt ?? run.id)}
                        </p>
                      </td>
                      <td className="px-4 py-3">{backupRunTypeLabel(run.type)}</td>
                      <td className="px-4 py-3">
                        <StepIcon status={run.stepStatus?.database} />
                      </td>
                      <td className="px-4 py-3">
                        <StepIcon status={run.stepStatus?.storage} />
                      </td>
                      <td className="px-4 py-3">{statusBadge(run.status)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDuration(run.durationMs ?? null)}
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        {run.errorMessage ? (
                          <p
                            className="truncate font-mono text-xs text-rose-700 dark:text-rose-400"
                            title={run.errorMessage}
                          >
                            {run.errorMessage}
                          </p>
                        ) : run.diagnostic?.likelyCause ? (
                          <p className="text-xs text-muted-foreground">
                            {run.diagnostic.likelyCause}
                          </p>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => downloadBackupRunLog(run.id)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {run.status === 'FAILED' && canManage ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2"
                              disabled={retry.isPending}
                              onClick={() => retry.mutate(run.id)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!runsQ.data?.items?.length && !runsQ.isLoading ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No backup runs recorded yet.
                </p>
              ) : null}
            </AdminGlassCard>
          </>
        ) : (
          <>
            <input
              className="mb-4 h-9 max-w-xs rounded-xl border border-border bg-background px-3 text-sm"
              placeholder="Filter audit action…"
              value={auditAction}
              onChange={(e) => setAuditAction(e.target.value)}
            />
            <AdminGlassCard className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Run</th>
                    <th className="px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {(auditQ.data?.items ?? []).map((log: Record<string, unknown>) => (
                    <tr key={String(log.id)} className="border-b">
                      <td className="px-4 py-3">{formatDisplayDateTime(String(log.createdAt))}</td>
                      <td className="px-4 py-3">{String(log.action)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{String(log.runId ?? '—')}</td>
                      <td className="px-4 py-3">{String(log.ipAddress ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminGlassCard>
          </>
        )}
      </AdminShell>
    </DashboardShell>
  );
}
