import { Platform } from 'react-native';
import { getDeviceId } from '@/auth/device';
import { getActiveChild } from '@/auth/session';

export const APP_VERSION = '1.0.17';

export function getApiBase() {
  return (process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://erp.stlukestura.in/api').replace(
    /\/+$/,
    '',
  );
}

export function getTenantSlug() {
  return process.env.EXPO_PUBLIC_TENANT_SLUG?.trim() || 'st-lukes-tura';
}

export function getLoginHost() {
  return process.env.EXPO_PUBLIC_LOGIN_HOST?.trim() || 'erp.stlukestura.in';
}

export function mediaUrl(
  path?: string | { original?: string; card?: string; thumb?: string; full?: string } | null,
) {
  if (!path) return '';
  const rel =
    typeof path === 'string' ? path : path.card || path.original || path.thumb || path.full || '';
  if (!rel) return '';
  if (/^https?:\/\//i.test(rel)) return rel;
  const origin = getApiBase().replace(/\/api$/i, '');
  return `${origin}${rel.startsWith('/') ? rel : `/${rel}`}`;
}

export async function schoolHeaders(
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const [deviceId, childId] = await Promise.all([getDeviceId(), getActiveChild()]);
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': getTenantSlug(),
    'X-Login-Host': getLoginHost(),
    'X-Forwarded-Host': getLoginHost(),
    'X-Client-Type': 'mobile',
    'X-App-Version': APP_VERSION,
    'X-App-Platform': Platform.OS === 'ios' ? 'ios' : 'android',
    'X-Device-Id': deviceId,
    ...(childId ? { 'X-School-Child-Id': childId } : {}),
    ...extra,
  };
}
