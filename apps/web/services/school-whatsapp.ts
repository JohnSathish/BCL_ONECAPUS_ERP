import { api } from './api';

export async function fetchSchoolWaDashboard() {
  const { data } = await api.get('/v1/school-sis/whatsapp/dashboard');
  return data;
}

export async function fetchSchoolWaAccounts() {
  const { data } = await api.get('/v1/school-sis/whatsapp/accounts');
  return data;
}

export async function fetchSchoolWaEmbeddedConfig() {
  const { data } = await api.get('/v1/school-sis/whatsapp/embedded-config');
  return data;
}

export async function saveSchoolWaAccount(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-sis/whatsapp/accounts/${id}`, payload)
    : await api.post('/v1/school-sis/whatsapp/accounts', payload);
  return data;
}

export async function connectSchoolWaEmbedded(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/whatsapp/accounts/connect', payload);
  return data;
}

export async function testSchoolWaConnection(phoneNumberId?: string) {
  const { data } = await api.post('/v1/school-sis/whatsapp/accounts/test', null, {
    params: { phoneNumberId },
  });
  return data;
}

export async function disconnectSchoolWaAccount(id: string) {
  const { data } = await api.post(`/v1/school-sis/whatsapp/accounts/${id}/disconnect`);
  return data;
}

export async function saveSchoolWaNumber(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/whatsapp/numbers', payload);
  return data;
}

export async function fetchSchoolWaSettings() {
  const { data } = await api.get('/v1/school-sis/whatsapp/settings');
  return data;
}

export async function saveSchoolWaSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/whatsapp/settings', payload);
  return data;
}

export async function fetchSchoolWaTemplates() {
  const { data } = await api.get('/v1/school-sis/whatsapp/templates');
  return data;
}

export async function saveSchoolWaTemplate(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/whatsapp/templates', payload);
  return data;
}

export async function syncSchoolWaTemplates() {
  const { data } = await api.post('/v1/school-sis/whatsapp/templates/sync');
  return data;
}

export async function fetchSchoolWaContacts(q?: string) {
  const { data } = await api.get('/v1/school-sis/whatsapp/contacts', { params: { q } });
  return data;
}

export async function syncSchoolWaContacts() {
  const { data } = await api.post('/v1/school-sis/whatsapp/contacts/sync');
  return data;
}

export async function fetchSchoolWaConversations(filter?: string) {
  const { data } = await api.get('/v1/school-sis/whatsapp/conversations', { params: { filter } });
  return data;
}

export async function fetchSchoolWaConversation(id: string) {
  const { data } = await api.get(`/v1/school-sis/whatsapp/conversations/${id}`);
  return data;
}

export async function patchSchoolWaConversation(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/school-sis/whatsapp/conversations/${id}`, payload);
  return data;
}

export async function addSchoolWaNote(id: string, body: string) {
  const { data } = await api.post(`/v1/school-sis/whatsapp/conversations/${id}/notes`, { body });
  return data;
}

export async function sendSchoolWaText(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/whatsapp/messages/send', payload);
  return data;
}

export async function sendSchoolWaTemplate(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/whatsapp/messages/send-template', payload);
  return data;
}

export async function retrySchoolWaMessage(id: string) {
  const { data } = await api.post(`/v1/school-sis/whatsapp/messages/${id}/retry`);
  return data;
}

export async function previewSchoolWaAudience(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/whatsapp/audience/preview', payload);
  return data;
}

export async function fetchSchoolWaCampaigns() {
  const { data } = await api.get('/v1/school-sis/whatsapp/campaigns');
  return data;
}

export async function saveSchoolWaCampaign(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/whatsapp/campaigns', payload);
  return data;
}

export async function sendSchoolWaCampaign(id: string, confirm = true) {
  const { data } = await api.post(`/v1/school-sis/whatsapp/campaigns/${id}/send`, { confirm });
  return data;
}

export async function scheduleSchoolWaCampaign(id: string, scheduledAt: string) {
  const { data } = await api.post(`/v1/school-sis/whatsapp/campaigns/${id}/schedule`, {
    scheduledAt,
  });
  return data;
}

export async function fetchSchoolWaDelivery(campaignId?: string) {
  const { data } = await api.get('/v1/school-sis/whatsapp/delivery-status', {
    params: { campaignId },
  });
  return data;
}

export async function fetchSchoolWaOptIns() {
  const { data } = await api.get('/v1/school-sis/whatsapp/opt-ins');
  return data;
}

export async function saveSchoolWaOptIn(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/whatsapp/opt-ins', payload);
  return data;
}

export async function fetchSchoolWaAutomations() {
  const { data } = await api.get('/v1/school-sis/whatsapp/automations');
  return data;
}

export async function saveSchoolWaAutomation(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/whatsapp/automations', payload);
  return data;
}

export async function fetchSchoolWaMedia() {
  const { data } = await api.get('/v1/school-sis/whatsapp/media');
  return data;
}

export async function fetchSchoolWaFlows() {
  const { data } = await api.get('/v1/school-sis/whatsapp/flows');
  return data;
}

export async function fetchSchoolWaAnalytics(from?: string, to?: string) {
  const { data } = await api.get('/v1/school-sis/whatsapp/analytics', { params: { from, to } });
  return data;
}

export async function fetchSchoolWaLogs() {
  const { data } = await api.get('/v1/school-sis/whatsapp/logs');
  return data;
}
