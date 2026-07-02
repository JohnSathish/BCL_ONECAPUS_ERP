import { apiFetch } from '@/api/client';

export type MobileDeviceSession = {
  id: string;
  userAgent: string;
  ipAddress: string;
  clientType: string;
  appType: string | null;
  appVersion: string | null;
  deviceLabel: string;
  lastActiveAt: string;
  isCurrent: boolean;
};

export function fetchMobileDeviceSessions() {
  return apiFetch<{ sessions: MobileDeviceSession[] }>('/v1/mobile-app/devices/sessions');
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<{ success: boolean; message?: string }>('/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword: newPassword }),
  });
}
