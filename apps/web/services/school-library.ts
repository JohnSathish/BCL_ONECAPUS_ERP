import { api } from './api';

const base = '/v1/school-sis/library';

export async function fetchLibDashboard() {
  const { data } = await api.get(`${base}/dashboard`);
  return data as Record<string, unknown>;
}

export async function fetchLibSettings() {
  const { data } = await api.get(`${base}/settings`);
  return data as Record<string, unknown>;
}

export async function saveLibSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch(`${base}/settings`, payload);
  return data;
}

export async function fetchLibRules() {
  const { data } = await api.get(`${base}/rules`);
  return data as Array<Record<string, unknown>>;
}

export async function saveLibRule(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/rules`, payload);
  return data;
}

export async function fetchLibMasters() {
  const { data } = await api.get(`${base}/masters`);
  return data as Record<string, Array<Record<string, unknown>>>;
}

export async function saveLibMaster(kind: string, payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/masters/${kind}`, payload);
  return data;
}

export async function fetchLibBooks(params?: { search?: string; available?: string }) {
  const { data } = await api.get(`${base}/books`, { params });
  return data as Array<Record<string, unknown>>;
}

export async function fetchLibBook(id: string) {
  const { data } = await api.get(`${base}/books/${id}`);
  return data as Record<string, unknown>;
}

export async function saveLibBook(payload: Record<string, unknown>, id?: string) {
  const { data } = id
    ? await api.patch(`${base}/books/${id}`, payload)
    : await api.post(`${base}/books`, payload);
  return data;
}

export async function addLibCopies(bookId: string, qty: number, locationId?: string) {
  const { data } = await api.post(`${base}/books/${bookId}/copies`, { qty, locationId });
  return data;
}

export async function syncLibMembers() {
  const { data } = await api.post(`${base}/members/sync`);
  return data;
}

export async function fetchLibMembers(params?: { kind?: string; search?: string }) {
  const { data } = await api.get(`${base}/members`, { params });
  return data as Array<Record<string, unknown>>;
}

export async function lookupLibMember(q: string) {
  const { data } = await api.get(`${base}/lookup/member`, { params: { q } });
  return data as Record<string, unknown> | null;
}

export async function lookupLibCopy(q: string) {
  const { data } = await api.get(`${base}/lookup/copy`, { params: { q } });
  return data as Record<string, unknown> | null;
}

export async function issueLibLoan(memberQuery: string, copyQuery: string) {
  const { data } = await api.post(`${base}/loans`, { memberQuery, copyQuery });
  return data;
}

export async function returnLibLoan(copyQuery: string, condition?: string, notes?: string) {
  const { data } = await api.post(`${base}/loans/return`, { copyQuery, condition, notes });
  return data;
}

export async function renewLibLoan(id: string) {
  const { data } = await api.post(`${base}/loans/${id}/renew`);
  return data;
}

export async function fetchLibLoans(status?: string) {
  const { data } = await api.get(`${base}/loans`, { params: { status } });
  return data as Array<Record<string, unknown>>;
}

export async function fetchLibReservations() {
  const { data } = await api.get(`${base}/reservations`);
  return data as Array<Record<string, unknown>>;
}

export async function createLibReservation(bookId: string, memberId: string) {
  const { data } = await api.post(`${base}/reservations`, { bookId, memberId });
  return data;
}

export async function fetchLibFines(status?: string) {
  const { data } = await api.get(`${base}/fines`, { params: { status } });
  return data as Array<Record<string, unknown>>;
}

export async function payLibFine(id: string, payload: { amount?: number; mode?: string }) {
  const { data } = await api.post(`${base}/fines/${id}/pay`, payload);
  return data;
}

export async function waiveLibFine(id: string, reason: string) {
  const { data } = await api.post(`${base}/fines/${id}/waive`, { reason });
  return data;
}

export async function markLibLost(copyId: string, recovery?: number) {
  const { data } = await api.post(`${base}/copies/${copyId}/lost`, { recovery });
  return data;
}

export async function fetchLibPurchases() {
  const { data } = await api.get(`${base}/purchases`);
  return data as Array<Record<string, unknown>>;
}

export async function saveLibPurchase(payload: Record<string, unknown>) {
  const { data } = await api.post(`${base}/purchases`, payload);
  return data;
}

export async function receiveLibPurchase(id: string) {
  const { data } = await api.post(`${base}/purchases/${id}/receive`);
  return data;
}

export async function startLibStock() {
  const { data } = await api.post(`${base}/stock`);
  return data as Record<string, unknown>;
}

export async function scanLibStock(id: string, barcode: string) {
  const { data } = await api.post(`${base}/stock/${id}/scan`, { barcode });
  return data;
}

export async function closeLibStock(id: string) {
  const { data } = await api.post(`${base}/stock/${id}/close`);
  return data;
}

export async function fetchLibAudit() {
  const { data } = await api.get(`${base}/audit`);
  return data as Array<Record<string, unknown>>;
}

export async function fetchLibActivity() {
  const { data } = await api.get(`${base}/activity`);
  return data;
}

export async function downloadLibExport(key: string, format: 'pdf' | 'xlsx' | 'csv' = 'pdf') {
  const { data } = await api.get(`${base}/export/${key}`, {
    params: { format },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `library-${key}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadLibLabels(copyIds: string[]) {
  const { data } = await api.post(`${base}/labels`, { copyIds }, { responseType: 'blob' });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'library-labels.pdf';
  a.click();
  URL.revokeObjectURL(url);
}
