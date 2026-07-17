import { api } from '@/services/api';

const base = '/v1/department-activities';

export type ActivityTypeDef = {
  code: string;
  label: string;
  icon: string;
  isCompetition: boolean;
};

export type DepartmentActivity = {
  id: string;
  title: string;
  departmentId: string;
  activityType: string;
  status: string;
  venue?: string | null;
  eventDate: string;
  registrationStartsAt?: string | null;
  registrationEndsAt?: string | null;
  maxParticipants?: number | null;
  description?: string | null;
  attendanceFinalized?: boolean;
  department?: { id: string; name: string; code: string };
  _count?: { registrations: number; certificateLinks?: number };
  registrationCount?: number;
  attendanceCount?: number;
};

export type ActivityRegistration = {
  id: string;
  activityId: string;
  studentId: string;
  status: string;
  qrPassToken?: string | null;
  registeredAt?: string | null;
  student?: {
    id: string;
    enrollmentNumber?: string | null;
    rollNumber?: string | null;
    admissionNumber?: string | null;
    masterProfile?: { fullName?: string | null };
    user?: { displayName?: string | null; email?: string | null };
  };
  attendance?: { id: string; method?: string; markedAt?: string } | null;
  activity?: DepartmentActivity;
};

export type ActivityDashboard = {
  upcoming: number;
  completed: number;
  participants: number;
  certificates: number;
  pendingApproval: number;
};

export type UpsertActivityPayload = {
  title: string;
  departmentId: string;
  activityType: string;
  eventDate: string;
  venue?: string;
  maxParticipants?: number;
  description?: string;
  registrationStartsAt?: string;
  registrationEndsAt?: string;
};

export async function fetchActivityTypes(): Promise<ActivityTypeDef[]> {
  const { data } = await api.get(`${base}/types`);
  return data;
}

export async function fetchDashboard(): Promise<ActivityDashboard> {
  const { data } = await api.get(`${base}/dashboard`);
  return data;
}

export async function fetchActivities(params?: {
  departmentId?: string;
  status?: string;
  upcoming?: boolean;
}): Promise<DepartmentActivity[]> {
  const { data } = await api.get(base, {
    params: params
      ? {
          ...params,
          upcoming: params.upcoming ? 'true' : undefined,
        }
      : undefined,
  });
  return data;
}

export async function fetchActivity(id: string): Promise<DepartmentActivity> {
  const { data } = await api.get(`${base}/${id}`);
  return data;
}

export async function createActivity(payload: UpsertActivityPayload) {
  const { data } = await api.post(base, payload);
  return data;
}

export async function updateActivity(id: string, payload: UpsertActivityPayload) {
  const { data } = await api.patch(`${base}/${id}`, payload);
  return data;
}

export async function transitionStatus(id: string, status: string) {
  const { data } = await api.post(`${base}/${id}/status`, { status });
  return data;
}

export async function fetchOpenActivities(): Promise<DepartmentActivity[]> {
  const { data } = await api.get(`${base}/open`);
  return data;
}

export async function fetchMyRegistrations(): Promise<ActivityRegistration[]> {
  const { data } = await api.get(`${base}/mine`);
  return data;
}

export async function registerForActivity(id: string) {
  const { data } = await api.post(`${base}/${id}/register`, {});
  return data;
}

export async function withdrawRegistration(id: string) {
  const { data } = await api.post(`${base}/${id}/withdraw`, {});
  return data;
}

export async function fetchRegistrations(activityId: string): Promise<ActivityRegistration[]> {
  const { data } = await api.get(`${base}/${activityId}/registrations`);
  return data;
}

export async function markAttendance(
  activityId: string,
  payload: { registrationId?: string; qrPassToken?: string; method?: string },
) {
  const { data } = await api.post(`${base}/${activityId}/attendance`, payload);
  return data;
}

export async function finalizeAttendance(activityId: string) {
  const { data } = await api.post(`${base}/${activityId}/attendance/finalize`, {});
  return data;
}

export async function issueParticipationCertificates(activityId: string) {
  const { data } = await api.post(`${base}/${activityId}/certificates/participation`, {});
  return data;
}
