'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FolderArchive,
  HardDrive,
  History,
  RotateCcw,
  Shield,
  ShieldAlert,
} from 'lucide-react';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { BackupManualDialog } from '@/components/backup-module/backup-manual-dialog';
import {
  BackupDiagnosticsCard,
  BackupHealthChecksPanel,
} from '@/components/backup-module/backup-diagnostics-card';
import { BackupRepositoryTable } from '@/components/backup-module/backup-repository-table';
import {
  BACKUP_TYPE_LABELS,
  FREQUENCY_LABELS,
  PRE_OPERATION_TRIGGERS,
  backupDurationMs,
  buildBackupDownloadName,
  formatBackupDate,
  formatBackupTime,
  formatDuration,
  healthLabel,
  healthTone,
  scheduleDestinations,
} from '@/components/backup-module/backup-utils';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStepUpAction } from '@/hooks/use-step-up-action';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { usePermissions } from '@/hooks/use-permissions';
import {
  downloadBackupBundle,
  fetchBackupDashboard,
  formatBytes,
  updateBackupRetention,
  restoreBackup,
  type BackupRunRow,
} from '@/services/backup';
import { cn } from '@/utils/cn';

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Shield;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold text-slate-900 dark:text-slate-50">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            iconClass,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function HealthRow({ label, status }: { label: string; status?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', healthTone(status))}>{healthLabel(status)}</span>
    </div>
  );
}

function cloudProviderLabel(provider: string): string {
  if (provider === 'AWS_S3') return 'AWS';
  if (provider === 'BACKBLAZE_B2') return 'Backblaze';
  return provider.replace(/_/g, ' ');
}

export function BackupDashboardPage() {
  useRequireAuth();
  const { isAdmin, canAny } = usePermissions();
  const { branding } = useInstitutionBranding();
  const qc = useQueryClient();
  const [manualOpen, setManualOpen] = useState(false);
  const { withStepUp, stepUpDialog } = useStepUpAction({
    description:
      'Re-enter your password. A backup ZIP is about 1 GB and can take several minutes. Leave this window open.',
    pendingLabel: 'Downloading…',
  });
  const canDownload = canAny('backup:download', 'backup:manage');
  const canManage = canAny('backup:manage');

  const dashQ = useQuery({
    queryKey: ['backups', 'dashboard'],
    queryFn: fetchBackupDashboard,
    refetchInterval: 30_000,
  });
  const d = dashQ.data;
  const latest = d?.latestBackup;
  const schedule = d?.schedule;
  const retention = d?.retention;
  const recentRuns = d?.recentRuns ?? [];
  const institutionSlug =
    branding?.displayName?.split(',')[0]?.trim() ?? branding?.displayName ?? 'Institution';

  const retentionM = useMutation({
    mutationFn: updateBackupRetention,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const restoreM = useMutation({
    mutationFn: (mode: string) =>
      restoreBackup({
        runId: latest!.id,
        mode,
        confirmText: 'RESTORE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const downloadLatest = () => {
    if (!latest?.artifacts?.length) return;
    const filename = buildBackupDownloadName(institutionSlug, latest.completedAt, 'zip');
    withStepUp((token) => downloadBackupBundle(latest.id, filename, token));
  };

  const cloudStatusLine = () => {
    const localOk = d?.localRepository?.healthy !== false;
    const aws = d?.cloudSync?.find((c) => c.provider === 'AWS_S3');
    const b2 = d?.cloudSync?.find((c) => c.provider === 'BACKBLAZE_B2');
    return [
      localOk ? 'Local ✓' : 'Local —',
      aws?.enabled && !aws.lastSyncError ? 'AWS ✓' : aws?.enabled ? 'AWS —' : 'AWS off',
      b2?.enabled && !b2.lastSyncError ? 'Backblaze ✓' : b2?.enabled ? 'Backblaze —' : 'B2 off',
    ].join(' · ');
  };

  const backupHealthLabel =
    d?.health?.backup === 'healthy'
      ? 'Healthy'
      : d?.health?.backup === 'warning'
        ? 'Needs attention'
        : 'Unknown';

  const storageHint = d?.storageAvailableBytes
    ? `${formatBytes(d.storageAvailableBytes)} free`
    : d?.diskFreePct != null
      ? `${d.diskFreePct}% disk free`
      : 'Local disk';

  return (
    <DashboardShell role="admin" title="Backup & Disaster Recovery" pageHeader={false}>
      <AdminShell>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Backup & Disaster Recovery
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Take a copy of the college database and files, then download it as a ZIP. A download
              does not change the live server.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => setManualOpen(true)}
              disabled={!canManage}
            >
              <Database className="mr-2 h-4 w-4" /> Take backup now
            </Button>
            <Button
              className="h-10 bg-[#1d4ed8] hover:bg-[#1e40af]"
              onClick={downloadLatest}
              disabled={!canDownload || !latest?.artifacts?.length}
            >
              <Download className="mr-2 h-4 w-4" /> Download latest ZIP
            </Button>
          </div>
        </div>

        {d?.maintenance?.active ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Maintenance is on: {d.maintenance.reason ?? 'A restore is in progress'}.
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile
            label="Last backup"
            value={latest?.completedAt ? formatBackupDate(latest.completedAt) : 'None yet'}
            hint={
              latest?.completedAt
                ? `${formatBackupTime(latest.completedAt)} · ${backupHealthLabel}`
                : 'No successful backup'
            }
            icon={CheckCircle2}
            iconClass="bg-emerald-100 text-emerald-600"
          />
          <StatTile
            label="Next backup"
            value={schedule?.nextRunAt ? formatBackupDate(schedule.nextRunAt) : 'Daily'}
            hint={schedule?.nextRunAt ? formatBackupTime(schedule.nextRunAt) : '02:00 AM'}
            icon={CalendarClock}
            iconClass="bg-sky-100 text-sky-600"
          />
          <StatTile
            label="Storage used"
            value={formatBytes(d?.storageUsedBytes)}
            hint={storageHint}
            icon={HardDrive}
            iconClass="bg-slate-100 text-slate-600"
          />
          <StatTile
            label="Restore points"
            value={String(d?.restorePoints ?? 0)}
            hint="Successful copies"
            icon={Archive}
            iconClass="bg-violet-100 text-violet-600"
          />
          <StatTile
            label="Cloud copies"
            value={d?.localRepository?.healthy === false ? 'Check storage' : 'On this server'}
            hint={cloudStatusLine()}
            icon={Cloud}
            iconClass="bg-amber-100 text-amber-600"
          />
        </div>

        {/* Failure diagnostics */}
        {(d?.failedBackups ?? 0) > 0 || d?.diagnostics?.runId ? (
          <div className="mt-4">
            <BackupDiagnosticsCard dashboard={d} canManage={canManage} />
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* Daily schedule */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center gap-2 font-medium text-slate-900 dark:text-slate-50">
              <CalendarClock className="h-4 w-4 text-sky-600" />
              Daily schedule
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Frequency</dt>
                <dd className="font-medium">
                  {FREQUENCY_LABELS[schedule?.frequency ?? 'DAILY'] ?? 'Every 24 Hours'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Time</dt>
                <dd className="font-medium">02:00 AM</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="text-right font-medium">
                  {BACKUP_TYPE_LABELS[schedule?.backupType ?? 'DATABASE_DOCUMENTS'] ??
                    'Full Instance Backup'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Retention</dt>
                <dd className="font-medium">{retention?.keepDays ?? 30} Days</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Destination</dt>
                <dd className="text-right font-medium">
                  {scheduleDestinations(d?.cloudSync ?? [])}
                </dd>
              </div>
            </dl>
            <Button className="mt-4 w-full" variant="outline" size="sm" asChild>
              <Link href="/admin/administration/backups/schedule">Edit schedule</Link>
            </Button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center gap-2 font-medium text-slate-900 dark:text-slate-50">
              <Shield className="h-4 w-4 text-emerald-600" />
              Health check
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Verified before every backup — PostgreSQL, storage paths, disk space, repository write
              access, and cloud credentials.
            </p>
            <BackupHealthChecksPanel preflight={d?.preflight} />
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              <HealthRow label="Database Health" status={d?.health?.database} />
              <HealthRow label="Storage Health" status={d?.health?.storage} />
              <HealthRow label="Backup Health" status={d?.health?.backup} />
              <HealthRow label="Cloud Sync" status={d?.health?.cloudSync} />
            </div>
            {d?.failedBackups ? (
              <p className="mt-3 flex items-center gap-1 text-xs text-amber-600">
                <ShieldAlert className="h-3.5 w-3.5" />
                {d.failedBackups} failed backup(s) —{' '}
                <Link href="/admin/administration/backups/logs" className="underline">
                  review logs
                </Link>
              </p>
            ) : null}
          </section>

          {isAdmin ? (
            <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900/60 dark:bg-slate-950">
              <div className="mb-3 flex items-center gap-2 font-medium text-slate-900 dark:text-slate-50">
                <RotateCcw className="h-4 w-4 text-rose-600" />
                Restore onto this server
              </div>
              <p className="text-xs text-slate-500">
                This replaces live data. Download the ZIP above when you only need a copy.
              </p>
              {latest ? (
                <>
                  <p className="mt-2 text-lg font-semibold">
                    {formatBackupDate(latest.completedAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatBackupTime(latest.completedAt)}
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoreM.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Restore database from the latest backup? A safety backup will be created first.',
                          )
                        ) {
                          restoreM.mutate('DATABASE_ONLY');
                        }
                      }}
                    >
                      Restore Database
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={restoreM.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Restore FULL system from the latest backup? This will enable maintenance mode.',
                          )
                        ) {
                          restoreM.mutate('FULL');
                        }
                      }}
                    >
                      Restore Full System
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No restore point available.</p>
              )}
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <History className="h-4 w-4" />
                Backup Verification
              </div>
              <p className="text-sm text-muted-foreground">
                SHA256 verification and integrity checks run after each backup.
              </p>
              <p className="mt-2 text-sm font-medium text-emerald-600">
                {recentRuns.some((r) => r.verified) ? 'Verified' : 'Pending first verification'}
              </p>
            </section>
          )}
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Automatic cleanup</p>
              <p className="text-xs text-slate-500">
                Backups older than this are deleted every hour. The newest copy is always kept.
              </p>
            </div>
            <div className="flex gap-2">
              {[24, 48].map((hours) => {
                const active = (d?.retention?.keepHours ?? 48) === hours;
                return (
                  <Button
                    key={hours}
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    disabled={!canManage || retentionM.isPending}
                    onClick={() =>
                      retentionM.mutate({
                        keepHours: hours,
                        keepDays: hours / 24,
                        autoCleanupEnabled: true,
                      })
                    }
                  >
                    {hours} hours
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 font-medium">
              <FolderArchive className="h-4 w-4" />
              Backup Repository
            </div>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/admin/administration/backups/repository">View all</Link>
            </Button>
          </div>
          <BackupRepositoryTable
            runs={recentRuns.slice(0, 8)}
            institutionSlug={institutionSlug}
            canDownload={canDownload}
            canManage={canManage}
            compact
          />
          <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            The ZIP contains the database. Student photos and documents are included when the backup
            type is a full instance copy.
          </p>
        </section>

        {/* Destinations */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <HardDrive className="h-4 w-4" /> Local Repository
            </div>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-muted-foreground">Path</dt>
                <dd className="truncate font-mono text-xs">
                  {d?.localRepository?.path ?? '/backup/'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Backups</dt>
                <dd>{d?.localRepository?.backupCount ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Size</dt>
                <dd>{formatBytes(d?.localRepository?.sizeBytes)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-emerald-600">
                  {d?.localRepository?.healthy ? 'Healthy' : 'Warning'}
                </dd>
              </div>
            </dl>
          </section>

          {(d?.cloudSync ?? []).map((target) => (
            <section
              key={target.provider}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Cloud className="h-4 w-4" />
                {cloudProviderLabel(target.provider)}
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Connected</dt>
                  <dd>{target.enabled && target.hasCredentials ? 'Yes' : 'Not configured'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last Sync</dt>
                  <dd>{target.lastSyncAt ? formatBackupDate(target.lastSyncAt) : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd
                    className={
                      target.lastSyncError
                        ? 'text-amber-600'
                        : target.enabled
                          ? 'text-emerald-600'
                          : 'text-muted-foreground'
                    }
                  >
                    {target.lastSyncError ? 'Error' : target.enabled ? 'Success' : 'Disabled'}
                  </dd>
                </div>
              </dl>
              <Button className="mt-3 w-full" size="sm" variant="outline" asChild>
                <Link href="/admin/administration/backups/cloud">Configure</Link>
              </Button>
            </section>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center gap-2 font-medium">
              <History className="h-4 w-4" />
              Backup History Timeline
            </div>
            <ol className="space-y-4 border-l border-border pl-4">
              {recentRuns.slice(0, 6).map((run) => (
                <TimelineItem key={run.id} run={run} />
              ))}
              {!recentRuns.length ? (
                <li className="text-sm text-muted-foreground">No backup history yet.</li>
              ) : null}
            </ol>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <Database className="h-4 w-4" />
              Pre-Operation Backup
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Automatically create a safety backup before critical ERP operations.
            </p>
            <ul className="space-y-2">
              {PRE_OPERATION_TRIGGERS.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>{item.label}</span>
                  <span className="text-xs font-medium text-emerald-600">Enabled</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Safety backups are created automatically before restore and major data operations.
            </p>
          </section>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: '/admin/administration/backups/schedule',
              label: 'Auto Backup Settings',
              icon: CalendarClock,
            },
            { href: '/admin/administration/backups/logs', label: 'Backup Logs', icon: Archive },
            {
              href: '/admin/administration/backups/disaster-recovery',
              label: 'Disaster Recovery Guide',
              icon: Shield,
            },
            { href: '/admin/administration/backups/cloud', label: 'Cloud Storage', icon: Cloud },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 shadow-sm transition hover:border-sky-200 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              <link.icon className="h-4 w-4 text-sky-600" />
              {link.label}
            </Link>
          ))}
        </div>

        <BackupManualDialog
          open={manualOpen}
          onOpenChange={setManualOpen}
          cloudSync={d?.cloudSync ?? []}
        />
        {stepUpDialog}
      </AdminShell>
    </DashboardShell>
  );
}

function TimelineItem({ run }: { run: BackupRunRow }) {
  const duration = formatDuration(backupDurationMs(run));
  return (
    <li className="relative">
      <span className="absolute -left-[1.35rem] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
      <p className="font-medium">{formatBackupDate(run.completedAt)}</p>
      <p className="text-xs text-muted-foreground">{formatBackupTime(run.completedAt)}</p>
      <p className="mt-1 text-sm">Backup Completed</p>
      <p className="text-xs text-muted-foreground">
        Size: {formatBytes(run.sizeBytes)} · Duration: {duration}
        {run.verified ? ' · SHA256 Verified' : ''}
      </p>
    </li>
  );
}
