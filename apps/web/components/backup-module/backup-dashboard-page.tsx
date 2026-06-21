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
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { AcademicContextStrip } from '@/components/layout/academic-context-strip';
import { ErpPageHero } from '@/components/layout/erp-page-layout';
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
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { usePermissions } from '@/hooks/use-permissions';
import {
  downloadBackupArtifact,
  fetchBackupDashboard,
  formatBytes,
  restoreBackup,
  type BackupRunRow,
} from '@/services/backup';
import { cn } from '@/utils/cn';

function MetricCard({
  label,
  children,
  tone,
  className,
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'green' | 'blue' | 'default';
  className?: string;
}) {
  const border =
    tone === 'green'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : tone === 'blue'
        ? 'border-blue-500/30 bg-blue-500/5'
        : '';
  return (
    <AdminGlassCard className={cn('p-4', border, className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2">{children}</div>
    </AdminGlassCard>
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
    const artifact = latest.artifacts[0];
    downloadBackupArtifact(
      latest.id,
      artifact.id,
      buildBackupDownloadName(institutionSlug, latest.completedAt, 'zip'),
    );
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

  return (
    <DashboardShell role="admin" pageHeader={false}>
      <AdminShell>
        <div className="mb-2">
          <AcademicContextStrip className="whitespace-normal sm:truncate" />
        </div>

        <ErpPageHero
          icon={<Shield className="h-5 w-5 text-primary" />}
          title="Backup & Disaster Recovery"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last backup
              </dt>
              <dd className="mt-1 font-semibold">
                {latest?.completedAt
                  ? `${formatBackupDate(latest.completedAt)} ${formatBackupTime(latest.completedAt)}`
                  : 'No backup yet'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Next backup
              </dt>
              <dd className="mt-1 font-semibold">
                {schedule?.nextRunAt
                  ? `${formatBackupDate(schedule.nextRunAt)} ${formatBackupTime(schedule.nextRunAt)}`
                  : '02:00 AM daily'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </dt>
              <dd
                className={cn(
                  'mt-1 font-semibold',
                  backupHealthLabel === 'Healthy'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600',
                )}
              >
                {backupHealthLabel}
              </dd>
            </div>
          </dl>
        </ErpPageHero>

        {d?.maintenance?.active ? (
          <AdminGlassCard className="mb-4 border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            System maintenance active: {d.maintenance.reason ?? 'Restore in progress'}
          </AdminGlassCard>
        ) : null}

        {/* KPI strip */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Last Successful Backup" tone="green">
            {latest?.completedAt ? (
              <>
                <p className="text-lg font-semibold">{formatBackupDate(latest.completedAt)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBackupTime(latest.completedAt)}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Successful
                </p>
              </>
            ) : (
              <p className="text-lg font-semibold text-muted-foreground">No backup yet</p>
            )}
          </MetricCard>

          <MetricCard label="Next Scheduled Backup" tone="blue">
            {schedule?.nextRunAt ? (
              <>
                <p className="text-lg font-semibold">{formatBackupDate(schedule.nextRunAt)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatBackupTime(schedule.nextRunAt)}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">—</p>
                <p className="text-sm text-muted-foreground">02:00 AM daily</p>
              </>
            )}
          </MetricCard>

          <MetricCard label="Total Backup Storage">
            <p className="text-lg font-semibold">{formatBytes(d?.storageUsedBytes)} Used</p>
            <p className="text-sm text-muted-foreground">
              {d?.storageAvailableBytes
                ? `${formatBytes(d.storageAvailableBytes)} Available`
                : d?.diskFreePct != null
                  ? `${d.diskFreePct}% disk free`
                  : 'Quota available'}
            </p>
          </MetricCard>

          <MetricCard label="Restore Points">
            <p className="text-2xl font-semibold tabular-nums">{d?.restorePoints ?? 0}</p>
            <p className="text-sm text-muted-foreground">Available</p>
          </MetricCard>

          <MetricCard label="Cloud Sync Status">
            <p className="text-sm font-medium leading-relaxed">{cloudStatusLine()}</p>
          </MetricCard>
        </div>

        {/* Failure diagnostics */}
        {(d?.failedBackups ?? 0) > 0 || d?.diagnostics?.runId ? (
          <div className="mb-6">
            <BackupDiagnosticsCard dashboard={d} canManage={canManage} />
          </div>
        ) : null}

        {/* Quick actions */}
        <AdminGlassCard className="mb-6 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quick Actions
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button
              size="lg"
              className="h-12"
              onClick={() => setManualOpen(true)}
              disabled={!canManage}
            >
              Take Backup Now
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-12"
              onClick={downloadLatest}
              disabled={!canDownload || !latest?.artifacts?.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Latest Backup
            </Button>
            <Button size="lg" variant="outline" className="h-12" asChild>
              <Link href="/admin/administration/backups/repository">Open Repository</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12" asChild>
              <Link href="/admin/administration/backups/restore">Restore Backup</Link>
            </Button>
          </div>
        </AdminGlassCard>

        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          {/* Daily schedule */}
          <AdminGlassCard className="p-5 lg:col-span-1">
            <div className="mb-3 flex items-center gap-2 font-medium">
              <CalendarClock className="h-4 w-4 text-primary" />
              Daily Backup Schedule
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
              <Link href="/admin/administration/backups/schedule">Edit Schedule</Link>
            </Button>
          </AdminGlassCard>

          {/* Health widget */}
          <AdminGlassCard className="p-5 lg:col-span-1">
            <div className="mb-3 flex items-center gap-2 font-medium">
              <Shield className="h-4 w-4 text-primary" />
              Backup Health Check
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
          </AdminGlassCard>

          {/* Disaster recovery — super admin */}
          {isAdmin ? (
            <AdminGlassCard className="border-primary/20 p-5 lg:col-span-1">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <RotateCcw className="h-4 w-4 text-primary" />
                Disaster Recovery
              </div>
              <p className="text-xs text-muted-foreground">Super Admin · Latest restore point</p>
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
                <p className="mt-2 text-sm text-muted-foreground">No restore point available.</p>
              )}
            </AdminGlassCard>
          ) : (
            <AdminGlassCard className="p-5 lg:col-span-1">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <History className="h-4 w-4" />
                Backup Verification
              </div>
              <p className="text-sm text-muted-foreground">
                SHA256 verification and integrity checks run after each backup.
              </p>
              <p className="mt-2 text-sm font-medium text-emerald-600">
                {recentRuns.some((r) => r.verified) ? '✓ Verified' : 'Pending first verification'}
              </p>
            </AdminGlassCard>
          )}
        </div>

        {/* Repository table */}
        <AdminGlassCard className="mb-6 overflow-hidden p-0">
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
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Downloaded archive includes database, student photos, documents, certificates, settings,
            and NAAC files when a full instance backup is selected.
          </p>
        </AdminGlassCard>

        {/* Destinations */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <AdminGlassCard className="p-5">
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
          </AdminGlassCard>

          {(d?.cloudSync ?? []).map((target) => (
            <AdminGlassCard key={target.provider} className="p-5">
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
            </AdminGlassCard>
          ))}
        </div>

        {/* Timeline + pre-operation */}
        <div className="grid gap-4 lg:grid-cols-2">
          <AdminGlassCard className="p-5">
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
          </AdminGlassCard>

          <AdminGlassCard className="p-5">
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
          </AdminGlassCard>
        </div>

        {/* Nav shortcuts */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <Link key={link.href} href={link.href}>
              <AdminGlassCard className="flex items-center gap-2 p-4 transition hover:border-primary/40">
                <link.icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{link.label}</span>
              </AdminGlassCard>
            </Link>
          ))}
        </div>

        <BackupManualDialog
          open={manualOpen}
          onOpenChange={setManualOpen}
          cloudSync={d?.cloudSync ?? []}
        />
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
