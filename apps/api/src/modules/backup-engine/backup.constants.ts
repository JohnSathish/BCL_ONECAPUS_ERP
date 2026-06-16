export const BACKUP_TYPES = [
  'DATABASE_ONLY',
  'DATABASE_DOCUMENTS',
  'FULL_SNAPSHOT',
  'TENANT_EXPORT',
] as const;

export type BackupType = (typeof BACKUP_TYPES)[number];

export const BACKUP_SCOPES = ['INSTANCE', 'TENANT'] as const;
export type BackupScope = (typeof BACKUP_SCOPES)[number];

export const BACKUP_STATUSES = [
  'QUEUED',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'VERIFYING',
] as const;

export const BACKUP_TRIGGERS = [
  'SCHEDULE',
  'MANUAL',
  'PRE_RESTORE_SAFETY',
] as const;

export const BACKUP_ARTIFACT_KINDS = [
  'DATABASE',
  'FILES',
  'SETTINGS',
  'MANIFEST',
  'TENANT_DATA',
] as const;

export const BACKUP_FREQUENCIES = [
  'EVERY_6H',
  'EVERY_12H',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'CRON',
] as const;

export const BACKUP_PROGRESS_STEPS = [
  'PREPARING',
  'DUMPING_DB',
  'ARCHIVING_FILES',
  'EXPORTING_SETTINGS',
  'COMPRESSING',
  'UPLOADING_CLOUD',
  'COMPLETE',
] as const;

export const RESTORE_MODES = ['DATABASE', 'FILES', 'FULL'] as const;

export const CLOUD_PROVIDERS = ['AWS_S3', 'BACKBLAZE_B2'] as const;
