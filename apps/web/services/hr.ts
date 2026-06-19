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
  staffType?: string;
  vacanciesCount: number;
  status: string;
  description?: string;
  closingDate?: string;
};

export type RecruitmentApplication = {
  id: string;
  fullName: string;
  email?: string;
  mobile?: string;
  status: string;
  appliedAt: string;
  vacancy?: { title: string };
  interviews?: Array<{ scheduledAt: string; status: string }>;
  offers?: Array<{ offeredSalary?: string | number; status: string }>;
};

export async function fetchRecruitmentStats() {
  const { data } = await api.get('/v1/hr/recruitment/stats');
  return data;
}

export async function fetchRecruitmentVacancies(status?: string) {
  const { data } = await api.get<{ data: RecruitmentVacancy[] }>('/v1/hr/recruitment/vacancies', {
    params: { status },
  });
  return data.data;
}

export async function createRecruitmentVacancy(body: {
  title: string;
  staffType?: string;
  vacanciesCount?: number;
  description?: string;
  closingDate?: string;
}) {
  const { data } = await api.post('/v1/hr/recruitment/vacancies', body);
  return data;
}

export async function fetchRecruitmentApplications(vacancyId?: string) {
  const { data } = await api.get<{ data: RecruitmentApplication[] }>(
    '/v1/hr/recruitment/applications',
    {
      params: { vacancyId },
    },
  );
  return data.data;
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

export async function updateRecruitmentApplicationStatus(id: string, status: string) {
  const { data } = await api.patch(`/v1/hr/recruitment/applications/${id}/status`, { status });
  return data;
}

export async function scheduleRecruitmentInterview(body: {
  applicationId: string;
  scheduledAt: string;
  venue?: string;
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
