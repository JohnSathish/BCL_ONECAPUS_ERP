import { api } from './api';

const base = '/v1/school-sis/sms';

export async function fetchSmsDashboard() {
  const { data } = await api.get(`${base}/dashboard`);
  return data as Record<string, unknown>;
}

export async function previewSms(payload: {
  template?: string;
  variables?: Record<string, string>;
}) {
  const { data } = await api.post(`${base}/preview`, payload);
  return data as Record<string, unknown>;
}

export async function previewSmsRecipients(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/recipients`, payload);
  return data as Record<string, unknown>;
}

export async function sendSmsCampaign(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/campaigns`, payload);
  return data;
}

export async function fetchSmsCampaigns() {
  const { data } = await api.get(`${base}/campaigns`);
  return data as Array<Record<string, unknown>>;
}

export async function cancelSmsCampaign(id: string) {
  const { data } = await api.post(`${base}/campaigns/${id}/cancel`);
  return data;
}

export async function fetchSmsMessages(params?: { status?: string; search?: string }) {
  const { data } = await api.get(`${base}/messages`, { params });
  return data as Array<Record<string, unknown>>;
}

export async function retrySms(id: string) {
  const { data } = await api.post(`${base}/messages/${id}/retry`);
  return data;
}

export async function fetchSmsTemplates() {
  const { data } = await api.get(`${base}/templates`);
  return data as Array<Record<string, unknown>>;
}

export async function saveSmsTemplate(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`${base}/templates/${id}`, payload)
    : await api.post(`${base}/templates`, payload);
  return data;
}

export async function fetchSmsGateways() {
  const { data } = await api.get(`${base}/gateways`);
  return data as Array<Record<string, unknown>>;
}

export async function saveSmsGateway(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`${base}/gateways/${id}`, payload)
    : await api.post(`${base}/gateways`, payload);
  return data;
}

export async function testSmsGateway(id: string) {
  const { data } = await api.post(`${base}/gateways/${id}/test`);
  return data;
}

export async function defaultSmsGateway(id: string) {
  const { data } = await api.post(`${base}/gateways/${id}/set-default`);
  return data;
}

export async function fetchSmsDlt() {
  const { data } = await api.get(`${base}/dlt`);
  return data as Record<string, unknown>;
}

export async function saveSmsHeader(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/dlt/headers`, payload);
  return data;
}

export async function saveSmsDltTemplate(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/dlt/templates`, payload);
  return data;
}

export async function fetchSmsSettings() {
  const { data } = await api.get(`${base}/settings`);
  return data as Record<string, unknown>;
}

export async function saveSmsSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch(`${base}/settings`, payload);
  return data;
}

export async function adjustSmsCredits(amount: number, note?: string) {
  const { data } = await api.post(`${base}/credits`, { amount, note });
  return data;
}

export async function downloadSmsExport(format: 'pdf' | 'xlsx' | 'csv' = 'pdf') {
  const { data } = await api.get(`${base}/export`, { params: { format }, responseType: 'blob' });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sms-usage.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
