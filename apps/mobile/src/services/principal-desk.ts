import { apiFetch } from '@/api/client';
import type {
  PrincipalLeaveQueue,
  PrincipalMobileSummary,
  StudentCommandCard,
} from '@/types/principal-desk';

export function fetchPrincipalMobileSummary() {
  return apiFetch<PrincipalMobileSummary>('/v1/principal-desk/mobile/summary');
}

export function fetchStudentCommand(q: string) {
  const query = q.trim();
  return apiFetch<StudentCommandCard>(
    `/v1/principal-desk/student-command?q=${encodeURIComponent(query)}`,
  );
}

export function fetchPrincipalLeaveQueue(type: 'staff' | 'student' | 'all' = 'all') {
  return apiFetch<PrincipalLeaveQueue>(
    `/v1/principal-desk/leave/applications?type=${encodeURIComponent(type)}`,
  );
}

export function approvePrincipalStaffLeave(
  id: string,
  action: 'APPROVE' | 'REJECT',
  rejectionReason?: string,
) {
  return apiFetch(`/v1/principal-desk/leave/staff/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ action, rejectionReason }),
  });
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

export function fetchPrincipalPushOptions() {
  return apiFetch<{
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
  }>('/v1/principal-desk/push/options');
}

export function searchPrincipalPushPeople(q: string) {
  return apiFetch<{
    students: Array<{ id: string; name: string; rollNumber: string | null }>;
    staff: Array<{ id: string; name: string; employeeCode: string }>;
  }>(`/v1/principal-desk/push/people?q=${encodeURIComponent(q)}`);
}

export function previewPrincipalPush(body: PrincipalPushPayload) {
  return apiFetch<{ total: number; withPush: number }>('/v1/principal-desk/push/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function sendPrincipalPush(body: PrincipalPushPayload) {
  return apiFetch<{
    id: string;
    status: string;
    recipients: number;
    devices: number;
  }>('/v1/principal-desk/push', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchPrincipalPushHistory() {
  return apiFetch<
    Array<{
      id: string;
      title: string;
      message: string;
      audienceLabel: string;
      status: string;
      sender: string;
      createdAt: string;
      acceptedByFcm: number;
      failed: number;
      skipped: number;
    }>
  >('/v1/principal-desk/push');
}

export function fetchPrincipalPushDetail(id: string) {
  return apiFetch<{
    failures: Array<{ name: string; error: string }>;
    noticeLink?: string | null;
  }>(`/v1/principal-desk/push/${id}`);
}

export function approvePrincipalStudentLeave(
  id: string,
  action: 'APPROVE' | 'REJECT',
  rejectionReason?: string,
) {
  return apiFetch(`/v1/principal-desk/leave/student/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ action, rejectionReason }),
  });
}
