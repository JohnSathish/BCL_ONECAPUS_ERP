import { api } from './api';

function unwrap(data: unknown): unknown {
  if (data && typeof data === 'object' && 'success' in data && 'data' in (data as object)) {
    return (data as { data: unknown }).data;
  }
  return data;
}

export type SchoolAccountStatus =
  | 'NOT_ACTIVATED'
  | 'ACTIVATION_PENDING'
  | 'ACTIVE'
  | 'LOCKED'
  | 'DISABLED';

export type SchoolAccountStudent = {
  studentId: string;
  userId: string | null;
  fullName: string;
  admissionNumber: string;
  classLabel: string | null;
  accountStatus: SchoolAccountStatus;
  lastLoginAt: string | null;
  activatedAt: string | null;
};

export async function fetchSchoolAccountSettings() {
  const { data } = await api.get('/v1/school-sis/account-security/settings');
  return unwrap(data) as Record<string, number | boolean | string>;
}

export async function saveSchoolAccountSettings(payload: Record<string, number | boolean>) {
  const { data } = await api.patch('/v1/school-sis/account-security/settings', payload);
  return unwrap(data);
}

export async function fetchSchoolAccountStudents(params?: {
  q?: string;
  status?: string;
  sectionId?: string;
}) {
  const { data } = await api.get('/v1/school-sis/account-security/students', { params });
  const rows = unwrap(data);
  return (Array.isArray(rows) ? rows : []) as SchoolAccountStudent[];
}

export async function issueSchoolActivationCode(userId: string) {
  const { data } = await api.post(
    `/v1/school-sis/account-security/users/${userId}/activation-code`,
  );
  return unwrap(data) as { code: string; expiresAt: string; notice?: string };
}

export async function bulkSchoolActivationCodes(sectionId: string) {
  const { data } = await api.post('/v1/school-sis/account-security/bulk-codes', { sectionId });
  return unwrap(data) as {
    year: string;
    count: number;
    sheets: Array<{
      fullName: string;
      admissionNumber: string;
      classLabel: string;
      code: string;
    }>;
  };
}

export async function unlockSchoolAccount(userId: string) {
  const { data } = await api.post(`/v1/school-sis/account-security/users/${userId}/unlock`);
  return unwrap(data);
}

export async function disableSchoolAccount(userId: string) {
  const { data } = await api.post(`/v1/school-sis/account-security/users/${userId}/disable`);
  return unwrap(data);
}

export async function revokeSchoolAccountSessions(userId: string) {
  const { data } = await api.post(
    `/v1/school-sis/account-security/users/${userId}/revoke-sessions`,
  );
  return unwrap(data);
}

export async function resetSchoolAccountPassword(userId: string) {
  const { data } = await api.post(`/v1/school-sis/account-security/users/${userId}/reset-password`);
  return unwrap(data) as { ok: boolean; code: string; expiresAt: string; notice?: string };
}

export async function fetchSchoolAccountEvents(userId?: string) {
  const { data } = await api.get('/v1/school-sis/account-security/events', {
    params: userId ? { userId } : undefined,
  });
  const rows = unwrap(data);
  return (Array.isArray(rows) ? rows : []) as Array<{
    id: string;
    userId: string | null;
    event: string;
    identifier: string | null;
    reason: string | null;
    ipAddress: string | null;
    device: string | null;
    createdAt: string;
  }>;
}
