import { api } from './api';

export async function fetchSchoolOpsDashboard() {
  const { data } = await api.get('/v1/school-sis/ops/dashboard');
  return data as Record<string, unknown>;
}

export async function fetchSchoolOpsStatus() {
  const { data } = await api.get('/v1/school-sis/ops/status');
  return data as Record<string, unknown>;
}

export async function fetchSchoolOpsCache() {
  const { data } = await api.get('/v1/school-sis/ops/cache');
  return data as Record<string, unknown>;
}

export async function clearSchoolOpsCache(scope: string) {
  const { data } = await api.post('/v1/school-sis/ops/cache/clear', { scope, confirm: true });
  return data;
}

export async function fetchSchoolOpsBackups() {
  const { data } = await api.get('/v1/school-sis/ops/backups');
  return data as Record<string, unknown>;
}

export async function createSchoolOpsBackup(kind: string) {
  const { data } = await api.post('/v1/school-sis/ops/backups', { kind });
  return data;
}

export async function saveSchoolOpsBackupSchedule(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/ops/backups/schedule', payload);
  return data;
}

export async function verifySchoolOpsBackup(id: string) {
  const { data } = await api.post(`/v1/school-sis/ops/backups/${id}/verify`);
  return data;
}

export async function restoreSchoolOpsBackup(id: string) {
  const { data } = await api.post(`/v1/school-sis/ops/backups/${id}/restore`, { confirm: true });
  return data;
}

export async function deleteSchoolOpsBackup(id: string) {
  const { data } = await api.delete(`/v1/school-sis/ops/backups/${id}`);
  return data;
}

export async function downloadSchoolOpsBackup(id: string) {
  const { data } = await api.get(`/v1/school-sis/ops/backups/${id}/download`, {
    responseType: 'blob',
  });
  return data as Blob;
}

export async function fetchSchoolOpsLogs(params: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/school-sis/ops/logs', { params });
  return data as { total: number; page: number; items: Array<Record<string, unknown>> };
}

export async function exportSchoolOpsLogs() {
  const { data } = await api.get('/v1/school-sis/ops/logs/export');
  return data as Array<Record<string, unknown>>;
}

export async function purgeSchoolOpsLogs() {
  const { data } = await api.post('/v1/school-sis/ops/logs/purge');
  return data;
}

export async function fetchSchoolOpsAudit() {
  const { data } = await api.get('/v1/school-sis/ops/audit');
  return data as { items: Array<Record<string, unknown>> };
}

export async function fetchSchoolOpsMaintenance() {
  const { data } = await api.get('/v1/school-sis/ops/maintenance');
  return data as Record<string, unknown>;
}

export async function saveSchoolOpsMaintenance(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/ops/maintenance', payload);
  return data;
}

export async function fetchSchoolOpsConfig() {
  const { data } = await api.get('/v1/school-sis/ops/config');
  return data as Record<string, unknown>;
}

export async function saveSchoolOpsConfig(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/ops/config', payload);
  return data;
}

export async function testSchoolOpsChannel(channel: string) {
  const { data } = await api.post(`/v1/school-sis/ops/diagnostics/${channel}`);
  return data as Record<string, unknown>;
}

export async function fetchSchoolOpsStorage() {
  const { data } = await api.get('/v1/school-sis/ops/storage');
  return data as Record<string, unknown>;
}

export async function fetchSchoolOpsJobs() {
  const { data } = await api.get('/v1/school-sis/ops/jobs');
  return data as { queues: Array<Record<string, unknown>> };
}

export async function retrySchoolOpsJob(queue: string, id: string) {
  const { data } = await api.post(`/v1/school-sis/ops/jobs/${queue}/${id}/retry`);
  return data;
}

export async function cancelSchoolOpsJob(queue: string, id: string) {
  const { data } = await api.post(`/v1/school-sis/ops/jobs/${queue}/${id}/cancel`);
  return data;
}

export async function fetchSchoolOpsAbout() {
  const { data } = await api.get('/v1/school-sis/ops/about');
  return data as Record<string, unknown>;
}
