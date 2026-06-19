import { getDeviceId } from '@/auth/device';

export const APP_VERSION = '1.0.0';
export const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'demo';
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

let appType: 'student' | 'staff' = 'student';
let cachedDeviceId: string | null = null;

export function setAppType(type: 'student' | 'staff') {
  appType = type;
}

export function getAppType() {
  return appType;
}

export async function ensureDeviceId() {
  if (!cachedDeviceId) {
    cachedDeviceId = await getDeviceId();
  }
  return cachedDeviceId;
}

export async function mobileHeadersAsync(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const deviceId = await ensureDeviceId();
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': TENANT_SLUG,
    'X-Client-Type': 'mobile',
    'X-App-Type': appType,
    'X-App-Version': APP_VERSION,
    'X-Device-Id': deviceId,
    ...extra,
  };
}

export function mobileHeaders(extra?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': TENANT_SLUG,
    'X-Client-Type': 'mobile',
    'X-App-Type': appType,
    'X-App-Version': APP_VERSION,
    ...(cachedDeviceId ? { 'X-Device-Id': cachedDeviceId } : {}),
    ...extra,
  };
}
