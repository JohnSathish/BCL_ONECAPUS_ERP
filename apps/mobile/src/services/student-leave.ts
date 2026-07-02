import { apiFetch } from '@/api/client';

export type StudentLeaveType = {
  id: string;
  code: string;
  name: string;
  yearlyLimit?: number | string | null;
};

export type StudentLeaveApplication = {
  id: string;
  fromDate: string;
  toDate: string;
  totalDays?: number | string;
  reason?: string | null;
  status: string;
  createdAt?: string;
  leaveType?: { code?: string; name?: string };
};

export function fetchStudentLeaveTypes() {
  return apiFetch<StudentLeaveType[]>('/v1/students/leave/types');
}

export function fetchStudentLeaveApplications() {
  return apiFetch<StudentLeaveApplication[]>('/v1/students/me/leave/applications');
}

export function applyStudentLeave(payload: {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}) {
  return apiFetch<StudentLeaveApplication>('/v1/students/leave/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function formatLeaveDate(value: string) {
  if (!value) return '—';
  return value.slice(0, 10);
}

export function formatLeaveStatus(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status;
  }
}

export function leaveStatusColor(status: string) {
  switch (status) {
    case 'APPROVED':
      return '#107C10';
    case 'REJECTED':
      return '#DC2626';
    case 'PENDING':
      return '#D97706';
    default:
      return '#6B7280';
  }
}

export function computeLeaveDays(fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return null;
  }
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}
