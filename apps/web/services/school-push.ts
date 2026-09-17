import { api } from './api';

export async function fetchSchoolPushDashboard() {
  const { data } = await api.get('/v1/school-sis/notifications/dashboard');
  return data;
}

export async function previewSchoolPushAudience(audience: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/notifications/audience/preview', audience);
  return data as { recipients: number; devices: number; sample: Array<{ userId: string }> };
}

export async function testSchoolPush() {
  const { data } = await api.post('/v1/school-sis/notifications/test');
  return data as {
    ok: boolean;
    devices: number;
    successCount: number;
    failureCount: number;
    engine?: string;
  };
}

export async function draftSchoolPush(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/notifications/draft', payload);
  return data;
}

export async function fetchSchoolPushCampaigns(status?: string) {
  const { data } = await api.get('/v1/school-sis/notifications', { params: { status } });
  return data as Array<Record<string, unknown>>;
}

export async function fetchSchoolPushCampaign(id: string) {
  const { data } = await api.get(`/v1/school-sis/notifications/${id}`);
  return data as Record<string, unknown>;
}

export async function cancelSchoolPush(id: string) {
  const { data } = await api.post(`/v1/school-sis/notifications/${id}/cancel`);
  return data;
}

export async function retrySchoolPush(id: string) {
  const { data } = await api.post(`/v1/school-sis/notifications/${id}/retry`);
  return data;
}

export async function archiveSchoolPush(id: string) {
  const { data } = await api.delete(`/v1/school-sis/notifications/${id}`);
  return data;
}

export async function fetchSchoolPushTemplates() {
  const { data } = await api.get('/v1/school-sis/notifications/templates');
  return data as Array<Record<string, unknown>>;
}

export async function saveSchoolPushTemplate(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/notifications/templates/${id}`, payload)
    : await api.post('/v1/school-sis/notifications/templates', payload);
  return data;
}

export async function fetchSchoolPushDevices(q?: string) {
  const { data } = await api.get('/v1/school-sis/notifications/devices', { params: { q } });
  return data as Array<Record<string, unknown>>;
}

export async function unregisterSchoolPushDevice(id: string) {
  const { data } = await api.delete(`/v1/school-sis/notifications/devices/${id}`);
  return data;
}

export async function fetchSchoolPushSettings() {
  const { data } = await api.get('/v1/school-sis/notifications/settings');
  return data as Record<string, unknown>;
}

export async function saveSchoolPushSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/notifications/settings', payload);
  return data;
}

export async function fetchSchoolPushPreferences() {
  const { data } = await api.get('/v1/school-sis/notifications/preferences');
  return data as Array<{ category: string; enabled: boolean }>;
}

export async function saveSchoolPushPreference(payload: { category: string; enabled: boolean }) {
  const { data } = await api.post('/v1/school-sis/notifications/preferences', payload);
  return data;
}

export async function fetchSchoolPushRules() {
  const { data } = await api.get('/v1/school-sis/notifications/rules');
  return data as Array<Record<string, unknown>>;
}

export async function saveSchoolPushRule(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/notifications/rules', payload);
  return data;
}

export async function fetchSchoolPushDelivery(campaignId?: string) {
  const { data } = await api.get('/v1/school-sis/notifications/delivery-report', {
    params: { campaignId },
  });
  return data as Array<Record<string, unknown>>;
}

export async function fetchSchoolPushLogs() {
  const { data } = await api.get('/v1/school-sis/notifications/logs');
  return data as Array<Record<string, unknown>>;
}

export async function uploadSchoolPushImage(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/school-sis/notifications/media', form);
  return data as { url: string; kind?: 'image' | 'pdf'; fileName?: string };
}
