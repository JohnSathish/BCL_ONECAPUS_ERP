import { api } from './api';

export async function fetchSchoolIamDashboard() {
  const { data } = await api.get('/v1/school-sis/iam/dashboard');
  return data;
}

export async function fetchSchoolIamCatalog() {
  const { data } = await api.get('/v1/school-sis/iam/catalog');
  return data;
}

export async function fetchSchoolIamUsers(params: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/school-sis/iam/users', { params });
  return data as { total: number; page: number; items: Array<Record<string, unknown>> };
}

export async function fetchSchoolIamUser(id: string) {
  const { data } = await api.get(`/v1/school-sis/iam/users/${id}`);
  return data as Record<string, unknown>;
}

export async function createSchoolIamUser(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/iam/users', payload);
  return data;
}

export async function patchSchoolIamUser(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/school-sis/iam/users/${id}`, payload);
  return data;
}

export async function setSchoolIamStatus(id: string, status: string) {
  const { data } = await api.post(`/v1/school-sis/iam/users/${id}/status/${status}`);
  return data;
}

export async function resetSchoolIamPassword(id: string) {
  const { data } = await api.post(`/v1/school-sis/iam/users/${id}/reset-password`, {
    forceChange: true,
  });
  return data;
}

export async function assignSchoolIamRoles(id: string, roleSlugs: string[]) {
  const { data } = await api.post(`/v1/school-sis/iam/users/${id}/roles`, { roleSlugs });
  return data;
}

export async function saveSchoolIamDirectPerms(
  id: string,
  items: { slug: string; effect: 'grant' | 'deny' }[],
) {
  const { data } = await api.post(`/v1/school-sis/iam/users/${id}/permissions`, { items });
  return data;
}

export async function logoutSchoolIamUser(id: string) {
  const { data } = await api.post(`/v1/school-sis/iam/users/${id}/logout-all`);
  return data;
}

export async function impersonateSchoolIamUser(id: string, reason: string) {
  const { data } = await api.post(`/v1/school-sis/iam/users/${id}/impersonate`, { reason });
  return data;
}

export async function testSchoolIamAccess(id: string, permission: string) {
  const { data } = await api.post(`/v1/school-sis/iam/users/${id}/test-access`, { permission });
  return data;
}

export async function bulkSchoolIam(ids: string[], action: string, roleSlug?: string) {
  const { data } = await api.post('/v1/school-sis/iam/users/bulk', { ids, action, roleSlug });
  return data;
}

export async function resendSchoolIamInvite(id: string) {
  const { data } = await api.post(`/v1/school-sis/iam/invites/${id}/resend`);
  return data;
}

export async function revokeSchoolIamInvite(id: string) {
  const { data } = await api.post(`/v1/school-sis/iam/invites/${id}/revoke`);
  return data;
}

export async function importSchoolIamUsers(rows: Record<string, string>[], confirm?: boolean) {
  const { data } = await api.post('/v1/school-sis/iam/users/import', { rows, confirm });
  return data;
}

export async function fetchSchoolIamRoles() {
  const { data } = await api.get('/v1/school-sis/iam/roles');
  return data as Array<Record<string, unknown>>;
}

export async function seedSchoolIamRoles() {
  const { data } = await api.post('/v1/school-sis/iam/seed-roles');
  return data;
}

export async function saveSchoolIamRole(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/iam/roles', payload);
  return data;
}

export async function cloneSchoolIamRole(id: string) {
  const { data } = await api.post(`/v1/school-sis/iam/roles/${id}/clone`);
  return data;
}

export async function deleteSchoolIamRole(id: string) {
  const { data } = await api.delete(`/v1/school-sis/iam/roles/${id}`);
  return data;
}

export async function fetchSchoolIamInvites() {
  const { data } = await api.get('/v1/school-sis/iam/invites');
  return data as Array<Record<string, unknown>>;
}

export async function inviteSchoolIamUser(payload: Record<string, string>) {
  const { data } = await api.post('/v1/school-sis/iam/invites', payload);
  return data;
}

export async function fetchSchoolIamSessions() {
  const { data } = await api.get('/v1/school-sis/iam/sessions');
  return data as Array<Record<string, unknown>>;
}

export async function killSchoolIamSession(id: string) {
  const { data } = await api.delete(`/v1/school-sis/iam/sessions/${id}`);
  return data;
}

export async function fetchSchoolIamLogins() {
  const { data } = await api.get('/v1/school-sis/iam/login-history');
  return data as Array<Record<string, unknown>>;
}

export async function fetchSchoolIamAudit() {
  const { data } = await api.get('/v1/school-sis/iam/audit');
  return data as Array<Record<string, unknown>>;
}

export async function fetchSchoolIamAlerts() {
  const { data } = await api.get('/v1/school-sis/iam/alerts');
  return data as Array<Record<string, unknown>>;
}

export async function fetchSchoolIamSecurity() {
  const { data } = await api.get('/v1/school-sis/iam/security-settings');
  return data as Record<string, unknown>;
}

export async function saveSchoolIamSecurity(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/school-sis/iam/security-settings', payload);
  return data;
}

export async function fetchSchoolIamLinkOptions(q: string) {
  const { data } = await api.get('/v1/school-sis/iam/link-options', { params: { q } });
  return data as {
    staff: Array<{ id: string; fullName: string; employeeCode: string; email?: string }>;
    students: Array<{
      id: string;
      fullName: string;
      admissionNumber: string;
      email?: string;
    }>;
    guardians: Array<{ id: string; fullName: string; phone: string | null }>;
  };
}

export async function fetchSchoolIamDirectoryPreview() {
  const { data } = await api.get('/v1/school-sis/iam/directory-provision');
  return data as {
    defaultPassword: string;
    studentsTotal: number;
    studentsMissing: number;
    staffTotal: number;
    staffMissing: number;
  };
}

export async function provisionSchoolIamDirectory(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-sis/iam/directory-provision', payload, {
    timeout: 120_000,
  });
  return data as {
    ok: boolean;
    defaultPassword: string;
    created: number;
    linked: number;
    skipped: number;
    remaining: number;
    done: boolean;
    failed: Array<{ name: string; error: string }>;
  };
}
