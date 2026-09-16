export const SIS_OPS_VIEW = [
  'school-sis:manage',
  'school-sis:read',
  'system.view',
  'system.status',
] as const;

export const SIS_OPS_STATUS = [
  'school-sis:manage',
  'system.view',
  'system.status',
] as const;
export const SIS_OPS_CACHE = ['school-sis:manage', 'system.cache'] as const;
export const SIS_OPS_CACHE_CLEAR = [
  'school-sis:manage',
  'system.cache.clear',
] as const;
export const SIS_OPS_BACKUP_VIEW = [
  'school-sis:manage',
  'system.backup.view',
] as const;
export const SIS_OPS_BACKUP_CREATE = [
  'school-sis:manage',
  'system.backup.create',
] as const;
export const SIS_OPS_BACKUP_RESTORE = ['system.backup.restore'] as const;
export const SIS_OPS_BACKUP_DELETE = [
  'school-sis:manage',
  'system.backup.delete',
] as const;
export const SIS_OPS_LOGS = ['school-sis:manage', 'system.logs.view'] as const;
export const SIS_OPS_LOGS_EXPORT = [
  'school-sis:manage',
  'system.logs.export',
] as const;
export const SIS_OPS_AUDIT = [
  'school-sis:manage',
  'system.audit.view',
  'security.audit.view',
] as const;
export const SIS_OPS_MAINT = [
  'school-sis:manage',
  'system.maintenance',
] as const;
export const SIS_OPS_CONFIG = [
  'school-sis:manage',
  'system.configuration',
] as const;
export const SIS_OPS_JOBS = ['school-sis:manage', 'system.jobs.view'] as const;
export const SIS_OPS_JOBS_RETRY = [
  'school-sis:manage',
  'system.jobs.retry',
] as const;
export const SIS_OPS_STORAGE = [
  'school-sis:manage',
  'system.storage.view',
] as const;
export const SIS_OPS_LICENSE = [
  'school-sis:manage',
  'system.license.view',
  'license:read',
] as const;
