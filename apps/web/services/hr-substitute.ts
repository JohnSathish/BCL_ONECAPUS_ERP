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

export function fetchSubstituteDashboard() {
  return api.get<SubstituteDashboard>('/v1/hr/substitute/dashboard');
}

export function fetchSubstituteStaff(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return api.get<{ data: SubstituteStaffRow[]; meta: { total: number } }>(
    '/v1/hr/substitute/staff',
    { params },
  );
}

export function fetchSubstituteStaffDetail(id: string) {
  return api.get<
    SubstituteStaffRow & { documents: unknown[]; assignments: ReplacementAssignmentRow[] }
  >(`/v1/hr/substitute/staff/${id}`);
}

export function fetchReplacementAssignments(
  params?: Record<string, string | number | boolean | undefined>,
) {
  return api.get<{ data: ReplacementAssignmentRow[]; meta: { total: number } }>(
    '/v1/hr/substitute/assignments',
    { params },
  );
}

export function fetchActiveReplacementForStaff(staffProfileId: string) {
  return api.get<ReplacementAssignmentRow | null>(
    `/v1/hr/substitute/assignments/active/${staffProfileId}`,
  );
}

export function createReplacementAssignment(payload: Record<string, unknown>) {
  return api.post<ReplacementAssignmentRow>('/v1/hr/substitute/assignments', payload);
}

export function createSubstituteStaff(payload: Record<string, unknown>) {
  return api.post('/v1/hr/substitute/staff', payload);
}

export function completeReplacementAssignment(id: string, remarks?: string) {
  return api.post(`/v1/hr/substitute/assignments/${id}/complete`, { remarks });
}

export function cancelReplacementAssignment(id: string, remarks?: string) {
  return api.post(`/v1/hr/substitute/assignments/${id}/cancel`, { remarks });
}

export function fetchReplacementReport(type: 'active' | 'study-leave' | 'history') {
  return api.get<ReplacementAssignmentRow[]>(`/v1/hr/substitute/reports/${type}`);
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
