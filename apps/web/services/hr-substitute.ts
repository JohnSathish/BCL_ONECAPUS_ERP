import { api } from '@/services/api';

export type SubstituteDashboard = {
  activeAssignments: number;
  studyLeaveFaculty: number;
  maternityLeaveFaculty: number;
  expiringThisMonth: number;
};

export type ReplacementAssignmentRow = {
  id: string;
  assignmentCode: string | null;
  reason: string;
  reasonLabel: string;
  startDate: string;
  endDate: string;
  status: string;
  salaryArrangement: string;
  monthlyAgreedAmount: number | null;
  fullWorkloadTransfer: boolean;
  remarks: string | null;
  includeInPayroll: boolean;
  trackOnly: boolean;
  privatePayment: boolean;
  originalStaff: {
    id: string;
    fullName: string;
    employeeCode: string;
    department?: { id?: string; name: string } | null;
  };
  substitute: {
    id: string;
    fullName: string;
    substituteCode: string;
    mobile?: string | null;
    email?: string | null;
  };
  department: { id: string; name: string } | null;
  subjects: Array<{
    id: string;
    subjectLabel: string | null;
    courseId: string | null;
    offeringSectionId: string | null;
    notes: string | null;
  }>;
};

export type SubstituteStaffRow = {
  id: string;
  substituteCode: string;
  fullName: string;
  category: string;
  department: string | null;
  departmentId: string | null;
  mobile: string | null;
  email: string | null;
  status: string;
  currentAssignment: {
    id: string;
    originalStaffName: string;
    originalEmployeeCode: string;
    startDate: string;
    endDate: string;
    reason: string;
  } | null;
};

export async function fetchSubstituteDashboard() {
  const { data } = await api.get<SubstituteDashboard>('/v1/hr/substitute/dashboard');
  return data;
}

export async function fetchSubstituteStaff(
  params?: Record<string, string | number | boolean | undefined>,
) {
  const { data } = await api.get<{ data: SubstituteStaffRow[]; meta: { total: number } }>(
    '/v1/hr/substitute/staff',
    { params },
  );
  return data;
}

export async function fetchSubstituteStaffDetail(id: string) {
  const { data } = await api.get<
    SubstituteStaffRow & { documents: unknown[]; assignments: ReplacementAssignmentRow[] }
  >(`/v1/hr/substitute/staff/${id}`);
  return data;
}

export async function fetchReplacementAssignments(
  params?: Record<string, string | number | boolean | undefined>,
) {
  const { data } = await api.get<{ data: ReplacementAssignmentRow[]; meta: { total: number } }>(
    '/v1/hr/substitute/assignments',
    { params },
  );
  return data;
}

export async function fetchActiveReplacementForStaff(staffProfileId: string) {
  const { data } = await api.get<ReplacementAssignmentRow | null>(
    `/v1/hr/substitute/assignments/active/${staffProfileId}`,
  );
  return data;
}

export async function createReplacementAssignment(payload: Record<string, unknown>) {
  const { data } = await api.post<ReplacementAssignmentRow>(
    '/v1/hr/substitute/assignments',
    payload,
  );
  return data;
}

export async function createSubstituteStaff(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/hr/substitute/staff', payload);
  return data;
}

export async function completeReplacementAssignment(id: string, remarks?: string) {
  const { data } = await api.post(`/v1/hr/substitute/assignments/${id}/complete`, { remarks });
  return data;
}

export async function cancelReplacementAssignment(id: string, remarks?: string) {
  const { data } = await api.post(`/v1/hr/substitute/assignments/${id}/cancel`, { remarks });
  return data;
}

export async function fetchReplacementReport(type: 'active' | 'study-leave' | 'history') {
  const { data } = await api.get<ReplacementAssignmentRow[]>(`/v1/hr/substitute/reports/${type}`);
  return data;
}

export const REPLACEMENT_REASON_OPTIONS = [
  { value: 'STUDY_LEAVE', label: 'Study Leave' },
  { value: 'PHD_LEAVE', label: 'PhD Study Leave' },
  { value: 'MATERNITY_LEAVE', label: 'Maternity Leave' },
  { value: 'MEDICAL_LEAVE', label: 'Medical Leave' },
  { value: 'FDP', label: 'Faculty Development Program' },
  { value: 'RESEARCH_FELLOWSHIP', label: 'Research Fellowship' },
  { value: 'SABBATICAL', label: 'Sabbatical Leave' },
  { value: 'DEPUTATION', label: 'Deputation' },
  { value: 'OTHER', label: 'Other' },
];

export const SALARY_ARRANGEMENT_OPTIONS = [
  { value: 'COLLEGE_PAYS_SUBSTITUTE', label: 'College Pays Substitute' },
  { value: 'ORIGINAL_EMPLOYEE_PAYS_SUBSTITUTE', label: 'Original Employee Pays Substitute' },
  { value: 'NO_PAYMENT_TRACKING', label: 'No Salary Tracking' },
];

export const SUBSTITUTE_CATEGORY_OPTIONS = [
  { value: 'REPLACEMENT_FACULTY', label: 'Replacement Faculty' },
  { value: 'GUEST_FACULTY', label: 'Guest Faculty' },
  { value: 'VISITING_FACULTY', label: 'Visiting Faculty' },
  { value: 'TEMPORARY_FACULTY', label: 'Temporary Faculty' },
  { value: 'CONTRACT_FACULTY', label: 'Contract Faculty' },
];
