import { api } from '@/services/api';
import { getApiBaseUrl } from '@/lib/http/env';

export type IdCardDashboard = {
  studentCards: { generated: number; pending: number; printed: number; assigned: number };
  staffCards: { generated: number; pending: number; printed: number; assigned: number };
  rfid: { mapped: number; unmapped: number; studentMapped: number; staffMapped: number };
  lostCards: { active: number };
};

export type IdCardPrintRequestRow = {
  id: string;
  holderType: string;
  studentId: string | null;
  staffProfileId: string | null;
  enrollmentNumber: string | null;
  fullName: string | null;
  requestType: string;
  status: string;
  note: string | null;
  submittedAt: string;
  completedAt: string | null;
};

export type IdCardTemplate = {
  id: string;
  code: string;
  name: string;
  holderType: string;
  isDefault: boolean;
  layout: Record<string, unknown>;
};

export type IdCardIssue = {
  id: string;
  cardNumber: string;
  holderType: string;
  status: string;
  studentId: string | null;
  staffProfileId: string | null;
  qrPayload: string | null;
  rfidUid?: string | null;
  printedAt?: string | null;
  createdAt: string;
};

export type IdCardSettings = {
  qrPrefix: string;
  qrFormat: string;
  barcodeFormat: string;
  validityYears: number;
  showBloodGroup: boolean;
  showRfidOnCard: boolean;
  institutionSignatureUrl: string | null;
  watermarkEnabled: boolean;
  cardWidthMm: string;
  cardHeightMm: string;
};

export async function fetchIdCardDashboard(): Promise<IdCardDashboard> {
  const { data } = await api.get('/v1/id-cards/dashboard');
  return data;
}

export async function fetchIdCardPrintRequests(status?: string): Promise<IdCardPrintRequestRow[]> {
  const { data } = await api.get('/v1/id-cards/print-requests', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function completeIdCardPrintRequest(id: string, issueId?: string) {
  const { data } = await api.patch(`/v1/id-cards/print-requests/${id}/complete`, { issueId });
  return data;
}

export async function fetchIdCardTemplates(): Promise<IdCardTemplate[]> {
  const { data } = await api.get('/v1/id-cards/templates');
  return data;
}

export async function fetchIdCardTemplate(id: string): Promise<IdCardTemplate> {
  const { data } = await api.get(`/v1/id-cards/templates/${id}`);
  return data;
}

export async function updateIdCardTemplate(
  id: string,
  payload: { name?: string; layout?: Record<string, unknown> },
) {
  const { data } = await api.patch(`/v1/id-cards/templates/${id}`, payload);
  return data as IdCardTemplate;
}

export async function createIdCardTemplate(payload: {
  code: string;
  name: string;
  holderType: string;
  layout: Record<string, unknown>;
  setAsDefault?: boolean;
}) {
  const { data } = await api.post('/v1/id-cards/templates', payload);
  return data as IdCardTemplate;
}

export async function duplicateIdCardTemplate(id: string) {
  const { data } = await api.post(`/v1/id-cards/templates/${id}/duplicate`);
  return data as IdCardTemplate;
}

export async function setDefaultIdCardTemplate(id: string) {
  const { data } = await api.post(`/v1/id-cards/templates/${id}/set-default`);
  return data as IdCardTemplate;
}

export async function fetchIdCardIssues(params?: {
  holderType?: string;
  status?: string;
  statuses?: string;
  studentId?: string;
  staffProfileId?: string;
  departmentId?: string;
  staffType?: string;
  staffOnly?: boolean;
  studentOnly?: boolean;
  limit?: number;
}): Promise<IdCardIssue[]> {
  const { data } = await api.get('/v1/id-cards/issues', { params });
  return data;
}

export async function fetchAllStaffIdCardIssues(params?: {
  departmentId?: string;
  staffType?: string;
}): Promise<IdCardIssue[]> {
  return fetchIdCardIssues({
    staffOnly: true,
    statuses: 'GENERATED,PRINTED,ASSIGNED',
    limit: 2000,
    departmentId: params?.departmentId,
    staffType: params?.staffType,
  });
}

export async function fetchAllStudentIdCardIssues(params?: {
  departmentId?: string;
}): Promise<IdCardIssue[]> {
  return fetchIdCardIssues({
    studentOnly: true,
    statuses: 'GENERATED,PRINTED,ASSIGNED',
    limit: 2000,
    departmentId: params?.departmentId,
  });
}

export async function fetchIdCardSettings(): Promise<IdCardSettings> {
  const { data } = await api.get('/v1/id-cards/settings');
  return data;
}

export async function updateIdCardSettings(payload: Partial<IdCardSettings>) {
  const { data } = await api.patch('/v1/id-cards/settings', payload);
  return data;
}

export async function bulkGenerateIdCards(payload: {
  holderType: 'STUDENT' | 'STAFF';
  departmentId?: string;
  programme?: string;
  semester?: number;
  batch?: string;
  studentIds?: string[];
  staffProfileIds?: string[];
  staffType?: string;
}) {
  const { data } = await api.post('/v1/id-cards/bulk-generate', payload);
  return data as { generated: number; skipped?: number; total?: number };
}

export async function generateIdCard(payload: {
  holderType: string;
  studentId?: string;
  staffProfileId?: string;
}) {
  const { data } = await api.post('/v1/id-cards/generate', payload);
  return data;
}

export async function reissueIdCard(payload: {
  previousIssueId: string;
  reason: string;
  reissueFee?: number;
  note?: string;
}) {
  const { data } = await api.post('/v1/id-cards/reissue', payload);
  return data;
}

export async function reportLostIdCard(issueId: string, note?: string) {
  const { data } = await api.post('/v1/id-cards/report-lost', { issueId, note });
  return data;
}

export async function fetchIdCardReportsSummary() {
  const { data } = await api.get('/v1/id-cards/reports/summary');
  return data;
}

export async function renderIdCardPdf(
  html: string,
  opts?: { testMode?: boolean; pageCount?: number; timeoutMs?: number },
): Promise<Blob> {
  const res = await api.post(
    '/v1/id-cards/render-pdf',
    { html, testMode: opts?.testMode, pageCount: opts?.pageCount },
    { responseType: 'blob', timeout: opts?.timeoutMs ?? 120_000 },
  );
  return res.data as Blob;
}

export type IdCardBackgroundUploadResult = {
  imageUrl: string;
  naturalWidth: number | null;
  naturalHeight: number | null;
  fileSizeBytes: number;
  mimeType: string;
};

export async function uploadIdCardBackground(
  file: File,
  opts?: { side?: 'front' | 'back'; templateId?: string },
): Promise<IdCardBackgroundUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const params = new URLSearchParams();
  if (opts?.side) params.set('side', opts.side);
  if (opts?.templateId) params.set('templateId', opts.templateId);
  const qs = params.toString();
  const { data } = await api.post<IdCardBackgroundUploadResult>(
    `/v1/id-cards/templates/background-upload${qs ? `?${qs}` : ''}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function verifyIdCardPublic(code: string) {
  const res = await fetch(`${getApiBaseUrl()}/v1/verify/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    return { valid: false as const, message: 'Verification unavailable' };
  }
  const body = await res.json();
  const payload = body?.data ?? body;
  return payload as {
    valid: boolean;
    message?: string;
    holderType?: string;
    cardNumber?: string;
    status?: string;
    display?: {
      photoUrl: string | null;
      name: string;
      department: string | null;
      designation: string | null;
      roleLabel: string;
    };
  };
}
