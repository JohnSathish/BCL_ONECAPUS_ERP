import { apiFetch } from '@/api/client';

export type DeptActivity = {
  id: string;
  title: string;
  activityType: string;
  venue: string;
  eventDate: string;
  status: string;
  department?: { id: string; name: string; code: string } | null;
};

export type DeptActivityRegistration = {
  id: string;
  status: string;
  qrPassToken: string;
  registeredAt: string;
  activity?: DeptActivity | null;
};

export function fetchOpenDepartmentActivities() {
  return apiFetch<DeptActivity[]>('/v1/department-activities/open');
}

export function fetchMyDepartmentActivityRegistrations() {
  return apiFetch<DeptActivityRegistration[]>('/v1/department-activities/mine');
}

export function registerForDepartmentActivity(activityId: string) {
  return apiFetch<DeptActivityRegistration>(`/v1/department-activities/${activityId}/register`, {
    method: 'POST',
  });
}

export function withdrawDepartmentActivity(activityId: string) {
  return apiFetch(`/v1/department-activities/${activityId}/withdraw`, {
    method: 'POST',
  });
}
