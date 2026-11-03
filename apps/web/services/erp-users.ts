import { api } from '@/services/api';
import type {
  ErpLoginEvent,
  ErpUserDetail,
  ErpUserFormPayload,
  ErpUsersFilters,
  ErpUsersListResponse,
  ErpUsersOptions,
  ErpUsersSummary,
} from '@/types/erp-users';

const BASE = '/v1/admin/erp-users';

export async function fetchErpUsersSummary(): Promise<ErpUsersSummary> {
  const { data } = await api.get(`${BASE}/summary`);
  return data;
}

export async function fetchErpUsersOptions(): Promise<ErpUsersOptions> {
  const { data } = await api.get(`${BASE}/options`);
  return data;
}

export async function fetchErpUsers(filters: ErpUsersFilters): Promise<ErpUsersListResponse> {
  const { data } = await api.get(BASE, { params: filters });
  return data;
}

export async function fetchErpUser(id: string): Promise<ErpUserDetail> {
  const { data } = await api.get(`${BASE}/${id}`);
  return data;
}

export async function fetchErpUserLoginHistory(id: string, page = 1) {
  const { data } = await api.get<{
    items: ErpLoginEvent[];
    total: number;
    page: number;
    totalPages: number;
  }>(`${BASE}/${id}/login-history`, { params: { page, limit: 20 } });
  return data;
}

export async function createErpUser(payload: ErpUserFormPayload): Promise<ErpUserDetail> {
  const { data } = await api.post(BASE, payload);
  return data;
}

export async function updateErpUser(
  id: string,
  payload: Partial<ErpUserFormPayload>,
): Promise<ErpUserDetail> {
  const { data } = await api.patch(`${BASE}/${id}`, payload);
  return data;
}

export type ErpUserAction =
  | 'activate'
  | 'deactivate'
  | 'lock'
  | 'unlock'
  | 'force-password-change'
  | 'revoke-sessions';

export async function runErpUserAction(id: string, action: ErpUserAction) {
  const { data } = await api.post(`${BASE}/${id}/${action}`);
  return data;
}

export async function resetErpUserPassword(
  id: string,
  payload: { newPassword: string; confirmPassword: string; forcePasswordChange: boolean },
) {
  const { data } = await api.post(`${BASE}/${id}/reset-password`, payload);
  return data as { success: boolean };
}
