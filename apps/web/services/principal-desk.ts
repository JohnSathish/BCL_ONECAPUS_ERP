import { api } from '@/services/api';
import type {
  InstitutionalHealth,
  PrincipalDeskDashboard,
  StaffCommandCard,
  StudentCommandCard,
} from '@/types/principal-desk';

export async function fetchPrincipalDashboard(): Promise<PrincipalDeskDashboard> {
  const { data } = await api.get<PrincipalDeskDashboard>('/v1/principal-desk/dashboard');
  return data;
}

export async function fetchStudentCommand(q: string): Promise<StudentCommandCard> {
  const { data } = await api.get<StudentCommandCard>('/v1/principal-desk/student-command', {
    params: { q },
  });
  return data;
}

export async function fetchStaffCommand(q: string): Promise<StaffCommandCard> {
  const { data } = await api.get<StaffCommandCard>('/v1/principal-desk/staff-command', {
    params: { q },
  });
  return data;
}

export async function fetchPrincipalAttendanceControl() {
  const { data } = await api.get('/v1/principal-desk/attendance-control');
  return data;
}

export async function fetchPrincipalFeeDefaulters(params?: {
  departmentId?: string;
  semesterNo?: number;
  shiftId?: string;
}) {
  const { data } = await api.get('/v1/principal-desk/fee-defaulters', { params });
  return data;
}

export async function fetchInstitutionalHealth(): Promise<InstitutionalHealth> {
  const { data } = await api.get<InstitutionalHealth>('/v1/principal-desk/institutional-health');
  return data;
}

export async function fetchNaacReadiness() {
  const { data } = await api.get('/v1/principal-desk/naac-readiness');
  return data;
}

export async function fetchCommitteeMonitor() {
  const { data } = await api.get('/v1/principal-desk/committees');
  return data;
}

export async function fetchCommitteeList() {
  const { data } = await api.get('/v1/principal-desk/committees/list');
  return data;
}

export async function fetchLeaveApplications(type: 'staff' | 'student' | 'all' = 'all') {
  const { data } = await api.get('/v1/principal-desk/leave/applications', {
    params: { type },
  });
  return data;
}

export async function approveStaffLeave(
  id: string,
  action: 'APPROVE' | 'REJECT',
  rejectionReason?: string,
) {
  const { data } = await api.patch(`/v1/principal-desk/leave/staff/${id}/approve`, {
    action,
    rejectionReason,
  });
  return data;
}

export async function approveStudentLeave(
  id: string,
  action: 'APPROVE' | 'REJECT',
  rejectionReason?: string,
) {
  const { data } = await api.patch(`/v1/principal-desk/leave/student/${id}/approve`, {
    action,
    rejectionReason,
  });
  return data;
}

export async function applyStudentLeave(body: {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}) {
  const { data } = await api.post('/v1/students/leave/applications', body);
  return data;
}

export async function fetchStudentLeaveTypes() {
  const { data } = await api.get('/v1/students/leave/types');
  return data;
}

export type PrincipalPushAudience = 'STUDENTS' | 'STAFF' | 'STUDENTS_AND_STAFF';

export type PrincipalPushPayload = {
  audience: PrincipalPushAudience;
  title: string;
  message: string;
  noticeLink?: string;
  scheduledAt?: string;
  departmentIds?: string[];
  semesterSequences?: number[];
  sectionIds?: string[];
  studentIds?: string[];
  staffProfileIds?: string[];
};

export async function fetchPrincipalPushOptions() {
  const { data } = await api.get('/v1/principal-desk/push/options');
  return data as {
    fcmConfigured: boolean;
    fcmDemoMode: boolean;
    audiences: Array<{ id: PrincipalPushAudience; label: string }>;
    departments: Array<{ id: string; name: string; code: string }>;
    semesters: number[];
    sections: Array<{
      id: string;
      sectionCode: string;
      semesterNo: number | null;
      courseCode: string;
      courseTitle: string;
    }>;
  };
}

export async function searchPrincipalPushPeople(q: string) {
  const { data } = await api.get('/v1/principal-desk/push/people', { params: { q } });
  return data as {
    students: Array<{ id: string; name: string; rollNumber: string | null }>;
    staff: Array<{ id: string; name: string; employeeCode: string }>;
  };
}

export async function previewPrincipalPush(body: PrincipalPushPayload) {
  const { data } = await api.post('/v1/principal-desk/push/preview', body);
  return data as { total: number; withPush: number };
}

export async function sendPrincipalPush(body: PrincipalPushPayload) {
  const { data } = await api.post('/v1/principal-desk/push', body);
  return data as {
    id: string;
    status: string;
    recipients: number;
    devices: number;
    audienceLabel: string;
  };
}

export async function fetchPrincipalPushHistory() {
  const { data } = await api.get('/v1/principal-desk/push');
  return data as Array<{
    id: string;
    title: string;
    message: string;
    audienceLabel: string;
    status: string;
    sender: string;
    createdAt: string;
    sentAt: string | null;
    scheduledAt: string | null;
    acceptedByFcm: number;
    failed: number;
    skipped: number;
  }>;
}

export async function fetchPrincipalPushDetail(id: string) {
  const { data } = await api.get(`/v1/principal-desk/push/${id}`);
  return data as {
    id: string;
    title: string;
    message: string;
    audienceLabel: string;
    status: string;
    sender: string;
    acceptedByFcm: number;
    failed: number;
    skipped: number;
    noticeLink?: string | null;
    failures: Array<{ name: string; error: string; at: string }>;
  };
}
