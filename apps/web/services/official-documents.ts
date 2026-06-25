import { api } from '@/services/api';

export type OfficialDocumentType =
  | 'NOTICE'
  | 'CIRCULAR'
  | 'OFFICE_ORDER'
  | 'HOLIDAY'
  | 'MEMORANDUM'
  | 'EXAM'
  | 'STAFF'
  | 'STUDENT'
  | 'URGENT'
  | 'TENDER'
  | 'APPOINTMENT_ORDER'
  | 'MEETING_NOTICE';

export type OfficialDocumentStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'ARCHIVED';

export type OfficialDocument = {
  id: string;
  documentType: string;
  status: OfficialDocumentStatus;
  priority: string;
  referenceNo?: string | null;
  verifyToken: string;
  title: string;
  subject?: string | null;
  salutation?: string | null;
  bodyHtml: string;
  audience: Record<string, unknown>;
  printSettings: Record<string, unknown>;
  issuerId?: string | null;
  letterheadId?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  printedAt?: string | null;
  archivedAt?: string | null;
  printCount: number;
  downloadCount: number;
  currentVersion: number;
  rejectionNote?: string | null;
  createdAt: string;
  updatedAt: string;
  issuer?: OfficialDocumentIssuer | null;
};

export type OfficialDocumentIssuer = {
  id: string;
  roleCode: string;
  name: string;
  designation: string;
  signaturePath?: string | null;
  sealPath?: string | null;
  refPrefix?: string | null;
  letterhead?: OfficialLetterhead | null;
};

export type OfficialLetterhead = {
  id: string;
  code: string;
  name: string;
  collegeName: string;
  addressLine: string;
  contactLine?: string | null;
  logoPath?: string | null;
  isDefault: boolean;
};

export type OfficialDocumentTemplate = {
  id: string;
  documentType: string;
  name: string;
  title?: string | null;
  subject?: string | null;
  salutation?: string | null;
  bodyHtml: string;
};

export type OfficialDocumentsDashboard = {
  stats: {
    total: number;
    today: number;
    thisMonth: number;
    pendingApproval: number;
    published: number;
    drafts: number;
    archived: number;
  };
  recentlyPrinted: Array<{
    id: string;
    title: string;
    referenceNo?: string | null;
    printedAt?: string | null;
    printCount: number;
  }>;
  frequentTemplates: Array<{ id: string; name: string; documentType: string }>;
  upcomingScheduled: Array<{
    id: string;
    title: string;
    scheduledAt?: string | null;
    documentType: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    createdAt: string;
    document?: { id: string; title: string; referenceNo?: string | null };
  }>;
  byType: Array<{ documentType: string; count: number }>;
};

export type CreateOfficialDocumentPayload = {
  documentType: string;
  title: string;
  subject?: string;
  salutation?: string;
  bodyHtml: string;
  priority?: string;
  issuerId?: string;
  letterheadId?: string;
  audience?: Record<string, unknown>;
  effectiveDate?: string;
  expiryDate?: string;
  scheduledAt?: string;
};

export async function fetchOfficialDocumentsDashboard(): Promise<OfficialDocumentsDashboard> {
  const { data } = await api.get('/v1/admin/official-documents/dashboard');
  return data;
}

export async function fetchOfficialDocuments(params?: {
  page?: number;
  limit?: number;
  q?: string;
  documentType?: string;
  status?: string;
  priority?: string;
  issuerId?: string;
  from?: string;
  to?: string;
}) {
  const { data } = await api.get('/v1/admin/official-documents', { params });
  return data as { items: OfficialDocument[]; total: number; page: number; limit: number };
}

export async function fetchOfficialDocument(id: string) {
  const { data } = await api.get(`/v1/admin/official-documents/${id}`);
  return data as OfficialDocument;
}

export async function createOfficialDocument(payload: CreateOfficialDocumentPayload) {
  const { data } = await api.post('/v1/admin/official-documents', payload);
  return data as OfficialDocument;
}

export async function updateOfficialDocument(
  id: string,
  payload: Partial<CreateOfficialDocumentPayload>,
) {
  const { data } = await api.patch(`/v1/admin/official-documents/${id}`, payload);
  return data as OfficialDocument;
}

export async function submitOfficialDocumentForApproval(id: string) {
  const { data } = await api.post(`/v1/admin/official-documents/${id}/submit-for-approval`);
  return data;
}

export async function approveOfficialDocument(id: string, note?: string) {
  const { data } = await api.post(`/v1/admin/official-documents/${id}/approve`, { note });
  return data;
}

export async function rejectOfficialDocument(id: string, note: string) {
  const { data } = await api.post(`/v1/admin/official-documents/${id}/reject`, { note });
  return data;
}

export async function archiveOfficialDocument(id: string) {
  const { data } = await api.post(`/v1/admin/official-documents/${id}/archive`);
  return data;
}

export async function recordOfficialDocumentPrint(id: string) {
  const { data } = await api.post(`/v1/admin/official-documents/${id}/print`);
  return data;
}

export async function downloadOfficialDocumentPdf(id: string) {
  const response = await api.get(`/v1/admin/official-documents/${id}/pdf`, {
    responseType: 'blob',
  });
  return response.data as Blob;
}

export async function fetchOfficialDocumentIssuers() {
  const { data } = await api.get('/v1/admin/official-documents/settings/issuers');
  return data as OfficialDocumentIssuer[];
}

export async function fetchOfficialDocumentTemplates(documentType?: string) {
  const { data } = await api.get('/v1/admin/official-documents/settings/templates', {
    params: documentType ? { documentType } : undefined,
  });
  return data as OfficialDocumentTemplate[];
}

export async function updateOfficialDocumentIssuer(
  id: string,
  payload: Partial<{
    name: string;
    designation: string;
    signaturePath: string;
    sealPath: string;
    refPrefix: string;
  }>,
) {
  const { data } = await api.patch(`/v1/admin/official-documents/settings/issuers/${id}`, payload);
  return data;
}

export async function fetchOfficialDocumentSettings() {
  const { data } = await api.get('/v1/admin/official-documents/settings/config');
  return data;
}

export async function verifyOfficialDocumentPublic(token: string) {
  const { data } = await api.get(`/v1/verify/official-document/${token}`);
  return data;
}

export const DOCUMENT_TYPE_OPTIONS: { value: OfficialDocumentType; label: string }[] = [
  { value: 'NOTICE', label: 'Notice' },
  { value: 'CIRCULAR', label: 'Circular' },
  { value: 'OFFICE_ORDER', label: 'Office Order' },
  { value: 'HOLIDAY', label: 'Holiday Notice' },
  { value: 'MEMORANDUM', label: 'Memorandum' },
  { value: 'EXAM', label: 'Examination Notice' },
  { value: 'STAFF', label: 'Staff Notice' },
  { value: 'STUDENT', label: 'Student Notice' },
  { value: 'URGENT', label: 'Urgent Notice' },
  { value: 'TENDER', label: 'Tender Notice' },
  { value: 'MEETING_NOTICE', label: 'Meeting Notice' },
  { value: 'APPOINTMENT_ORDER', label: 'Appointment Order' },
];

export const AUDIENCE_OPTIONS = [
  { key: 'students', label: 'Students' },
  { key: 'staff', label: 'Staff' },
  { key: 'faculty', label: 'Faculty' },
  { key: 'parents', label: 'Parents' },
  { key: 'public', label: 'Public' },
  { key: 'hostel', label: 'Hostel' },
  { key: 'ncc', label: 'NCC' },
  { key: 'nss', label: 'NSS' },
  { key: 'clubs', label: 'Clubs' },
] as const;

export const SMART_VARIABLES = [
  '{{Today}}',
  '{{CollegeName}}',
  '{{CollegeAddress}}',
  '{{ReferenceNo}}',
  '{{AcademicYear}}',
  '{{IssuerName}}',
  '{{Designation}}',
  '{{Principal}}',
  '{{VicePrincipal}}',
];
