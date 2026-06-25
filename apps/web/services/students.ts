import { api } from '@/services/api';
import { downloadBlob } from '@/utils/download-blob';
import type {
  AdmitStudentFullPayload,
  AdmitStudentPayload,
  AdmitStudentWithRegistrationPayload,
  AdmissionPoolsResponse,
  AttendanceEligibilityStatus,
  EnhancedStudentSummary,
  SubjectBasketValidation,
  LifecycleEventType,
  MasterLookup,
  PaginatedStudents,
  StudentAuditLog,
  StudentDirectoryRow,
  StudentExportParams,
  StudentFeeStatus,
  StudentLifecycleEvent,
  StudentListItem,
  StudentProfile,
  StudentRemark,
  StudentResidenceType,
  StudentSummary,
} from '@/types/students';

export async function fetchStudentsSummary(): Promise<StudentSummary> {
  const { data } = await api.get('/v1/students/summary');
  return data;
}

export async function fetchEnhancedStudentsSummary(): Promise<EnhancedStudentSummary> {
  const { data } = await api.get('/v1/students/summary/enhanced');
  return data;
}

export async function fetchStudents(params?: {
  page?: number;
  limit?: number;
  search?: string;
  programVersionId?: string;
  shiftId?: string;
  sessionId?: string;
  batchId?: string;
  semester?: string;
  streamId?: string;
  departmentId?: string;
  categoryLookupId?: string;
  religionLookupId?: string;
  differentlyAbled?: string;
  studentStatus?: string;
  admissionType?: string;
  admissionStatus?: string;
  academicStatus?: string;
  feeDue?: string;
  hostel?: string;
  attendanceShortage?: string;
  subjectPending?: string;
  rfidAssigned?: string;
  noPhoto?: string;
  noMobile?: string;
  recentlyAdded?: string;
  abcStatus?: string;
}): Promise<PaginatedStudents> {
  const { data } = await api.get('/v1/students', { params });
  return data;
}

/** Loads every student page for bulk ID card export. API caps at 100/page. */
export async function fetchAllStudents(
  params: Omit<NonNullable<Parameters<typeof fetchStudents>[0]>, 'page' | 'limit'> = {},
): Promise<{ data: StudentDirectoryRow[]; meta: { total: number } }> {
  const limit = 100;
  let page = 1;
  const all: StudentDirectoryRow[] = [];
  let total = 0;

  while (true) {
    const res = await fetchStudents({ ...params, page, limit });
    all.push(...res.data);
    total = res.meta.total;
    if (page >= res.meta.totalPages) break;
    page += 1;
  }

  return { data: all, meta: { total } };
}

export async function fetchStudent(id: string): Promise<StudentListItem> {
  const { data } = await api.get(`/v1/students/${id}`);
  return data;
}

export async function fetchStudentProfile(id: string): Promise<StudentProfile> {
  const { data } = await api.get(`/v1/students/${id}/profile`);
  return data;
}

export type StudentHealthResponse = {
  feeStatus: StudentFeeStatus;
  feeDueAmount: number;
  attendancePercent: number | null;
  attendanceEligibility: AttendanceEligibilityStatus | null;
  attendanceShortage: boolean;
  residenceType: StudentResidenceType | null;
  hostelBlock: string | null;
  hostelRoom: string | null;
  isHosteller: boolean;
  signals: { key: string; label: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }[];
  score: { score: number; label: string; tone: 'good' | 'warn' | 'bad' };
};

export async function fetchStudentHealth(id: string): Promise<StudentHealthResponse> {
  const { data } = await api.get(`/v1/students/${id}/health`);
  return data;
}

export type StudentSemesterRegistrationRow = {
  registrationId: string;
  lineId: string;
  semesterSequence: number;
  semesterId: string;
  registrationStatus: string;
  category: string;
  lineStatus: string;
  course: {
    id: string;
    code: string;
    title: string;
    credits: number;
  };
  section: { id: string; sectionCode: string } | null;
  faculty: { id: string; name: string; employeeCode: string } | null;
  generatedBy: string | null;
  generatedAt: string;
  registrationSource: string | null;
  assignmentSource: string | null;
  curriculumMappingId: string;
  mappingSource: string | null;
  curriculumVersion: number | null;
  poolName: string | null;
};

export async function fetchStudentSemesterRegistrations(
  studentId: string,
): Promise<StudentSemesterRegistrationRow[]> {
  const { data } = await api.get(`/v1/students/${studentId}/semester-registrations`);
  return data;
}

export async function admitStudent(payload: AdmitStudentPayload) {
  const { data } = await api.post('/v1/students/admit', payload);
  return data as StudentProfile;
}

export async function admitStudentFull(payload: AdmitStudentFullPayload) {
  const { data } = await api.post('/v1/students/admit-full', payload);
  return data as StudentProfile;
}

export async function admitStudentWithRegistration(payload: AdmitStudentWithRegistrationPayload) {
  const { data } = await api.post('/v1/students/admit-with-registration', payload);
  return data as StudentProfile;
}

export async function fetchAdmissionPools(params: {
  programVersionId: string;
  semesterSequence: number;
  shiftId?: string;
  majorSubjectSlug?: string;
}) {
  const { data } = await api.get(
    `/v1/academic-engine/programs/${params.programVersionId}/admission-pools`,
    {
      params: {
        semesterSequence: params.semesterSequence,
        shiftId: params.shiftId,
        majorSubjectSlug: params.majorSubjectSlug,
      },
    },
  );
  return data as AdmissionPoolsResponse;
}

export async function validateAdmissionSubjectBasket(payload: {
  programVersionId: string;
  semesterSequence: number;
  shiftId?: string;
  streamId?: string;
  majorSubjectSlug?: string;
  minorSubjectSlug?: string;
  class12Subjects?: { name: string; code?: string; marks?: number }[];
  selections: Record<string, string>;
}) {
  const { data } = await api.post(
    '/v1/academic-engine/admissions/validate-subject-basket',
    payload,
  );
  return data as SubjectBasketValidation;
}

export async function updateStudentProfileSection(
  studentId: string,
  sectionKey: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.patch(
    `/v1/students/${studentId}/profile/sections/${sectionKey}`,
    payload,
  );
  return data;
}

export async function fetchProfileCompletion(studentId: string) {
  const { data } = await api.get(`/v1/students/${studentId}/profile/completion`);
  return data;
}

export async function verifyStudentDocument(
  studentId: string,
  docId: string,
  payload: { verificationStatus: 'VERIFIED' | 'REJECTED'; verificationRemarks?: string },
) {
  const { data } = await api.patch(`/v1/students/${studentId}/documents/${docId}/verify`, payload);
  return data;
}

export async function updateStudentProfile(
  id: string,
  payload: Partial<AdmitStudentPayload> & {
    fullName?: string;
    admissionStatus?: string;
  },
) {
  const { data } = await api.patch(`/v1/students/${id}/profile`, payload);
  return data as StudentProfile;
}

export async function uploadStudentPhoto(studentId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/students/${studentId}/photo`, form);
  return data as { photoPath: string };
}

export async function uploadStudentDocument(studentId: string, documentType: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  const { data } = await api.post(`/v1/students/${studentId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteStudentDocument(studentId: string, docId: string) {
  const { data } = await api.delete(`/v1/students/${studentId}/documents/${docId}`);
  return data;
}

export async function exportStudentsCsv(params?: StudentExportParams) {
  const { data } = await api.get('/v1/students/export.csv', {
    params,
    responseType: 'blob',
  });
  return data as Blob;
}

export async function exportStudentsProfileXlsx(params?: StudentExportParams) {
  const { data } = await api.get('/v1/students/export/profile.xlsx', {
    params,
    responseType: 'blob',
  });
  return data as Blob;
}

export async function exportSubjectAllocationsXlsx(params?: StudentExportParams) {
  const { data } = await api.get('/v1/students/export/subject-allocations.xlsx', {
    params,
    responseType: 'blob',
  });
  return data as Blob;
}

export async function fetchLifecycleEvents(studentId?: string): Promise<StudentLifecycleEvent[]> {
  const { data } = await api.get('/v1/students/lifecycle/events', {
    params: studentId ? { studentId } : undefined,
  });
  return data;
}

export async function createLifecycleEvent(payload: {
  studentId: string;
  eventType: LifecycleEventType;
  effectiveDate: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const { data } = await api.post('/v1/students/lifecycle/events', payload);
  return data as StudentLifecycleEvent;
}

export async function fetchStudentIdCardPrintRequests(studentId: string) {
  const { data } = await api.get(`/v1/students/${studentId}/id-card/print-requests`);
  return data as {
    id: string;
    requestType: string;
    status: string;
    note: string | null;
    submittedAt: string;
  }[];
}

export async function fetchAllIdCardPrintRequests(status?: 'PENDING' | 'COMPLETED') {
  const { data } = await api.get('/v1/id-cards/print-requests', {
    params: status ? { status } : undefined,
  });
  return data as {
    id: string;
    studentId: string | null;
    enrollmentNumber: string | null;
    fullName: string | null;
    requestType: string;
    status: string;
    note: string | null;
    submittedAt: string;
  }[];
}

export async function fetchStudentAuditLogs(studentId?: string): Promise<StudentAuditLog[]> {
  const { data } = await api.get('/v1/students/audit-logs', {
    params: studentId ? { studentId } : undefined,
  });
  return data;
}

export async function fetchStudentRemarks(studentId: string): Promise<StudentRemark[]> {
  const { data } = await api.get(`/v1/students/${studentId}/remarks`);
  return data;
}

export async function createStudentRemark(
  studentId: string,
  payload: { remarkType: string; body: string; visibility?: string },
) {
  const { data } = await api.post(`/v1/students/${studentId}/remarks`, payload);
  return data as StudentRemark;
}

export async function bulkAssignRfid(assignments: Record<string, string>) {
  const { data } = await api.post('/v1/students/bulk-rfid', { assignments });
  return data as { updated: number; assignments: { studentId: string; rfidNumber: string }[] };
}

export type StudentImportMode = 'CREATE' | 'MERGE';

export type StudentImportBatch = {
  id: string;
  module: string;
  fileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  successfulRows: number;
  failedRows: number;
  errorMessage?: string | null;
  uploadedByEmail?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type StudentImportPreviewRow = {
  rowNumber: number;
  status: string;
  displayCode?: string;
  displayTitle?: string;
  errors: string[];
  warnings?: string[];
  academicMapping?: {
    major?: {
      resolvedLabel?: string;
      input?: string;
      category?: string;
      courseCode?: string;
      resolutionMode?: string;
      sectionCode?: string;
    };
    minor?: {
      resolvedLabel?: string;
      input?: string;
      category?: string;
      courseCode?: string;
      resolutionMode?: string;
      sectionCode?: string;
    };
    mdc?: {
      resolvedLabel?: string;
      input?: string;
      category?: string;
      courseCode?: string;
      resolutionMode?: string;
      sectionCode?: string;
    };
    aec?: {
      resolvedLabel?: string;
      input?: string;
      category?: string;
      courseCode?: string;
      resolutionMode?: string;
      sectionCode?: string;
    };
    sec?: {
      resolvedLabel?: string;
      input?: string;
      category?: string;
      courseCode?: string;
      resolutionMode?: string;
      sectionCode?: string;
    };
    vac?: {
      resolvedLabel?: string;
      input?: string;
      category?: string;
      courseCode?: string;
      resolutionMode?: string;
      sectionCode?: string;
    };
  };
};

export type StudentImportPreview = {
  batchId: string;
  status: string;
  summary: { total: number; valid: number; invalid: number; warnings?: number };
  rows: StudentImportPreviewRow[];
  hasMore: boolean;
  async?: boolean;
};

export type PaginatedStudentImportBatches = {
  data: StudentImportBatch[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export async function downloadStudentImportTemplate(mode: 'blank' | 'prefilled' = 'blank') {
  const { data } = await api.get('/v1/students/import/template', {
    params: { mode },
    responseType: 'blob',
  });
  return data as Blob;
}

export async function downloadSem1AdmissionTemplate() {
  const { data } = await api.get('/v1/students/import/template', {
    params: { variant: 'sem1-admission' },
    responseType: 'blob',
  });
  return data as Blob;
}

export async function downloadSem3AdmissionTemplate(params?: {
  programme?: string;
  programVersionId?: string;
  semesterSequence?: number;
}) {
  const { data } = await api.get('/v1/students/import/template', {
    params: { variant: 'sem3-admission', ...params },
    responseType: 'blob',
  });
  return data as Blob;
}

export type Sem3ImportProgrammeOption = {
  programVersionId: string;
  code: string;
  name: string;
};

export async function fetchSem3ImportProgrammes() {
  const { data } = await api.get('/v1/students/import/sem3-curriculum/programmes');
  return data as Sem3ImportProgrammeOption[];
}

export type MigrationStepStatus = 'complete' | 'partial' | 'pending';

export type MigrationStepDto = {
  id: string;
  status: MigrationStepStatus;
  label: string;
  detail: string;
};

export type MigrationStatusDto = {
  batchCode: string;
  semesterSequence: number;
  totalStudents: number;
  steps: MigrationStepDto[];
  readyForAttendance: boolean;
  frozenCount: number;
};

export async function fetchMigrationStatus(params?: {
  batchCode?: string;
  semesterSequence?: number;
}) {
  const { data } = await api.get('/v1/students/migration/status', { params });
  return data as MigrationStatusDto;
}

export async function validateStudentImport(
  file: File,
  importMode: StudentImportMode = 'CREATE',
  onUploadProgress?: (pct: number) => void,
) {
  const form = new FormData();
  form.append('file', file);
  form.append('importMode', importMode);
  const { data } = await api.post('/v1/students/import/validate', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60_000,
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) {
        onUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return data as StudentImportPreview;
}

export async function commitStudentImport(
  batchId: string,
  mode: 'VALID_ONLY' | 'STRICT' = 'VALID_ONLY',
  importMode: StudentImportMode = 'CREATE',
) {
  const { data } = await api.post(
    '/v1/students/import/commit',
    {
      batchId,
      mode,
      importMode,
    },
    { timeout: 120_000 },
  );
  return data as {
    batchId: string;
    status: string;
    successfulRows: number;
    failedRows?: number;
  };
}

export async function fetchStudentImportBatches(
  page = 1,
  limit = 20,
): Promise<PaginatedStudentImportBatches> {
  const { data } = await api.get('/v1/students/import/batches', {
    params: { page, limit },
  });
  return data as PaginatedStudentImportBatches;
}

export async function fetchStudentImportPreview(
  batchId: string,
  page = 1,
  limit = 200,
): Promise<StudentImportPreview | null> {
  const { data } = await api.get(`/v1/students/import/batches/${batchId}/preview`, {
    params: { page, limit },
  });
  return data as StudentImportPreview | null;
}

export async function downloadStudentImportErrorReport(batchId: string) {
  const { data } = await api.get(`/v1/students/import/batches/${batchId}/error-report`, {
    responseType: 'blob',
  });
  downloadBlob(data as Blob, 'Student_Import_Error_Report.xlsx');
}

export async function fetchMasterLookups(type?: string): Promise<MasterLookup[]> {
  const { data } = await api.get('/v1/master-lookups', { params: { type } });
  return data;
}

export async function createStudent(payload: {
  email: string;
  enrollmentNumber: string;
  programVersionId?: string;
  admissionDate?: string;
  password?: string;
}) {
  const { data } = await api.post('/v1/students', payload);
  return data as StudentListItem;
}

export async function enrollStudentFromApplication(
  applicationId: string,
  payload?: {
    enrollmentNumber?: string;
    programVersionId?: string;
    admissionDate?: string;
    admissionBatchId?: string;
    primaryShiftId?: string;
  },
) {
  const { data } = await api.post(`/v1/students/from-application/${applicationId}`, payload ?? {});
  return data as StudentListItem;
}

export async function updateStudent(
  id: string,
  payload: {
    enrollmentNumber?: string;
    programVersionId?: string | null;
    admissionDate?: string | null;
  },
) {
  const { data } = await api.patch(`/v1/students/${id}`, payload);
  return data as StudentListItem;
}

export async function deleteStudent(id: string) {
  const { data } = await api.delete(`/v1/students/${id}`);
  return data;
}

export type AbcCoverageStats = {
  totalStudents: number;
  withAbcId: number;
  missingAbcId: number;
  coveragePct: number;
};

export async function fetchAbcCoverage(): Promise<AbcCoverageStats> {
  const { data } = await api.get('/v1/students/abc/coverage');
  return data;
}

export async function downloadAbcUploadTemplate() {
  const { data } = await api.get('/v1/students/abc/upload-template', {
    responseType: 'blob',
  });
  downloadBlob(data as Blob, 'ABC_ID_Upload_Template.xlsx');
}

export async function bulkUploadAbcIds(rows: Array<{ rollNumber: string; abcId: string }>) {
  const { data } = await api.post('/v1/students/abc/bulk-upload', { rows });
  return data as {
    updated: number;
    total: number;
    errors: Array<{ rollNumber: string; message: string }>;
  };
}

export type { StudentDirectoryRow };
