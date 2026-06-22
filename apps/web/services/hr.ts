import { api } from '@/services/api';

export type LeaveBalance = {
  id: string;
  year: number;
  allocatedDays: string | number;
  usedDays: string | number;
  carriedForward: string | number;
  leaveType: { code: string; name: string };
  staffProfile?: { fullName: string; employeeCode: string };
};

export type LeaveApplication = {
  id: string;
  fromDate: string;
  toDate: string;
  totalDays: string | number;
  reason?: string;
  status: string;
  staffProfile?: { fullName: string; employeeCode: string; department?: { name: string } };
  leaveType?: { code: string; name: string };
};

export async function fetchLeaveBalances(params?: { staffProfileId?: string; year?: number }) {
  const { data } = await api.get<{ data: LeaveBalance[] }>('/v1/hr/leave/balances', { params });
  return data.data;
}

export async function fetchLeaveApplications(params?: {
  staffProfileId?: string;
  status?: string;
  pendingApproval?: boolean;
}) {
  const { data } = await api.get<{ data: LeaveApplication[] }>('/v1/hr/leave/applications', {
    params,
  });
  return data.data;
}

export async function approveLeaveApplication(
  id: string,
  action: 'APPROVE' | 'REJECT',
  rejectionReason?: string,
) {
  const { data } = await api.patch(`/v1/hr/leave/applications/${id}/approve`, {
    action,
    rejectionReason,
  });
  return data;
}

export async function initializeLeaveBalances(body?: {
  year?: number;
  departmentId?: string;
  overwrite?: boolean;
}) {
  const { data } = await api.post('/v1/hr/leave/balances/initialize', body ?? {});
  return data as { initialized: number; staffCount: number; year: number };
}

export async function portalApplyLeave(body: {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}) {
  const { data } = await api.post('/v1/hr/leave/applications/me', body);
  return data;
}

export async function fetchPortalLeaveSummary() {
  const { data } = await api.get('/v1/hr/leave/summary/me');
  return data as { casual: number; sick: number; earned: number; pendingRequests: number };
}

export async function fetchPortalLeaveApplications() {
  const { data } = await api.get<{ data: LeaveApplication[] }>('/v1/hr/leave/applications/me');
  return data.data;
}

export type RecruitmentVacancy = {
  id: string;
  title: string;
  slug?: string | null;
  staffType?: string;
  vacanciesCount: number;
  status: string;
  description?: string;
  jobDescriptionHtml?: string;
  qualificationRequired?: string;
  experienceRequired?: string;
  salaryMin?: number | string | null;
  salaryMax?: number | string | null;
  closingDate?: string | null;
  publishedAt?: string | null;
  advertisementPdfUrl?: string | null;
  termsPdfUrl?: string | null;
  instructionsHtml?: string | null;
  eligibilityJson?: {
    selectionCommittee?: { members?: string[] };
    netSetRequired?: boolean;
    phdPreferred?: boolean;
  } | null;
  departmentId?: string | null;
  designationId?: string | null;
  department?: { id: string; name: string } | null;
  designation?: { id: string; label: string } | null;
  _count?: { applications: number };
};

export type RecruitmentStats = {
  openVacancies: number;
  totalApplications?: number;
  submitted: number;
  shortlisted: number;
  interviews: number;
  offers: number;
  hired: number;
  joiningPending?: number;
  offerAcceptanceRate?: number;
};

export type RecruitmentAnalytics = {
  funnel: Array<{ status: string; count: number }>;
  byVacancy: Array<{
    id: string;
    title: string;
    status: string;
    slug?: string | null;
    applications: number;
  }>;
  totals: {
    applications: number;
    hired: number;
    rejected: number;
    conversionRate: number;
    publicApplications: number;
    internalApplications: number;
    publicLast30Days: number;
  };
};

export type RecruitmentApplication = {
  id: string;
  fullName: string;
  applicationNo?: string;
  email?: string;
  mobile?: string;
  status: string;
  appliedAt: string;
  source?: string;
  qualification?: string;
  experienceYears?: number;
  vacancy?: {
    title: string;
    slug?: string | null;
    department?: { name: string };
    designation?: { label: string };
  };
  interviews?: Array<{
    id: string;
    scheduledAt: string;
    venue?: string;
    status: string;
    score?: number | string;
  }>;
  offers?: Array<{ offeredSalary?: string | number; status: string }>;
};

export type RecruitmentApplicationDetail = RecruitmentApplication & {
  fatherName?: string;
  dateOfBirth?: string;
  resumeUrl?: string;
  photoUrl?: string;
  notes?: string;
  applicationDetailsJson?: Record<string, unknown>;
  certificatesJson?: Array<{ name: string; url: string; uploadedAt?: string }>;
  addressJson?: { line1?: string; city?: string };
};

export type RecruitmentPipelineColumn = {
  id: string;
  label: string;
  applications: RecruitmentApplication[];
};

export type RecruitmentInterview = {
  id: string;
  scheduledAt: string;
  venue?: string;
  status: string;
  score?: number | string;
  notes?: string;
  application?: {
    id: string;
    fullName: string;
    applicationNo?: string;
    vacancy?: { title: string };
  };
};

export async function fetchRecruitmentStats() {
  const { data } = await api.get<RecruitmentStats>('/v1/hr/recruitment/stats');
  return data;
}

export async function fetchRecruitmentVacancies(status?: string) {
  const { data } = await api.get<{ data: RecruitmentVacancy[] }>('/v1/hr/recruitment/vacancies', {
    params: { status },
  });
  return data.data ?? data;
}

export async function fetchRecruitmentVacancy(id: string) {
  const { data } = await api.get<RecruitmentVacancy>(`/v1/hr/recruitment/vacancies/${id}`);
  return data;
}

export async function updateRecruitmentVacancy(
  id: string,
  body: Partial<RecruitmentVacancy> & {
    salaryMin?: number;
    salaryMax?: number;
    closingDate?: string;
    selectionCommitteeJson?: unknown;
  },
) {
  const { data } = await api.patch(`/v1/hr/recruitment/vacancies/${id}`, body);
  return data as RecruitmentVacancy;
}

export async function fetchRecruitmentAnalytics() {
  const { data } = await api.get<RecruitmentAnalytics>('/v1/hr/recruitment/analytics');
  return data;
}

export async function fetchRecruitmentApplication(id: string) {
  const { data } = await api.get<RecruitmentApplicationDetail>(
    `/v1/hr/recruitment/applications/${id}`,
  );
  return data;
}

export async function createRecruitmentVacancy(body: {
  title: string;
  staffType?: string;
  vacanciesCount?: number;
  description?: string;
  closingDate?: string;
  departmentId?: string;
  designationId?: string;
  qualificationRequired?: string;
  experienceRequired?: string;
  salaryMin?: number;
  salaryMax?: number;
  jobDescriptionHtml?: string;
  eligibilityJson?: Record<string, unknown>;
}) {
  const { data } = await api.post('/v1/hr/recruitment/vacancies', body);
  return data as RecruitmentVacancy;
}

export async function updateRecruitmentVacancyStatus(id: string, status: string) {
  const { data } = await api.patch(`/v1/hr/recruitment/vacancies/${id}/status`, { status });
  return data;
}

export async function fetchRecruitmentApplications(vacancyId?: string) {
  const { data } = await api.get<{ data: RecruitmentApplication[] }>(
    '/v1/hr/recruitment/applications',
    {
      params: { vacancyId },
    },
  );
  return data.data ?? [];
}

export async function fetchRecruitmentPipeline(vacancyId?: string) {
  const { data } = await api.get<{ data: RecruitmentPipelineColumn[] }>(
    '/v1/hr/recruitment/pipeline',
    { params: { vacancyId } },
  );
  return data.data ?? data;
}

export async function moveRecruitmentApplication(id: string, status: string, reason?: string) {
  const { data } = await api.patch(`/v1/hr/recruitment/applications/${id}/status`, {
    status,
    reason,
    notify: true,
  });
  return data;
}

export async function notifyRecruitmentDocuments(id: string, message?: string) {
  const { data } = await api.post(`/v1/hr/recruitment/applications/${id}/notify/documents`, {
    message,
  });
  return data as { sent: boolean };
}

export async function fetchRecruitmentInterviews(status?: string) {
  const { data } = await api.get<{ data: RecruitmentInterview[] }>(
    '/v1/hr/recruitment/interviews',
    { params: { status } },
  );
  return data.data ?? data;
}

export async function updateRecruitmentInterview(
  id: string,
  body: {
    score?: number;
    status?: string;
    notes?: string;
    venue?: string;
    scheduledAt?: string;
  },
) {
  const { data } = await api.patch(`/v1/hr/recruitment/interviews/${id}`, body);
  return data;
}

export async function createRecruitmentApplication(body: {
  vacancyId: string;
  fullName: string;
  email?: string;
  mobile?: string;
  qualification?: string;
}) {
  const { data } = await api.post('/v1/hr/recruitment/applications', body);
  return data;
}

export async function updateRecruitmentApplicationStatus(
  id: string,
  status: string,
  reason?: string,
) {
  const { data } = await api.patch(`/v1/hr/recruitment/applications/${id}/status`, {
    status,
    reason,
  });
  return data;
}

export function interviewCallLetterPdfUrl(id: string) {
  return `/api/v1/hr/recruitment/interviews/${id}/call-letter`;
}

export function interviewCallLetterPreviewUrl(id: string) {
  return `/api/v1/hr/recruitment/interviews/${id}/call-letter/preview`;
}

export function bulkInterviewCallLettersPdfUrl(date: string) {
  return `/api/v1/hr/recruitment/interviews/bulk/call-letters?date=${encodeURIComponent(date)}`;
}

export async function uploadRecruitmentInterviewMinutes(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post(`/v1/hr/recruitment/interviews/${id}/minutes`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function scheduleRecruitmentInterview(body: {
  applicationId: string;
  scheduledAt: string;
  venue?: string;
  panelJson?: unknown;
}) {
  const { data } = await api.post('/v1/hr/recruitment/interviews', body);
  return data;
}

export type PensionEnrollment = {
  id: string;
  schemeType: string;
  enrollmentDate: string;
  lastDrawnBasic?: string | number;
  status: string;
  staffProfile?: { fullName: string; employeeCode: string; retirementDate?: string };
};

export async function fetchPensionStats() {
  const { data } = await api.get('/v1/hr/pension/stats');
  return data as { enrolled: number; retiringSoon: number; ytdAccrual: number };
}

export async function fetchPensionEnrollments(staffProfileId?: string) {
  const { data } = await api.get<{ data: PensionEnrollment[] }>('/v1/hr/pension/enrollments', {
    params: { staffProfileId },
  });
  return data.data;
}

export async function fetchPensionLedger(staffProfileId?: string, year?: number) {
  const { data } = await api.get('/v1/hr/pension/ledger', { params: { staffProfileId, year } });
  return data;
}

export type AppraisalCycle = {
  id: string;
  name: string;
  year: number;
  status: string;
  _count?: { appraisals: number };
};

export type StaffAppraisal = {
  id: string;
  selfScore?: string | number;
  hodScore?: string | number;
  principalScore?: string | number;
  finalScore?: string | number;
  status: string;
  kpiSnapshot?: Record<string, unknown>;
  staffProfile?: { fullName: string; employeeCode: string; department?: { name: string } };
  cycle?: { name: string; year: number };
};

export async function fetchAppraisalCycles() {
  const { data } = await api.get<{ data: AppraisalCycle[] }>('/v1/hr/appraisal/cycles');
  return data.data;
}

export async function createAppraisalCycle(body: {
  name: string;
  year: number;
  startDate: string;
  endDate: string;
}) {
  const { data } = await api.post('/v1/hr/appraisal/cycles', body);
  return data;
}

export async function launchAppraisalCycle(id: string) {
  const { data } = await api.post(`/v1/hr/appraisal/cycles/${id}/launch`);
  return data;
}

export async function fetchAppraisalRecords(params?: {
  cycleId?: string;
  staffProfileId?: string;
}) {
  const { data } = await api.get<{ data: StaffAppraisal[] }>('/v1/hr/appraisal/records', {
    params,
  });
  return data.data;
}

export async function scoreAppraisal(
  id: string,
  body: { role: 'SELF' | 'HOD' | 'PRINCIPAL'; score: number; remarks?: string },
) {
  const { data } = await api.patch(`/v1/hr/appraisal/records/${id}/score`, body);
  return data;
}

export async function downloadPayAssignmentTemplate() {
  const { data } = await api.get('/v1/payroll/assignments/import/template', {
    responseType: 'blob',
  });
  return data as Blob;
}

export async function validatePayAssignmentImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/payroll/assignments/import/validate', form);
  return data as {
    total: number;
    valid: number;
    invalid: number;
    rows: Array<{ rowNumber: number; employeeCode: string; errors: string[] }>;
  };
}

export async function commitPayAssignmentImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/payroll/assignments/import/commit', form);
  return data as { created: number; skipped: number; total: number };
}
