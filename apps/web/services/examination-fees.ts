import { api } from '@/services/api';

const base = '/v1/examination-fees';

export async function fetchExamFeeDashboard(sessionId?: string) {
  const { data } = await api.get(`${base}/dashboard`, {
    params: sessionId ? { sessionId } : undefined,
  });
  return data;
}

export async function fetchExamFeeSettings() {
  const { data } = await api.get(`${base}/settings`);
  return data;
}

export async function updateExamFeeSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch(`${base}/settings`, payload);
  return data;
}

export async function fetchExamFeeMasters() {
  const { data } = await api.get(`${base}/masters`);
  return data;
}

export async function seedExamFeeMasters() {
  const { data } = await api.post(`${base}/masters/seed-defaults`, {});
  return data;
}

export async function createExamFeeMaster(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/masters`, payload);
  return data;
}

export async function updateExamFeeMaster(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`${base}/masters/${id}`, payload);
  return data;
}

export async function fetchExamFeeSessions() {
  const { data } = await api.get(`${base}/sessions`);
  return data;
}

export async function fetchActiveExamFeeSession() {
  const { data } = await api.get(`${base}/sessions/active`);
  return data;
}

export async function createExamFeeSession(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/sessions`, payload);
  return data;
}

export async function updateExamFeeSession(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`${base}/sessions/${id}`, payload);
  return data;
}

export async function fetchExamApplications(params?: Record<string, unknown>) {
  const { data } = await api.get(`${base}/applications`, { params });
  return data;
}

export async function fetchMyExamApplications() {
  const { data } = await api.get(`${base}/applications/mine`);
  return data;
}

export async function startExamApplication(sessionId: string) {
  const { data } = await api.post(`${base}/applications/start`, { sessionId });
  return data;
}

export async function fetchExamApplication(id: string) {
  const { data } = await api.get(`${base}/applications/${id}`);
  return data;
}

export async function addExamBackPaper(id: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/applications/${id}/back-papers`, payload);
  return data;
}

export async function removeExamBackPaper(id: string, backPaperId: string) {
  const { data } = await api.delete(`${base}/applications/${id}/back-papers/${backPaperId}`);
  return data;
}

export async function submitExamApplication(id: string, declarationAccepted: boolean) {
  const { data } = await api.post(`${base}/applications/${id}/submit`, {
    declarationAccepted,
  });
  return data;
}

export async function fetchExamBackPapers(sessionId?: string) {
  const { data } = await api.get(`${base}/back-papers`, {
    params: sessionId ? { sessionId } : undefined,
  });
  return data;
}

export async function initiateExamOnlinePayment(id: string) {
  const { data } = await api.post(`${base}/applications/${id}/payments/online`, {});
  return data;
}

export async function completeExamOnlinePayment(id: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/applications/${id}/payments/online/complete`, payload);
  return data;
}

export async function collectExamManualPayment(id: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/applications/${id}/payments/manual`, payload);
  return data;
}

export async function fetchExamPayments(sessionId?: string) {
  const { data } = await api.get(`${base}/payments`, {
    params: sessionId ? { sessionId } : undefined,
  });
  return data;
}

export async function fetchExamVerification(sessionId?: string) {
  const { data } = await api.get(`${base}/verification`, {
    params: sessionId ? { sessionId } : undefined,
  });
  return data;
}

export async function verifyExamApplication(id: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/applications/${id}/verify`, payload);
  return data;
}

export async function fetchExamReceipts() {
  const { data } = await api.get(`${base}/receipts`);
  return data;
}

export async function fetchExamReport(type: string, params?: Record<string, unknown>) {
  const { data } = await api.get(`${base}/reports/${type}`, { params });
  return data;
}

export function examReceiptPdfUrl(id: string) {
  return `${base}/receipts/${id}/pdf`;
}
