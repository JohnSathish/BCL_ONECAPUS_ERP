import { api } from '@/services/api';

export type BackupHealthCheckItem = {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
};

export type BackupHealthCheckResult = {
  allPassed: boolean;
  checkedAt: string;
  checks: BackupHealthCheckItem[];
};

export type BackupDiagnostics = {
  lastSuccessfulAt?: string | null;
  lastFailedAt?: string | null;
  failureReason?: string | null;
  failedComponent?: string | null;
  likelyCause?: string | null;
  runId?: string;
};

export type BackupRunDiagnostic = {
  failedComponent: string;
  failedComponentLabel: string;
  failureReason: string;
  likelyCause: string;
};

export type BackupDashboard = {
  totalBackups: number;
  latestBackup: BackupRunRow | null;
  lastFailedBackup?: BackupRunRow | null;
  diagnostics?: BackupDiagnostics | null;
  preflight?: BackupHealthCheckResult;
  storageUsedBytes: string;
  storageAvailableBytes: string | null;
  diskFreePct: number | null;
  restorePoints: number;
  failedBackups: number;
  cloudSync: Array<{
    provider: string;
    enabled: boolean;
    lastSyncAt?: string;
    lastSyncError?: string;
    hasCredentials: boolean;
  }>;
  schedule?: {
    frequency: string;
    backupType: string;
    enabled: boolean;
    nextRunAt?: string;
  } | null;
  retention?: {
    keepDays: number;
    autoCleanupEnabled: boolean;
  } | null;
  recentRuns?: BackupRunRow[];
  localRepository?: {
    path: string;
    backupCount: number;
    sizeBytes: string;
    healthy: boolean;
  };
  health?: {
    database: string;
    storage: string;
    backup: string;
    cloudSync: string;
  };
  maintenance?: { active: boolean; reason?: string };
  dbHealth?: { status?: string };
};

export type BackupRunRow = {
  id: string;
  type: string;
  scope: string;
  status: string;
  triggeredBy: string;
  startedAt?: string;
  completedAt?: string;
  sizeBytes: string;
  errorMessage?: string;
  progressStep?: string;
  verified?: boolean;
  durationMs?: number | null;
  diagnostic?: BackupRunDiagnostic | null;
  stepStatus?: { database: string; storage: string };
  artifacts?: Array<{
    id: string;
    kind: string;
    sizeBytes: string;
    cloudStatus: string;
    checksumSha256?: string;
    verifiedAt?: string;
  }>;
};

export async function fetchBackupHealthCheck(): Promise<BackupHealthCheckResult> {
  const { data } = await api.get('/v1/admin/backups/health-check');
  return data;
}

export async function retryBackupRun(id: string) {
  const { data } = await api.post(`/v1/admin/backups/runs/${id}/retry`);
  return data;
}

export async function downloadBackupRunLog(runId: string) {
  const { data } = await api.get(`/v1/admin/backups/runs/${runId}/log`, {
    responseType: 'blob',
  });
  const { downloadBlob } = await import('@/utils/download-blob');
  downloadBlob(data as Blob, `backup-run-${runId}.log`);
}

export async function fetchBackupDashboard(): Promise<BackupDashboard> {
  const { data } = await api.get('/v1/admin/backups/dashboard');
  return data;
}

export async function fetchBackupSchedule() {
  const { data } = await api.get('/v1/admin/backups/schedule');
  return data;
}

export async function updateBackupSchedule(payload: Record<string, unknown>) {
  const { data } = await api.put('/v1/admin/backups/schedule', payload);
  return data;
}

export async function fetchBackupRetention() {
  const { data } = await api.get('/v1/admin/backups/retention');
  return data;
}

export async function updateBackupRetention(payload: Record<string, unknown>) {
  const { data } = await api.put('/v1/admin/backups/retention', payload);
  return data;
}

export async function fetchCloudTargets() {
  const { data } = await api.get('/v1/admin/backups/cloud-targets');
  return data;
}

export async function updateCloudTarget(payload: Record<string, unknown>) {
  const { data } = await api.put('/v1/admin/backups/cloud-targets', payload);
  return data;
}

export async function triggerBackupRun(payload: { type: string; tenantId?: string }) {
  const { data } = await api.post('/v1/admin/backups/run', payload);
  return data;
}

export async function fetchBackupRuns(params?: { page?: number; limit?: number; status?: string }) {
  const { data } = await api.get('/v1/admin/backups/runs', {
    params: {
      page: params?.page,
      limit: params?.limit,
      status: params?.status,
    },
  });
  return data as { items: BackupRunRow[]; total: number; page: number; limit: number };
}

export async function fetchBackupRun(id: string) {
  const { data } = await api.get(`/v1/admin/backups/runs/${id}`);
  return data;
}

export async function verifyBackupRun(id: string) {
  const { data } = await api.post(`/v1/admin/backups/runs/${id}/verify`);
  return data;
}

export async function deleteBackupRun(id: string) {
  const { data } = await api.delete(`/v1/admin/backups/runs/${id}`);
  return data;
}

export async function restoreBackup(payload: { runId: string; mode: string; confirmText: string }) {
  const { data } = await api.post('/v1/admin/backups/restore', payload);
  return data;
}

export async function fetchBackupLogs(params?: { page?: string; action?: string }) {
  const { data } = await api.get('/v1/admin/backups/logs', { params });
  return data;
}

export async function triggerTenantExport(tenantId: string) {
  const { data } = await api.post('/v1/admin/backups/tenant-export', { tenantId });
  return data;
}

export async function downloadBackupArtifact(runId: string, artifactId: string, filename: string) {
  const { data } = await api.get(`/v1/admin/backups/runs/${runId}/download/${artifactId}`, {
    responseType: 'blob',
  });
  const { downloadBlob } = await import('@/utils/download-blob');
  downloadBlob(data as Blob, filename);
}

export function formatBytes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = n;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
