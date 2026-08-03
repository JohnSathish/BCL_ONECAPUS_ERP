import { api } from '@/services/api';
import type {
  AcademicRoleDefinition,
  AssignSubjectPayload,
  CreateStaffPayload,
  EnhancedStaffSummary,
  PaginatedStaff,
  ProvisionStaffPortalPayload,
  StaffAward,
  StaffDesignation,
  StaffDirectoryRow,
  StaffDocumentAuditEntry,
  StaffDocumentCompliance,
  StaffDocumentExpiringReportRow,
  StaffDocumentMissingReportRow,
  StaffDocumentPendingReportRow,
  StaffListItem,
  StaffProfile,
  StaffPublication,
  StaffSubjectAssignment,
  TeachingAssignmentContext,
  TeachingAssignmentContextQuery,
  StaffExportParams,
  UpdateStaffPayload,
} from '@/types/staff';

export async function fetchEnhancedStaffSummary(): Promise<EnhancedStaffSummary> {
  const { data } = await api.get('/v1/staff/summary/enhanced');
  return data;
}

export async function fetchStaff(params?: {
  page?: number;
  limit?: number;
  search?: string;
  staffType?: string;
  departmentId?: string;
  designationId?: string;
  shiftId?: string;
  teachingShiftCategory?: string;
  status?: string;
  additionalRoleCode?: string;
  hodOnly?: boolean;
  activeTeachingOnly?: boolean;
  hasPublications?: boolean;
}): Promise<PaginatedStaff> {
  const { data } = await api.get('/v1/staff', { params });
  return data;
}

/** Loads every staff page for pickers. API caps at 100/page. */
export async function fetchAllStaff(
  params: Omit<NonNullable<Parameters<typeof fetchStaff>[0]>, 'page' | 'limit'> = {},
): Promise<{ data: StaffListItem[]; meta: { total: number } }> {
  const limit = 100;
  let page = 1;
  const all: StaffListItem[] = [];
  let total = 0;

  while (true) {
    const res = await fetchStaff({ ...params, page, limit });
    all.push(...res.data);
    total = res.meta.total;
    if (page >= res.meta.totalPages) break;
    page += 1;
  }

  return { data: all, meta: { total } };
}

export async function fetchStaffDirectory(
  params?: Parameters<typeof fetchStaff>[0],
): Promise<PaginatedStaff> {
  const { data } = await api.get('/v1/staff/directory', { params });
  return data;
}

export async function fetchStaffMember(id: string): Promise<StaffListItem> {
  const { data } = await api.get(`/v1/staff/${id}`);
  return data;
}

export async function fetchStaffProfile(id: string): Promise<StaffProfile> {
  const { data } = await api.get(`/v1/staff/${id}/profile`);
  return data;
}

export async function createStaff(payload: CreateStaffPayload): Promise<StaffProfile> {
  const { data } = await api.post('/v1/staff', payload);
  return data;
}

export async function suggestStaffShortCode(params: {
  fullName: string;
  departmentId?: string;
  primaryShiftId?: string;
  campusId?: string;
  excludeStaffId?: string;
}): Promise<{ shortCode: string; campusId: string | null }> {
  const { data } = await api.get('/v1/staff/short-code/suggest', { params });
  return data;
}

export async function updateStaff(id: string, payload: UpdateStaffPayload): Promise<StaffListItem> {
  const { data } = await api.patch(`/v1/staff/${id}`, payload);
  return data;
}

export async function deactivateStaff(id: string) {
  const { data } = await api.delete(`/v1/staff/${id}`);
  return data;
}

export async function updateStaffProfileSection(
  staffId: string,
  sectionKey: string,
  data: Record<string, unknown>,
) {
  const { data: result } = await api.patch(`/v1/staff/${staffId}/profile/sections/${sectionKey}`, {
    data,
  });
  return result as StaffProfile;
}

export async function fetchStaffSubjectAssignments(
  staffId: string,
): Promise<StaffSubjectAssignment[]> {
  const { data } = await api.get(`/v1/staff/${staffId}/subject-assignments`);
  return data;
}

export async function assignSubject(staffId: string, payload: AssignSubjectPayload) {
  const { data } = await api.post(`/v1/staff/${staffId}/subject-assignments`, payload);
  return data as StaffSubjectAssignment;
}

export async function fetchTeachingAssignmentContexts(
  staffId: string,
  params?: TeachingAssignmentContextQuery,
) {
  const { data } = await api.get(`/v1/staff/${staffId}/subject-assignments/contexts`, {
    params,
  });
  return data as {
    data: TeachingAssignmentContext[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  };
}

export async function fetchAssignableTeachingContexts(params?: TeachingAssignmentContextQuery) {
  const { data } = await api.get('/v1/staff/subject-assignment-contexts', {
    params,
  });
  return data as {
    data: TeachingAssignmentContext[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  };
}

export async function removeSubjectAssignment(staffId: string, assignmentId: string) {
  const { data } = await api.delete(`/v1/staff/${staffId}/subject-assignments/${assignmentId}`);
  return data;
}

export async function provisionStaffPortal(staffId: string, payload: ProvisionStaffPortalPayload) {
  const { data } = await api.post(`/v1/staff/${staffId}/portal`, payload);
  return data;
}

export async function deactivateStaffPortal(staffId: string) {
  const { data } = await api.post(`/v1/staff/${staffId}/portal/deactivate`);
  return data;
}

export async function uploadStaffPhoto(staffId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/staff/${staffId}/photo`, form);
  return data as { photoUrl: string };
}

export async function uploadStaffDocument(staffId: string, documentType: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  const { data } = await api.post(`/v1/staff/${staffId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteStaffDocument(staffId: string, docId: string) {
  const { data } = await api.delete(`/v1/staff/${staffId}/documents/${docId}`);
  return data;
}

export async function fetchStaffDocumentCompliance(staffId: string) {
  const { data } = await api.get<StaffDocumentCompliance>(
    `/v1/staff/${staffId}/documents/compliance`,
  );
  return data;
}

export async function fetchStaffDocumentAudit(staffId: string) {
  const { data } = await api.get<StaffDocumentAuditEntry[]>(`/v1/staff/${staffId}/documents/audit`);
  return data;
}

export async function verifyStaffDocument(
  staffId: string,
  docId: string,
  verificationStatus: string,
  verificationRemarks?: string,
) {
  const { data } = await api.patch(`/v1/staff/${staffId}/documents/${docId}/verify`, {
    verificationStatus,
    verificationRemarks,
  });
  return data;
}

export async function updateStaffDocumentMeta(
  staffId: string,
  docId: string,
  payload: { issueDate?: string; expiryDate?: string },
) {
  const { data } = await api.patch(`/v1/staff/${staffId}/documents/${docId}/meta`, payload);
  return data;
}

export async function downloadStaffDocumentsZip(staffId: string, verifiedOnly = false) {
  const res = await api.get(`/v1/staff/${staffId}/documents/download-zip`, {
    params: verifiedOnly ? { verifiedOnly: 'true' } : undefined,
    responseType: 'blob',
  });
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `staff-documents${verifiedOnly ? '-verified' : ''}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchStaffDocumentsMissingReport() {
  const { data } = await api.get<StaffDocumentMissingReportRow[]>(
    '/v1/staff/documents/reports/missing',
  );
  return data;
}

export async function fetchStaffDocumentsExpiringReport() {
  const { data } = await api.get<StaffDocumentExpiringReportRow[]>(
    '/v1/staff/documents/reports/expiring',
  );
  return data;
}

export async function fetchStaffDocumentsPendingReport() {
  const { data } = await api.get<StaffDocumentPendingReportRow[]>(
    '/v1/staff/documents/reports/pending-verification',
  );
  return data;
}

export async function uploadMyStaffDocument(documentType: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  const { data } = await api.post('/v1/staff/me/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function fetchMyStaffDocumentCompliance() {
  const { data } = await api.get<StaffDocumentCompliance>('/v1/staff/me/documents/compliance');
  return data;
}

export interface UpdateMyProfilePayload {
  mobile?: string;
  email?: string;
  qualification?: string;
  specialization?: string;
  experienceYears?: number;
  publicEmail?: string;
  publicPhone?: string;
  officeLocation?: string;
  googleScholarUrl?: string;
  orcidUrl?: string;
  researchAreas?: string;
}

export async function updateMyProfile(payload: UpdateMyProfilePayload) {
  const { data } = await api.patch('/v1/staff/me/profile', payload);
  return data;
}

export async function uploadMyPhoto(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/staff/me/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as { photoUrl: string };
}

export async function updateMyAddress(payload: {
  addressJson?: Record<string, unknown>;
  emergencyContactJson?: Record<string, unknown>;
}) {
  const { data } = await api.patch('/v1/staff/me/address', payload);
  return data;
}

/* ─── Self-service publications ─── */

export type StaffPublicationPayload = {
  title: string;
  publicationType: string;
  journal?: string;
  isbnIssn?: string;
  doi?: string;
  coAuthors?: string;
  indexedIn?: string;
  publishedAt?: string;
};

export type StaffPublication = StaffPublicationPayload & { id: string; createdAt: string };

export async function fetchMyPublications(): Promise<StaffPublication[]> {
  const { data } = await api.get('/v1/staff/me/publications');
  return data;
}

export async function createMyPublication(
  payload: StaffPublicationPayload,
): Promise<StaffPublication> {
  const { data } = await api.post('/v1/staff/me/publications', payload);
  return data;
}

export async function updateMyPublication(
  id: string,
  payload: Partial<StaffPublicationPayload>,
): Promise<StaffPublication> {
  const { data } = await api.patch(`/v1/staff/me/publications/${id}`, payload);
  return data;
}

export async function deleteMyPublication(id: string) {
  const { data } = await api.delete(`/v1/staff/me/publications/${id}`);
  return data;
}

/* ─── Self-service awards ─── */

export type StaffAwardPayload = {
  title: string;
  organization?: string;
  level?: string;
  awardDate?: string;
  description?: string;
};

export type StaffAward = StaffAwardPayload & { id: string; createdAt: string };

export async function fetchMyAwards(): Promise<StaffAward[]> {
  const { data } = await api.get('/v1/staff/me/awards');
  return data;
}

export async function createMyAward(payload: StaffAwardPayload): Promise<StaffAward> {
  const { data } = await api.post('/v1/staff/me/awards', payload);
  return data;
}

export async function updateMyAward(
  id: string,
  payload: Partial<StaffAwardPayload>,
): Promise<StaffAward> {
  const { data } = await api.patch(`/v1/staff/me/awards/${id}`, payload);
  return data;
}

export async function deleteMyAward(id: string) {
  const { data } = await api.delete(`/v1/staff/me/awards/${id}`);
  return data;
}

export async function exportStaffCsv(params?: StaffExportParams) {
  const { data } = await api.get('/v1/staff/export.csv', {
    params,
    responseType: 'blob',
  });
  return data as Blob;
}

export async function fetchDesignations(staffType?: string): Promise<StaffDesignation[]> {
  const { data } = await api.get('/v1/staff/designations', {
    params: staffType ? { staffType } : undefined,
  });
  return data;
}

export async function fetchAcademicRoles(): Promise<AcademicRoleDefinition[]> {
  const { data } = await api.get('/v1/staff/academic-roles');
  return data;
}

export async function fetchStaffPublications(staffId: string): Promise<StaffPublication[]> {
  const { data } = await api.get(`/v1/staff/${staffId}/publications`);
  return data;
}

export async function createStaffPublication(
  staffId: string,
  payload: Omit<StaffPublication, 'id'>,
) {
  const { data } = await api.post(`/v1/staff/${staffId}/publications`, payload);
  return data as StaffPublication;
}

export async function updateStaffPublication(
  staffId: string,
  pubId: string,
  payload: Partial<StaffPublication>,
) {
  const { data } = await api.patch(`/v1/staff/${staffId}/publications/${pubId}`, payload);
  return data as StaffPublication;
}

export async function deleteStaffPublication(staffId: string, pubId: string) {
  const { data } = await api.delete(`/v1/staff/${staffId}/publications/${pubId}`);
  return data;
}

export async function fetchStaffAwards(staffId: string): Promise<StaffAward[]> {
  const { data } = await api.get(`/v1/staff/${staffId}/awards`);
  return data;
}

export async function createStaffAward(staffId: string, payload: Omit<StaffAward, 'id'>) {
  const { data } = await api.post(`/v1/staff/${staffId}/awards`, payload);
  return data as StaffAward;
}

export async function updateStaffAward(
  staffId: string,
  awardId: string,
  payload: Partial<StaffAward>,
) {
  const { data } = await api.patch(`/v1/staff/${staffId}/awards/${awardId}`, payload);
  return data as StaffAward;
}

export async function deleteStaffAward(staffId: string, awardId: string) {
  const { data } = await api.delete(`/v1/staff/${staffId}/awards/${awardId}`);
  return data;
}

export type StaffImportMode = 'CREATE' | 'MERGE' | 'REPLACE';

export type StaffImportPreviewRow = {
  rowNumber: number;
  status: string;
  displayCode?: string;
  displayTitle?: string;
  errors: string[];
  warnings?: string[];
};

export type StaffImportPreview = {
  batchId: string;
  status: string;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings?: number;
    duplicates?: number;
  };
  rows: StaffImportPreviewRow[];
  hasMore: boolean;
};

export async function downloadStaffImportTemplate() {
  const { data } = await api.get('/v1/staff/import/template', {
    responseType: 'blob',
  });
  return data as Blob;
}

export async function validateStaffImport(
  file: File,
  importMode: StaffImportMode = 'MERGE',
  onUploadProgress?: (pct: number) => void,
) {
  const form = new FormData();
  form.append('file', file);
  form.append('importMode', importMode);
  const { data } = await api.post('/v1/staff/import/validate', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) {
        onUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return data as StaffImportPreview;
}

export async function commitStaffImport(
  batchId: string,
  mode: 'VALID_ONLY' | 'STRICT' = 'VALID_ONLY',
  importMode: StaffImportMode = 'MERGE',
) {
  const { data } = await api.post(
    '/v1/staff/import/commit',
    {
      batchId,
      mode,
      importMode,
    },
    {
      timeout: 120_000,
    },
  );
  return data as {
    batchId: string;
    status: string;
    successfulRows: number;
    failedRows?: number;
  };
}

export async function fetchStaffImportPreview(
  batchId: string,
  page = 1,
  limit = 200,
): Promise<StaffImportPreview | null> {
  const { data } = await api.get(`/v1/staff/import/batches/${batchId}/preview`, {
    params: { page, limit },
  });
  return data as StaffImportPreview | null;
}

export async function downloadStaffImportErrorReport(batchId: string) {
  const { data } = await api.get(`/v1/staff/import/batches/${batchId}/error-report`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Staff_Import_Error_Report.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export type { StaffDirectoryRow };

/* ─── Self-service profile (Phase 1 + Approval) ─── */

export async function updateMyPersonal(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/staff/me/personal', payload);
  return data;
}

export async function updateMyContact(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/staff/me/contact', payload);
  return data;
}

export async function updateMyBank(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/staff/me/bank', payload);
  return data;
}

export async function fetchMyEmergencyContacts() {
  const { data } = await api.get('/v1/staff/me/emergency-contacts');
  return data as Array<{
    id: string;
    contactName: string;
    relationship: string;
    mobile: string;
    alternateMobile?: string | null;
    address?: string | null;
  }>;
}

export async function createMyEmergencyContact(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/staff/me/emergency-contacts', payload);
  return data;
}

export async function updateMyEmergencyContact(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/staff/me/emergency-contacts/${id}`, payload);
  return data;
}

export async function deleteMyEmergencyContact(id: string) {
  const { data } = await api.delete(`/v1/staff/me/emergency-contacts/${id}`);
  return data;
}

export async function fetchMyQualifications() {
  const { data } = await api.get('/v1/staff/me/qualifications');
  return data as Array<Record<string, unknown> & { id: string; approvalStatus: string }>;
}

export async function createMyQualification(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/staff/me/qualifications', payload);
  return data;
}

export async function updateMyQualification(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/staff/me/qualifications/${id}`, payload);
  return data;
}

export async function deleteMyQualification(id: string) {
  const { data } = await api.delete(`/v1/staff/me/qualifications/${id}`);
  return data;
}

export async function fetchMyExperience() {
  const { data } = await api.get('/v1/staff/me/experience');
  return data as {
    items: Array<Record<string, unknown> & { id: string; approvalStatus: string }>;
    totalTeachingMonths: number;
    totalTeachingYears: number;
  };
}

export async function createMyExperience(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/staff/me/experience', payload);
  return data;
}

export async function updateMyExperience(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/staff/me/experience/${id}`, payload);
  return data;
}

export async function deleteMyExperience(id: string) {
  const { data } = await api.delete(`/v1/staff/me/experience/${id}`);
  return data;
}

export async function fetchMyCertifications() {
  const { data } = await api.get('/v1/staff/me/certifications');
  return data as Array<Record<string, unknown> & { id: string; approvalStatus: string }>;
}

export async function createMyCertification(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/staff/me/certifications', payload);
  return data;
}

export async function updateMyCertification(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/staff/me/certifications/${id}`, payload);
  return data;
}

export async function deleteMyCertification(id: string) {
  const { data } = await api.delete(`/v1/staff/me/certifications/${id}`);
  return data;
}

export async function fetchMyProfileHistory() {
  const { data } = await api.get('/v1/staff/me/profile/history');
  return data as Array<{
    id: string;
    action: string;
    section: string;
    summary: string;
    createdAt: string;
  }>;
}

export async function submitMyProfileForReview() {
  const { data } = await api.post('/v1/staff/me/profile/submit');
  return data as { ok: boolean; message: string };
}

export async function fetchStaffProfileReviewPending() {
  const { data } = await api.get('/v1/staff/profile-reviews/pending');
  return data as {
    total: number;
    counts: Record<string, number>;
    items: Array<{
      kind: string;
      id: string;
      title: string;
      subtitle: string;
      submittedAt: string;
      staff: {
        id: string;
        fullName: string;
        employeeCode: string;
        department?: { name: string } | null;
      };
    }>;
  };
}

export async function approveStaffProfileReview(kind: string, id: string, remarks?: string) {
  const { data } = await api.post(`/v1/staff/profile-reviews/${kind}/${id}/approve`, {
    remarks,
  });
  return data;
}

export async function rejectStaffProfileReview(kind: string, id: string, remarks: string) {
  const { data } = await api.post(`/v1/staff/profile-reviews/${kind}/${id}/reject`, {
    remarks,
  });
  return data;
}
