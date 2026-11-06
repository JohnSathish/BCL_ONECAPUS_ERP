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
    keepHours?: number | null;
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

export async function deleteBackupRun(id: string, stepUpToken?: string) {
  const { data } = await api.delete(`/v1/admin/backups/runs/${id}`, {
    params: stepUpToken ? { stepUpToken } : undefined,
    headers: stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : undefined,
  });
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

export type BackupDownloadStage =
  | 'preparing'
  | 'compressing'
  | 'finalising'
  | 'downloading'
  | 'verifying'
  | 'done';

export type BackupDownloadProgress = {
  stage: BackupDownloadStage;
  /** Null when this stage has no measured total. Never invented. */
  percent: number | null;
  bytesProcessed: number | null;
  bytesTotal: number | null;
  bytesPerSecond: number | null;
  etaSeconds: number | null;
  skippedStages: BackupDownloadStage[];
};

type BundleProgressSnapshot = {
  phase: 'idle' | 'preparing' | 'compressing' | 'finalising' | 'ready' | 'failed' | 'cancelled';
  bytesProcessed: number;
  bytesTotal: number | null;
  error?: string | null;
};

export class BackupDownloadCancelled extends Error {
  constructor() {
    super('Download cancelled');
    this.name = 'BackupDownloadCancelled';
  }
}

const PACK_STAGES: BackupDownloadStage[] = ['preparing', 'compressing', 'finalising'];

export async function fetchBackupBundleProgress(runId: string) {
  const { data } = await api.get(`/v1/admin/backups/runs/${runId}/bundle-progress`);
  return data as BundleProgressSnapshot;
}

export async function cancelBackupBundle(runId: string) {
  const { data } = await api.post(`/v1/admin/backups/runs/${runId}/bundle-cancel`);
  return data as { cancelled: boolean };
}

function measuredPercent(processed: number, total: number | null) {
  if (total == null || total <= 0 || processed < 0) return null;
  return Math.min(100, Math.floor((processed / total) * 100));
}

export async function downloadBackupBundle(
  runId: string,
  filename: string,
  stepUpToken?: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: BackupDownloadProgress) => void;
    onRequest?: () => void;
  },
) {
  const samples: Array<{ stage: BackupDownloadStage; at: number; bytes: number }> = [];
  let downloadStarted = false;
  let sawPackStage = false;
  let polling = false;
  const skippedStages = (stage: BackupDownloadStage): BackupDownloadStage[] => {
    if (sawPackStage) return [];
    if (stage === 'downloading' || stage === 'verifying' || stage === 'done') return PACK_STAGES;
    return [];
  };

  const rateFor = (stage: BackupDownloadStage, bytes: number, total: number | null) => {
    const now = Date.now();
    const previous = samples[samples.length - 1];
    if (!previous || previous.stage !== stage) {
      samples.length = 0;
      samples.push({ stage, at: now, bytes });
      return { bytesPerSecond: null as number | null, etaSeconds: null as number | null };
    }
    samples.push({ stage, at: now, bytes });
    const recent = samples.filter((sample) => now - sample.at <= 4000);
    const first = recent[0] ?? samples[0];
    const elapsed = (now - first.at) / 1000;
    const delta = bytes - first.bytes;
    if (elapsed < 0.4 || delta <= 0) {
      return { bytesPerSecond: null, etaSeconds: null };
    }
    const bytesPerSecond = delta / elapsed;
    const etaSeconds = total != null && total >= bytes ? (total - bytes) / bytesPerSecond : null;
    return { bytesPerSecond, etaSeconds };
  };

  const emit = (
    stage: BackupDownloadStage,
    bytesProcessed: number | null,
    bytesTotal: number | null,
  ) => {
    const rate =
      bytesProcessed == null
        ? { bytesPerSecond: null, etaSeconds: null }
        : rateFor(stage, bytesProcessed, bytesTotal);
    options?.onProgress?.({
      stage,
      percent: bytesProcessed == null ? null : measuredPercent(bytesProcessed, bytesTotal),
      bytesProcessed,
      bytesTotal,
      bytesPerSecond: rate.bytesPerSecond,
      etaSeconds: rate.etaSeconds,
      skippedStages: skippedStages(stage),
    });
  };

  emit('preparing', null, null);

  const poll = async () => {
    if (polling || downloadStarted || options?.signal?.aborted) return;
    polling = true;
    try {
      const snap = await fetchBackupBundleProgress(runId);
      if (downloadStarted || options?.signal?.aborted) return;
      if (
        snap.phase === 'preparing' ||
        snap.phase === 'compressing' ||
        snap.phase === 'finalising'
      ) {
        sawPackStage = true;
        const total = snap.bytesTotal != null && snap.bytesTotal > 0 ? snap.bytesTotal : null;
        emit(snap.phase, total == null ? null : snap.bytesProcessed, total);
        return;
      }
      if (snap.phase === 'ready') {
        emit('downloading', null, null);
      }
    } catch {
      // The bundle request reports the failure. A missed poll is not a percentage.
    } finally {
      polling = false;
    }
  };

  const pollTimer = setInterval(() => {
    void poll();
  }, 500);
  void poll();

  try {
    options?.onRequest?.();
    const response = await api.get(`/v1/admin/backups/runs/${runId}/bundle`, {
      responseType: 'blob',
      timeout: 0,
      signal: options?.signal,
      params: stepUpToken ? { stepUpToken } : undefined,
      headers: stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : undefined,
      onDownloadProgress: (event) => {
        downloadStarted = true;
        const total = event.total && event.total > 0 ? event.total : null;
        emit('downloading', event.loaded, total);
      },
    });
    downloadStarted = true;
    const blob = response.data as Blob;
    const expected = Number(response.headers['content-length'] ?? 0);
    emit('verifying', null, expected > 0 ? expected : null);
    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const isZip =
      header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
    if (!isZip) {
      throw new Error('The server did not return a ZIP archive. The file was not saved.');
    }
    if (expected > 0 && blob.size !== expected) {
      throw new Error(
        'The download was interrupted before the ZIP finished. The file was not saved.',
      );
    }
    emit('done', blob.size, blob.size);
    const { downloadBlob } = await import('@/utils/download-blob');
    downloadBlob(blob, filename.endsWith('.zip') ? filename : `${filename}.zip`);
  } catch (error) {
    if (options?.signal?.aborted) throw new BackupDownloadCancelled();
    throw error;
  } finally {
    clearInterval(pollTimer);
  }
}

export async function downloadBackupArtifact(
  runId: string,
  artifactId: string,
  filename: string,
  stepUpToken?: string,
) {
  const { data } = await api.get(`/v1/admin/backups/runs/${runId}/download/${artifactId}`, {
    responseType: 'blob',
    timeout: 0,
    params: stepUpToken ? { stepUpToken } : undefined,
    headers: stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : undefined,
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
