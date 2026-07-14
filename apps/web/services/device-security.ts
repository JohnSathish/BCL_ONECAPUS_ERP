import { api } from './api';

export type DeviceSecurityDashboard = {
  kpis: {
    activeSessions: number;
    webSessions: number;
    mobileSessions: number;
    onlineUsers: number;
    todaysLogins: number;
    failedLoginsToday: number;
    blockedDevices: number;
    trustedDevices: number;
    lockedAccounts: number;
    newDevicesDetected: number;
    successRate: number;
  };
  charts: {
    dailyLoginTrend: { date: string; count: number }[];
    deviceDistribution: { name: string; count: number }[];
    browserDistribution: { name: string; count: number }[];
    osDistribution: { name: string; count: number }[];
    loginByHour: { hour: number; count: number }[];
  };
  recentAlerts: {
    id: string;
    userId: string | null;
    user: { id: string; email: string; displayName: string | null } | null;
    identifier: string;
    outcome: string;
    flags: string[];
    accessDeviceId: string | null;
    ipAddress: string | null;
    createdAt: string;
  }[];
};

export type DeviceSessionRow = {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    username: string | null;
  } | null;
  ipAddress: string | null;
  userAgent: string | null;
  device: string;
  browser: string;
  clientType: string;
  accessDevice: AccessDeviceRow | null;
  loginAt: string;
  lastActivity: string;
  expiresAt: string;
  status: 'Online' | 'Idle' | string;
};

export type AccessDeviceRow = {
  id: string;
  userId: string;
  clientType: string;
  deviceType: string | null;
  deviceName: string | null;
  manufacturer: string | null;
  brand: string | null;
  model: string | null;
  platform: string | null;
  osVersion: string | null;
  appVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  screenResolution: string | null;
  language: string | null;
  timeZone: string | null;
  lastIp: string | null;
  lastIpMasked: string | null;
  lastCity: string | null;
  lastRegion: string | null;
  lastCountry: string | null;
  lastIsp: string | null;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  loginCount: number;
  blockedAt: string | null;
  blockReason: string | null;
  user?: {
    id: string;
    email: string;
    displayName: string | null;
    username?: string | null;
  } | null;
};

export type LoginEventRow = {
  id: string;
  userId: string | null;
  user: { id: string; email: string; displayName: string | null } | null;
  identifier: string;
  method: string;
  outcome: string;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  accessDeviceId: string | null;
  suspiciousFlags: string[];
  country: string | null;
  clientType: string | null;
  createdAt: string;
};

export type DevicePolicies = {
  id: string;
  minPasswordLength: number;
  passwordExpiryDays: number | null;
  passwordHistoryCount: number;
  forceResetOnFirstLogin: boolean;
  sessionTimeoutMinutes: number;
  mfaEnforced: boolean;
  allowBiometricLogin: boolean;
  allowQrLogin: boolean;
  allowRfidLogin: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
  maxConcurrentSessions: number | null;
  alertOnNewDevice: boolean;
  alertOnNewCountry: boolean;
  maxFailedBeforeFlag: number;
  blockOnExcessiveFails: boolean;
  notifyEmailOnSecurity: boolean;
  notifyPushOnSecurity: boolean;
  allowRememberMe: boolean;
  geoLookupEnabled: boolean;
};

type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function fetchDeviceDashboard() {
  const { data } = await api.get<DeviceSecurityDashboard>('/v1/admin/device-security/dashboard');
  return data;
}

export async function fetchDeviceSessions(params?: Record<string, string | undefined>) {
  const { data } = await api.get<PageResult<DeviceSessionRow>>(
    '/v1/admin/device-security/sessions',
    { params },
  );
  return data;
}

export async function revokeDeviceSession(sessionId: string) {
  const { data } = await api.post(`/v1/admin/device-security/sessions/${sessionId}/revoke`);
  return data;
}

export async function revokeAllUserDeviceSessions(userId: string) {
  const { data } = await api.post(`/v1/admin/device-security/users/${userId}/sessions/revoke-all`);
  return data;
}

export async function fetchDeviceLoginHistory(params?: Record<string, string | undefined>) {
  const { data } = await api.get<PageResult<LoginEventRow>>(
    '/v1/admin/device-security/login-history',
    { params },
  );
  return data;
}

export async function fetchFailedLogins(params?: Record<string, string | undefined>) {
  const { data } = await api.get<PageResult<LoginEventRow>>(
    '/v1/admin/device-security/failed-logins',
    { params },
  );
  return data;
}

export async function fetchAccessDevices(params?: Record<string, string | undefined>) {
  const { data } = await api.get<PageResult<AccessDeviceRow>>('/v1/admin/device-security/devices', {
    params,
  });
  return data;
}

export async function fetchAccessDevice(id: string) {
  const { data } = await api.get<{
    device: AccessDeviceRow;
    timeline: LoginEventRow[];
    activeSessions: { id: string; createdAt: string; expiresAt: string }[];
  }>(`/v1/admin/device-security/devices/${id}`);
  return data;
}

export async function blockAccessDevice(id: string, reason?: string) {
  const { data } = await api.post(`/v1/admin/device-security/devices/${id}/block`, {
    reason,
  });
  return data;
}

export async function unblockAccessDevice(id: string) {
  const { data } = await api.post(`/v1/admin/device-security/devices/${id}/unblock`);
  return data;
}

export async function trustAccessDevice(id: string) {
  const { data } = await api.post(`/v1/admin/device-security/devices/${id}/trust`);
  return data;
}

export async function clearTrustedDevices(userId: string) {
  const { data } = await api.post(
    `/v1/admin/device-security/users/${userId}/devices/clear-trusted`,
  );
  return data;
}

export async function fetchDevicePolicies() {
  const { data } = await api.get<DevicePolicies>('/v1/admin/device-security/policies');
  return data;
}

export async function updateDevicePolicies(payload: Partial<DevicePolicies>) {
  const { data } = await api.patch<DevicePolicies>('/v1/admin/device-security/policies', payload);
  return data;
}

export function deviceReportUrl(kind: 'devices' | 'sessions' | 'failed-logins' | 'login-activity') {
  return `/v1/admin/device-security/reports/${kind}.csv`;
}

export async function downloadDeviceReport(
  kind: 'devices' | 'sessions' | 'failed-logins' | 'login-activity',
) {
  const { data } = await api.get<Blob>(deviceReportUrl(kind), {
    responseType: 'blob',
  });
  const { downloadBlob } = await import('@/utils/download-blob');
  downloadBlob(data, `${kind}.csv`);
}
