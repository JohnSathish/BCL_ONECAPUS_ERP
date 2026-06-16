import type { BackupRunRow } from '@/services/backup';

export const FREQUENCY_LABELS: Record<string, string> = {
  EVERY_6H: 'Every 6 Hours',
  EVERY_12H: 'Every 12 Hours',
  DAILY: 'Every 24 Hours',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  CRON: 'Custom schedule',
};

export const BACKUP_TYPE_LABELS: Record<string, string> = {
  DATABASE_ONLY: 'Database Only',
  DATABASE_DOCUMENTS: 'Full Instance Backup',
  FULL_SNAPSHOT: 'Full Instance Backup',
  TENANT_EXPORT: 'Tenant Export',
};

export const PRE_OPERATION_TRIGGERS = [
  { id: 'academic_promotion', label: 'Academic Promotion' },
  { id: 'semester_promotion', label: 'Semester Promotion' },
  { id: 'bulk_import', label: 'Bulk Import' },
  { id: 'erp_upgrade', label: 'ERP Upgrade' },
  { id: 'fee_recalculation', label: 'Fee Recalculation' },
  { id: 'subject_mapping', label: 'Subject Mapping' },
] as const;

export function formatBackupDate(value?: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.getDate();
  const month = date.toLocaleString('en-GB', { month: 'short' });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatBackupTime(value?: string | Date | null): string {
  if (!value) return '02:00 AM';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '02:00 AM';
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatShortBackupDate(value?: string | Date | null): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-GB', { month: 'short' });
  return `${day}-${month}`;
}

export function backupRunTypeLabel(type: string): string {
  if (type.includes('FULL') || type === 'DATABASE_DOCUMENTS') return 'Full';
  if (type === 'DATABASE_ONLY') return 'Database';
  return BACKUP_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

export function backupRunLocation(run: BackupRunRow): string {
  const statuses = (run.artifacts ?? []).map((a) => a.cloudStatus);
  if (statuses.some((s) => s === 'SYNCED')) return 'AWS';
  if (statuses.some((s) => s === 'FAILED')) return 'Local';
  return 'Local';
}

export function backupDurationMs(run: BackupRunRow): number | null {
  if (!run.startedAt || !run.completedAt) return null;
  const ms = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  return ms > 0 ? ms : null;
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'Under 1 minute';
  if (minutes === 1) return '1 Minute';
  return `${minutes} Minutes`;
}

export function buildBackupDownloadName(
  institutionSlug: string,
  completedAt?: string,
  ext = 'zip',
): string {
  const slug = institutionSlug
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const prefix = slug ? slug.toUpperCase() : 'INST';
  const date = completedAt ? formatBackupDate(completedAt).replace(/-/g, '-') : 'latest';
  return `${prefix}-Backup-${date}.${ext}`;
}

export function scheduleDestinations(
  cloudSync: Array<{ provider: string; enabled: boolean }>,
): string {
  const parts = ['Local'];
  for (const c of cloudSync) {
    if (!c.enabled) continue;
    if (c.provider === 'AWS_S3') parts.push('AWS');
    else if (c.provider === 'BACKBLAZE_B2') parts.push('Backblaze');
    else parts.push(c.provider.replace(/_/g, ' '));
  }
  return parts.join(' + ');
}

export function healthLabel(status?: string): string {
  switch (status) {
    case 'healthy':
    case 'ready':
      return 'Healthy';
    case 'warning':
    case 'degraded':
      return 'Needs attention';
    case 'disabled':
      return 'Disabled';
    default:
      return 'Unknown';
  }
}

export function healthTone(status?: string): string {
  switch (status) {
    case 'healthy':
    case 'ready':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'warning':
    case 'degraded':
      return 'text-amber-600 dark:text-amber-400';
    default:
      return 'text-muted-foreground';
  }
}
