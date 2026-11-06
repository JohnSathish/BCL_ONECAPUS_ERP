'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download, RotateCcw, Shield } from 'lucide-react';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchBackupDashboard,
  fetchBackupRuns,
  restoreBackup,
  verifyBackupRun,
} from '@/services/backup';
import { formatBackupDate, formatBackupTime } from '@/components/backup-module/backup-utils';

const STEPS = [
  'Download the latest ZIP and keep it somewhere outside this server.',
  'Confirm the file opens and shows a database dump, not a renamed file.',
  'Restore only when you intend to replace live data. A safety copy is taken first.',
];

export function BackupDisasterRecoveryPage() {
  useRequireAuth();
  const dashQ = useQuery({ queryKey: ['backups', 'dashboard'], queryFn: fetchBackupDashboard });
  const runsQ = useQuery({
    queryKey: ['backups', 'runs', 'dr'],
    queryFn: () => fetchBackupRuns({ status: 'SUCCESS', limit: 5 }),
  });

  const latest = runsQ.data?.items?.[0];
  const verifyM = useMutation({ mutationFn: () => verifyBackupRun(latest!.id) });
  const restoreM = useMutation({
    mutationFn: (mode: 'DATABASE_ONLY' | 'FULL') =>
      restoreBackup({ runId: latest!.id, mode, confirmText: 'RESTORE' }),
  });

  return (
    <DashboardShell role="admin" title="Disaster Recovery" pageHeader={false}>
      <AdminShell>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Disaster Recovery
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Use the latest successful backup if the college system has to be rebuilt. Downloading
              a ZIP does not change live data.
            </p>
          </div>
          <Button variant="outline" className="h-10" asChild>
            <Link href="/admin/administration/backups">
              <Download className="mr-2 h-4 w-4" /> Back to backups
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm text-slate-500">Database</p>
            <p className="mt-1 text-xl font-semibold capitalize text-slate-900 dark:text-slate-50">
              {dashQ.data?.dbHealth?.status ?? 'Checking'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm text-slate-500">Server</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">
              {dashQ.data?.maintenance?.active ? 'Maintenance' : 'Normal'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <p className="text-sm text-slate-500">Restore points</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">
              {dashQ.data?.restorePoints ?? '—'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center gap-2 font-medium text-slate-900 dark:text-slate-50">
              <Shield className="h-4 w-4 text-sky-600" />
              Recovery steps
            </div>
            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center gap-2 font-medium text-slate-900 dark:text-slate-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Latest restore point
            </div>
            {latest ? (
              <>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {formatBackupDate(latest.completedAt)}
                </p>
                <p className="text-sm text-slate-500">
                  {formatBackupTime(latest.completedAt)} · {latest.type.replace(/_/g, ' ')}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={verifyM.isPending}
                    onClick={() => verifyM.mutate()}
                  >
                    {verifyM.isPending ? 'Checking…' : 'Check this backup'}
                  </Button>
                </div>
                {verifyM.isSuccess ? (
                  <p className="mt-3 text-sm text-emerald-600">This backup passed the check.</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500">No successful backup yet.</p>
            )}
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900/60 dark:bg-slate-950">
          <div className="mb-2 flex items-center gap-2 font-medium text-slate-900 dark:text-slate-50">
            <RotateCcw className="h-4 w-4 text-rose-600" />
            Replace live data
          </div>
          <p className="max-w-2xl text-sm text-slate-500">
            These actions write the backup back onto this server. Use them only for a real recovery.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!latest || restoreM.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Restore the database from the latest backup? A safety backup is created first.',
                  )
                ) {
                  restoreM.mutate('DATABASE_ONLY');
                }
              }}
            >
              Restore database
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!latest || restoreM.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Restore the full system from the latest backup? The server will enter maintenance mode.',
                  )
                ) {
                  restoreM.mutate('FULL');
                }
              }}
            >
              Restore full system
            </Button>
          </div>
          {restoreM.data ? (
            <p className="mt-3 text-sm text-slate-500">{restoreM.data.message}</p>
          ) : null}
        </section>
      </AdminShell>
    </DashboardShell>
  );
}
