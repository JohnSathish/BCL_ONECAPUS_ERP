import { apiFetch } from '@/api/client';
import type { PrincipalLeaveQueue, PrincipalMobileSummary } from '@/types/principal-desk';

export function fetchPrincipalMobileSummary() {
  return apiFetch<PrincipalMobileSummary>('/v1/principal-desk/mobile/summary');
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
