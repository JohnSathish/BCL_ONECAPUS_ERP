export const APP_VERSION = '1.0.0';
export const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'demo';
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

let appType: 'student' | 'staff' = 'student';

export function setAppType(type: 'student' | 'staff') {
  appType = type;
}

export function getAppType() {
  return appType;
}

export function mobileHeaders(extra?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': TENANT_SLUG,
    'X-Client-Type': 'mobile',
    'X-App-Type': appType,
    'X-App-Version': APP_VERSION,
    ...extra,
  };
}
