import { apiFetch } from '@/api/client';

export type LeaveTypeOption = {
  id: string;
  code: string;
  name: string;
  yearlyLimit?: number | string | null;
};

export type LeaveSummary = {
  casual: number;
  sick: number;
  earned: number;
  pendingRequests: number;
  leaveTypes?: LeaveTypeOption[];
};

export type LeaveApplication = {
  id: string;
  fromDate: string;
  toDate: string;
  totalDays?: number | string;
  reason?: string | null;
  status: string;
  createdAt?: string;
  leaveType?: { id: string; code?: string; name?: string };
};

export function fetchLeaveSummary() {
  return apiFetch<LeaveSummary>('/v1/hr/leave/summary/me');
}

export function fetchLeaveApplications() {
  return apiFetch<LeaveApplication[]>('/v1/hr/leave/applications/me');
}

export function applyLeave(payload: {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
}) {
  return apiFetch<LeaveApplication>('/v1/hr/leave/applications/me', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function formatLeaveStatus(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'HOD_APPROVED':
      return 'HOD Approved';
    case 'APPROVED':
      return 'Approved';
    case 'REJECTED':
      return 'Rejected';
    case 'CANCELLED':
      return 'Cancelled';
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
    case 'HOD_APPROVED':
      return '#2563EB';
    case 'PENDING':
      return '#D97706';
    default:
      return '#6B7280';
  }
}

export function formatLeaveDate(value: string) {
  if (!value) return '—';
  return value.slice(0, 10);
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
