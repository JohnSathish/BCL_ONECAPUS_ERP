import { api } from './api';

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object') {
    const row = payload as { success?: boolean; data?: T };
    if (row.success === true && 'data' in row) return row.data as T;
  }
  return payload as T;
}

export const DEVICE_REASONS = [
  'Lost device',
  'Device replaced',
  'Security concern',
  'User requested logout',
  'Account issue',
  'Unauthorized device',
  'Other',
] as const;

export async function fetchSchoolDevicesOverview() {
  const { data } = await api.get('/v1/school-sis/devices/overview');
  return unwrap<Record<string, number>>(data);
}

export async function fetchSchoolDevices(params: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/school-sis/devices', { params });
  return unwrap<{
    total: number;
    page: number;
    limit: number;
    appVersions: string[];
    items: Array<Record<string, unknown>>;
  }>(data);
}

export async function fetchSchoolDevice(id: string) {
  const { data } = await api.get(`/v1/school-sis/devices/${id}`);
  return unwrap<Record<string, unknown>>(data);
}

export async function fetchSchoolDeviceLogs(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/school-sis/devices/logs', { params });
  return unwrap<{ total: number; page: number; items: Array<Record<string, unknown>> }>(data);
}

export async function schoolDeviceAction(
  id: string,
  action: 'sign-out' | 'revoke' | 'block' | 'unblock',
  reason?: string,
) {
  const { data } = await api.post(`/v1/school-sis/devices/${id}/${action}`, { reason });
  return data;
}

export async function schoolDeviceRevokeAll(userId: string, reason?: string) {
  const { data } = await api.post(`/v1/school-sis/devices/user/${userId}/revoke-all`, { reason });
  return data as { ok: boolean; count: number };
}

export async function schoolDeviceBulk(
  ids: string[],
  action: 'revoke' | 'signout' | 'block',
  reason?: string,
) {
  const { data } = await api.post('/v1/school-sis/devices/bulk', { ids, action, reason });
  return data;
}
