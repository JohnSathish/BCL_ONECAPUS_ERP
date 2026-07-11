import { getDeviceId } from '@/auth/device';
import { getApiBase, getTenantSlug } from '@/auth/school-config';
import { getStoredAppType, type StoredAppType } from '@/auth/session';
import { getInstalledAppVersion } from '@/utils/app-version';

/** Prefer getInstalledAppVersion() — this mirrors expo config at call time. */
export function getAppVersion() {
  return getInstalledAppVersion();
}

/** @deprecated Prefer getAppVersion() */
export const APP_VERSION = getInstalledAppVersion();

/** @deprecated Use getApiBase() — kept for legacy imports during migration */
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** @deprecated Use getTenantSlug() */
export const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'demo';

let appType: StoredAppType = 'student';
let cachedDeviceId: string | null = null;

export function setAppType(type: StoredAppType) {
  appType = type;
}

export function getAppType() {
  return appType;
}

export async function hydrateAppType() {
  const stored = await getStoredAppType();
  if (stored) {
    appType = stored;
  }
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
  const [deviceId, tenantSlug] = await Promise.all([ensureDeviceId(), getTenantSlug()]);
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': tenantSlug,
    'X-Client-Type': 'mobile',
    'X-App-Type': appType,
    'X-App-Version': getInstalledAppVersion(),
    'X-Device-Id': deviceId,
    ...extra,
  };
}

/** Prefer mobileHeadersAsync — sync variant may use stale tenant before hydrate. */
export function mobileHeaders(extra?: Record<string, string>) {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': TENANT_SLUG,
    'X-Client-Type': 'mobile',
    'X-App-Type': appType,
    'X-App-Version': getInstalledAppVersion(),
    ...(cachedDeviceId ? { 'X-Device-Id': cachedDeviceId } : {}),
    ...extra,
  };
}

export { getApiBase, getTenantSlug } from '@/auth/school-config';
