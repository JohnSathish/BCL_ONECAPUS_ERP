import { api } from '@/services/api';
import type { SemesterRegistration } from '@/types/academic-engine';

export type RegistrationWorkflowSettings = {
  mode: 'ADMIN_ONLY' | 'STUDENT_SELF' | 'HYBRID';
  allowStudentSelfService: boolean;
  studentElectiveCategories: string[];
  batchRegistrationMode?: 'ADMIN_ONLY' | 'STUDENT_SELF' | 'HYBRID' | null;
};

export type AdminRegistrationListItem = {
  studentId: string;
  enrollmentNumber: string;
  email: string;
  fullName: string;
  programCode?: string;
  programName?: string;
  batchCode?: string;
  currentSemester: number;
  registrationLocked: boolean;
  registration: SemesterRegistration | null;
};

export type StudentRegistrationContext = {
  student: {
    id: string;
    enrollmentNumber: string;
    email: string;
    fullName?: string;
    programVersionId: string | null;
    programCode?: string;
    primaryShiftId: string | null;
    primaryShiftCode?: string;
    streamId?: string | null;
    streamCode?: string;
  };
  standing: {
    currentSemesterSequence: number;
    registrationLocked: boolean;
  } | null;
  choices: { choiceType: string; subjectSlug: string }[];
  registration: SemesterRegistration | null;
  semesterId?: string;
  semesterSequence: number;
  workflow: RegistrationWorkflowSettings;
  majorMinorTrack?: {
    isTrackLocked: boolean;
    lockedAtSemester: number | null;
    majorSubject?: { slug: string; name: string };
    minorSubject?: { slug: string; name: string } | null;
  } | null;
  vtcTrack?: {
    trackGroupCode: string;
    selectedSem3Offering?: { id: string; course?: { code: string; title: string } };
    selectedSem4Offering?: { id: string; course?: { code: string; title: string } };
    selectedSem6Offering?: { id: string; course?: { code: string; title: string } };
  } | null;
  canChangeMajorMinor?: boolean;
  class12Subjects?: { name: string; code?: string }[];
};

export async function fetchAdminRegistrations(params?: {
  semesterId?: string;
  programVersionId?: string;
  admissionBatchId?: string;
  shiftId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get('/v1/academic-engine/registrations', { params });
  return data as {
    page: number;
    limit: number;
    total: number;
    items: AdminRegistrationListItem[];
  };
}

export async function fetchStudentRegistrationContext(studentId: string, semesterId?: string) {
  const { data } = await api.get(
    `/v1/academic-engine/registrations/students/${studentId}/context`,
    { params: semesterId ? { semesterId } : undefined },
  );
  return data as StudentRegistrationContext;
}

export async function createRegistrationForStudent(
  studentId: string,
  payload: { semesterId: string; semesterSequence: number },
) {
  const { data } = await api.post(
    `/v1/academic-engine/registrations/for-student/${studentId}`,
    payload,
  );
  return data as SemesterRegistration;
}

export async function updateAdminRegistrationLines(
  registrationId: string,
  lines: {
    category: string;
    offeringId?: string;
    offeringSectionId?: string;
    eligibilityOverride?: boolean;
    eligibilityOverrideReason?: string;
  }[],
) {
  const { data } = await api.patch(`/v1/academic-engine/registrations/${registrationId}/lines`, {
    lines,
  });
  return data as SemesterRegistration;
}

export async function validateAdminRegistration(registrationId: string) {
  const { data } = await api.post(`/v1/academic-engine/registrations/${registrationId}/validate`);
  return data as {
    ok: boolean;
    issues: { code: string; message: string }[];
    creditSummary: {
      draftTotal: number;
      draftByCategory: Record<string, number>;
    };
  };
}

export async function autoAssignRegistration(
  registrationId: string,
  assignMode: 'COMPULSORY_ONLY' | 'ALL_CATEGORIES' = 'COMPULSORY_ONLY',
) {
  const { data } = await api.post(
    `/v1/academic-engine/registrations/${registrationId}/auto-assign`,
    { assignMode },
  );
  return data as SemesterRegistration;
}

export async function submitAdminRegistration(registrationId: string) {
  const { data } = await api.post(`/v1/academic-engine/registrations/${registrationId}/submit`);
  return data as SemesterRegistration;
}

export async function bulkAutoAssignRegistrations(payload: {
  semesterId: string;
  semesterSequence: number;
  programVersionId?: string;
  admissionBatchId?: string;
  shiftId?: string;
  submitAfterAssign?: boolean;
  studentIds?: string[];
  assignMode?: 'COMPULSORY_ONLY' | 'ALL_CATEGORIES';
}) {
  const { data } = await api.post('/v1/academic-engine/registrations/bulk-auto-assign', payload);
  return data as BulkGenerateResult;
}

export type BulkGenerateMode = 'DRAFT_ONLY' | 'COMPULSORY_ONLY' | 'PREPARE_ELECTIVES' | 'FULL';

export type BulkGenerateResult = {
  total: number;
  successful: number;
  failed: number;
  results: {
    studentId: string;
    ok: boolean;
    registrationId?: string;
    status?: string;
    electiveSlots?: {
      category: string;
      required: number;
      filled: number;
      remaining: number;
    }[];
    error?: string;
  }[];
};

export async function bulkGenerateRegistrations(payload: {
  semesterId: string;
  semesterSequence: number;
  mode: BulkGenerateMode;
  programVersionId?: string;
  admissionBatchId?: string;
  shiftId?: string;
  submitAfter?: boolean;
  assignMode?: 'COMPULSORY_ONLY' | 'ALL_CATEGORIES';
  studentIds?: string[];
}) {
  const { data } = await api.post('/v1/academic-engine/registrations/bulk-generate', payload);
  return data as BulkGenerateResult;
}

export async function freezeRegistrations(payload: {
  frozen: boolean;
  studentIds?: string[];
  admissionBatchId?: string;
  programVersionId?: string;
}) {
  const { data } = await api.post('/v1/academic-engine/registrations/freeze', payload);
  return data as { updated: number; frozen: boolean };
}

export async function fetchRegistrationWorkflow(institutionId: string) {
  const { data } = await api.get(
    `/v1/academic-engine/institutions/${institutionId}/registration-workflow`,
  );
  return data as RegistrationWorkflowSettings;
}

export async function updateRegistrationWorkflow(
  institutionId: string,
  payload: Partial<RegistrationWorkflowSettings>,
) {
  const { data } = await api.put(
    `/v1/academic-engine/institutions/${institutionId}/registration-workflow`,
    payload,
  );
  return data;
}

export type RegistrationImportPreview = {
  batchId: string;
  status: string;
  summary: { total: number; valid: number; invalid: number };
  rows: {
    rowNumber: number;
    status: string;
    displayCode?: string;
    displayTitle?: string;
    errors: string[];
  }[];
  hasMore: boolean;
  async?: boolean;
};

export type RegistrationImportFormat = 'wide' | 'long';

export async function downloadRegistrationImportTemplate() {
  const { data } = await api.get('/v1/academic-engine/registrations/import/template', {
    responseType: 'blob',
  });
  return data as Blob;
}

export async function downloadWideRegistrationImportTemplate() {
  const { data } = await api.get('/v1/academic-engine/registrations/import/template/wide', {
    responseType: 'blob',
  });
  return data as Blob;
}

export async function validateRegistrationImport(
  file: File,
  params: {
    format?: RegistrationImportFormat;
    semesterId?: string;
    semesterSequence?: number;
    submitAfterImport?: boolean;
    freezeAfterImport?: boolean;
  },
  onUploadProgress?: (pct: number) => void,
) {
  const form = new FormData();
  form.append('file', file);
  const isWide = params.format !== 'long';
  if (params.semesterId) form.append('semesterId', params.semesterId);
  if (params.semesterSequence != null) {
    form.append('semesterSequence', String(params.semesterSequence));
  } else if (!isWide) {
    throw new Error('semesterSequence is required for long-format import');
  }
  if (!isWide && !params.semesterId) {
    throw new Error('semesterId is required for long-format import');
  }
  if (params.submitAfterImport) form.append('submitAfterImport', 'true');
  if (params.freezeAfterImport) form.append('freezeAfterImport', 'true');
  const { data } = await api.post('/v1/academic-engine/registrations/import/validate', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) {
        onUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return data as RegistrationImportPreview;
}

export async function commitRegistrationImport(payload: {
  batchId: string;
  semesterId?: string;
  semesterSequence?: number;
  mode?: 'VALID_ONLY' | 'STRICT';
  submitAfterImport?: boolean;
  freezeAfterImport?: boolean;
}) {
  const { data } = await api.post('/v1/academic-engine/registrations/import/commit', payload);
  return data as {
    batchId: string;
    status: string;
    successfulRows: number;
    studentsProcessed?: number;
  };
}

export async function downloadRegistrationImportErrorReport(batchId: string) {
  const { data } = await api.get(
    `/v1/academic-engine/registrations/import/batches/${batchId}/error-report`,
    { responseType: 'blob' },
  );
  return data as Blob;
}
