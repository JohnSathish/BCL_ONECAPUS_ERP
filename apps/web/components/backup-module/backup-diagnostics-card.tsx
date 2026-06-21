'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, RefreshCw, XCircle } from 'lucide-react';
import { AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { Button } from '@/components/ui/button';
import { formatBackupDate, formatBackupTime } from '@/components/backup-module/backup-utils';
import { downloadBackupRunLog, retryBackupRun, type BackupDashboard } from '@/services/backup';
import { cn } from '@/utils/cn';

export function BackupDiagnosticsCard({
  dashboard,
  canManage,
}: {
  dashboard?: BackupDashboard;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const diagnostics = dashboard?.diagnostics;
  const lastFailed = dashboard?.lastFailedBackup;
  const latest = dashboard?.latestBackup;

  const retry = useMutation({
    mutationFn: () => retryBackupRun(diagnostics!.runId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  if (!diagnostics?.runId && !lastFailed) {
    return (
      <AdminGlassCard className="border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          No recent backup failures
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          All recent backup jobs completed successfully.
        </p>
      </AdminGlassCard>
    );
  }

  return (
    <AdminGlassCard className="border-amber-500/30 bg-amber-500/5 p-5">
      <div className="mb-4 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4" />
        Backup Failure Diagnostics
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Last successful backup
          </dt>
          <dd className="mt-1 font-medium">
            {latest?.completedAt ? (
              <>
                {formatBackupDate(latest.completedAt)} · {formatBackupTime(latest.completedAt)}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Last failed backup
          </dt>
          <dd className="mt-1 font-medium text-rose-700 dark:text-rose-400">
            {lastFailed?.completedAt ? (
              <>
                {formatBackupDate(lastFailed.completedAt)} ·{' '}
                {formatBackupTime(lastFailed.completedAt)}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            Failed component
          </dt>
          <dd className="mt-1 font-medium">
            {diagnostics?.failedComponent ?? lastFailed?.diagnostic?.failedComponentLabel ?? '—'}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Failure reason</dt>
          <dd className="mt-1 rounded-lg border border-border/60 bg-background/80 p-2 font-mono text-xs leading-relaxed">
            {diagnostics?.failureReason ?? lastFailed?.errorMessage ?? 'No error message recorded'}
          </dd>
        </div>
        {(diagnostics?.likelyCause ?? lastFailed?.diagnostic?.likelyCause) ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Most likely cause
            </dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              {diagnostics?.likelyCause ?? lastFailed?.diagnostic?.likelyCause}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!canManage || !diagnostics?.runId || retry.isPending}
          onClick={() => retry.mutate()}
        >
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', retry.isPending && 'animate-spin')} />
          Retry backup
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!diagnostics?.runId}
          onClick={() => diagnostics?.runId && downloadBackupRunLog(diagnostics.runId)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Download log
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/admin/administration/backups/logs">View all logs</Link>
        </Button>
      </div>
    </AdminGlassCard>
  );
}

export function BackupHealthChecksPanel({
  preflight,
}: {
  preflight?: BackupDashboard['preflight'];
}) {
  const checks = preflight?.checks ?? [];

  const statusIcon = (status: string) => {
    if (status === 'pass') {
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    }
    if (status === 'fail') {
      return <XCircle className="h-4 w-4 text-rose-600" />;
    }
    if (status === 'warn') {
      return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    }
    return <span className="text-xs text-muted-foreground">—</span>;
  };

  return (
    <div className="space-y-2">
      {checks.map((check) => (
        <div
          key={check.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{check.label}</p>
            <p className="text-xs text-muted-foreground">{check.message}</p>
          </div>
          {statusIcon(check.status)}
        </div>
      ))}
      {!checks.length ? (
        <p className="text-sm text-muted-foreground">Running health checks…</p>
      ) : null}
      {preflight?.checkedAt ? (
        <p className="text-[10px] text-muted-foreground">
          Last checked {new Date(preflight.checkedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
