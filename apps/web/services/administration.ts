import { api } from '@/services/api';
import type {
  AuditLogRow,
  ImportModuleMeta,
  LookupTypeGroup,
  MasterLookupRow,
  PermissionRow,
  PortalUserFilters,
  PortalUsersListResponse,
  RoleRow,
  SecuritySettings,
  UserSummary,
} from '@/types/administration';
import { apiErrorMessage } from '@/utils/api-error';

export async function fetchUserSummary(): Promise<UserSummary> {
  const { data } = await api.get('/v1/admin/users/summary');
  return data;
}

export async function fetchPortalUsers(
  filters: PortalUserFilters = {},
): Promise<PortalUsersListResponse> {
  const { data } = await api.get('/v1/admin/users', { params: filters });
  return data;
}

export async function fetchActivationUsers(
  filters: PortalUserFilters = {},
): Promise<PortalUsersListResponse> {
  const { data } = await api.get('/v1/admin/users/activation', { params: filters });
  return data;
}

export async function fetchPortalUser(id: string) {
  const { data } = await api.get(`/v1/admin/users/${id}`);
  return data;
}

export async function createPortalUser(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/admin/users', payload);
  return data;
}

export async function updatePortalUser(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/admin/users/${id}`, payload);
  return data;
}

export async function activatePortalUser(id: string) {
  const { data } = await api.post(`/v1/admin/users/${id}/activate`);
  return data;
}

export async function suspendPortalUser(id: string) {
  const { data } = await api.post(`/v1/admin/users/${id}/suspend`);
  return data;
}

export async function resetPortalUserPassword(
  id: string,
  payload?: { newPassword?: string; forceReset?: boolean },
) {
  const { data } = await api.post(`/v1/admin/users/${id}/reset-password`, payload ?? {});
  return data as { success: boolean; generatedPassword?: string };
}

export async function bulkActivateUsers(userIds: string[]) {
  const { data } = await api.post('/v1/admin/users/bulk/activate', { userIds });
  return data;
}

export async function bulkResetPasswords(userIds: string[], forceReset = true) {
  const { data } = await api.post('/v1/admin/users/bulk/reset-password', {
    userIds,
    forceReset,
  });
  return data;
}

export async function sendUserCredentials(id: string) {
  const { data } = await api.post(`/v1/admin/users/${id}/send-credentials`);
  return data as { accepted: boolean; email: string; generatedPassword?: string };
}

export async function impersonateUser(id: string) {
  const { data } = await api.post(`/v1/admin/users/${id}/impersonate`);
  return data;
}

export async function endImpersonation(impersonationSessionId?: string) {
  const { data } = await api.post('/v1/admin/users/impersonate/end', {
    impersonationSessionId,
  });
  return data;
}

export async function fetchRoles(): Promise<RoleRow[]> {
  const { data } = await api.get('/v1/admin/rbac/roles');
  return data;
}

export async function fetchPermissions(): Promise<PermissionRow[]> {
  const { data } = await api.get('/v1/admin/rbac/permissions');
  return data;
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]) {
  const { data } = await api.put(`/v1/admin/rbac/roles/${roleId}/permissions`, {
    permissionIds,
  });
  return data;
}

export async function fetchWorkspaceTemplates() {
  const { data } = await api.get('/v1/admin/rbac/workspace-templates');
  return data as {
    slug: string;
    name: string;
    description: string;
    permissions: string[];
    defaultHome: string;
  }[];
}

export async function applyWorkspaceTemplate(roleId: string, templateSlug: string) {
  const { data } = await api.post(`/v1/admin/rbac/roles/${roleId}/apply-template`, {
    templateSlug,
  });
  return data;
}

export async function fetchUserEffectivePermissions(userId: string) {
  const { data } = await api.get(`/v1/admin/rbac/users/${userId}/effective-permissions`);
  return data;
}

export async function updateUserPermissionOverrides(
  userId: string,
  grantPermissionIds: string[],
  denyPermissionIds: string[],
) {
  const { data } = await api.put(`/v1/admin/rbac/users/${userId}/permission-overrides`, {
    grantPermissionIds,
    denyPermissionIds,
  });
  return data;
}

export async function refreshAuthPermissions() {
  const { data } = await api.post('/v1/auth/permissions/refresh');
  return data;
}

export async function createRole(payload: { slug: string; name: string; description?: string }) {
  const { data } = await api.post('/v1/admin/rbac/roles', payload);
  return data;
}

export async function fetchAuditLogs(params: Record<string, string | undefined>) {
  const { data } = await api.get<{
    items: AuditLogRow[];
    total: number;
    page: number;
    totalPages: number;
  }>('/v1/admin/audit-logs', { params });
  return data;
}

export async function fetchSecuritySettings(): Promise<SecuritySettings> {
  const { data } = await api.get('/v1/admin/security/settings');
  return data;
}

export async function updateSecuritySettings(payload: Partial<SecuritySettings>) {
  const { data } = await api.patch('/v1/admin/security/settings', payload);
  return data as SecuritySettings;
}

export async function fetchActiveSessions(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/admin/security/sessions', { params });
  return data;
}

export async function revokeSession(sessionId: string) {
  const { data } = await api.post(`/v1/admin/security/sessions/${sessionId}/revoke`);
  return data;
}

export async function fetchLoginHistory(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/admin/security/login-history', { params });
  return data;
}

export async function fetchLookupTypeGroups(): Promise<LookupTypeGroup[]> {
  const { data } = await api.get('/v1/master-lookups/types');
  return data;
}

export async function fetchMasterLookupsAdmin(
  type: string,
  activeOnly = false,
): Promise<MasterLookupRow[]> {
  const { data } = await api.get('/v1/master-lookups', {
    params: { type, activeOnly: activeOnly ? 'true' : 'false' },
  });
  return data;
}

export async function createMasterLookup(payload: {
  lookupType: string;
  code: string;
  label: string;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const { data } = await api.post('/v1/master-lookups', payload);
  return data;
}

export async function updateMasterLookup(
  id: string,
  payload: { label?: string; sortOrder?: number; isActive?: boolean },
) {
  const { data } = await api.patch(`/v1/master-lookups/${id}`, payload);
  return data;
}

export async function fetchImportModules(): Promise<ImportModuleMeta[]> {
  const { data } = await api.get('/v1/admin/import-export/modules');
  return data;
}

export async function fetchImportBatches(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/admin/import-export/batches', { params });
  return data;
}

export async function validatePortalUsersImport(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/v1/admin/import-export/PORTAL_USERS/validate', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function commitPortalUsersImport(
  batchId: string,
  mode: 'VALID_ONLY' | 'STRICT' = 'VALID_ONLY',
) {
  const { data } = await api.post('/v1/admin/import-export/PORTAL_USERS/commit', null, {
    params: { batchId, mode },
  });
  return data;
}

export async function downloadPortalUsersTemplate() {
  const { data } = await api.get('/v1/admin/import-export/PORTAL_USERS/template', {
    responseType: 'blob',
  });
  return data as Blob;
}

export { apiErrorMessage };
