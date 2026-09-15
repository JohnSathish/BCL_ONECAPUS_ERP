import { api } from './api';

export async function fetchSchoolAutoDashboard() {
  const { data } = await api.get('/v1/school-sis/automation/dashboard');
  return data;
}

export async function fetchSchoolAutoCatalog() {
  const { data } = await api.get('/v1/school-sis/automation/catalog');
  return data;
}

export async function fetchSchoolAutoWorkflows() {
  const { data } = await api.get('/v1/school-sis/automation/workflows');
  return data as Array<Record<string, unknown>>;
}

export async function fetchSchoolAutoWorkflow(id: string) {
  const { data } = await api.get(`/v1/school-sis/automation/workflows/${id}`);
  return data as Record<string, unknown>;
}

export async function saveSchoolAutoWorkflow(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/automation/workflows/${id}`, payload)
    : await api.post('/v1/school-sis/automation/workflows', payload);
  return data;
}

export async function activateSchoolAutoWorkflow(id: string) {
  const { data } = await api.post(`/v1/school-sis/automation/workflows/${id}/activate`);
  return data;
}

export async function pauseSchoolAutoWorkflow(id: string) {
  const { data } = await api.post(`/v1/school-sis/automation/workflows/${id}/pause`);
  return data;
}

export async function testSchoolAutoWorkflow(id: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`/v1/school-sis/automation/workflows/${id}/test`, payload);
  return data;
}

export async function runSchoolAutoWorkflow(id: string) {
  const { data } = await api.post(`/v1/school-sis/automation/workflows/${id}/run`, {
    confirm: true,
  });
  return data;
}

export async function archiveSchoolAutoWorkflow(id: string) {
  const { data } = await api.delete(`/v1/school-sis/automation/workflows/${id}`);
  return data;
}

export async function presetSchoolAutoWorkflow(presetId: string) {
  const { data } = await api.post(`/v1/school-sis/automation/workflows/from-preset/${presetId}`);
  return data;
}

export async function promptSchoolAutoWorkflow(prompt: string) {
  const { data } = await api.post('/v1/school-sis/automation/workflows/from-prompt', { prompt });
  return data;
}

export async function fetchSchoolAutoExecutions(status?: string) {
  const { data } = await api.get('/v1/school-sis/automation/executions', { params: { status } });
  return data as Array<Record<string, unknown>>;
}

export async function fetchSchoolAutoFailed() {
  const { data } = await api.get('/v1/school-sis/automation/failed-jobs');
  return data as Array<Record<string, unknown>>;
}

export async function retrySchoolAutoFailed(id: string) {
  const { data } = await api.post(`/v1/school-sis/automation/failed-jobs/${id}/retry`);
  return data;
}

export async function retryAllSchoolAutoFailed() {
  const { data } = await api.post('/v1/school-sis/automation/failed-jobs/retry-all');
  return data;
}

export async function fetchSchoolAutoTemplates() {
  const { data } = await api.get('/v1/school-sis/automation/templates');
  return data as Array<Record<string, unknown>>;
}

export async function saveSchoolAutoTemplate(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/automation/templates', payload);
  return data;
}

export async function fetchSchoolAutoReports() {
  const { data } = await api.get('/v1/school-sis/automation/reports');
  return data as Record<string, unknown>;
}

export async function fetchSchoolAutoSettings() {
  const { data } = await api.get('/v1/school-sis/automation/settings');
  return data as Record<string, unknown>;
}

export async function saveSchoolAutoSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/automation/settings', payload);
  return data;
}

export async function fetchSchoolAutoLogs() {
  const { data } = await api.get('/v1/school-sis/automation/logs');
  return data as Array<Record<string, unknown>>;
}
