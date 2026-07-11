import { Linking } from 'react-native';
import { getApiBaseSync } from '@/auth/school-config';

/** Resolve college web portal origin from the active API base URL. */
export function resolveWebPortalOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  try {
    const apiUrl = getApiBaseSync()?.trim();
    if (apiUrl) {
      const u = new URL(apiUrl);
      return u.origin;
    }
  } catch {
    /* ignore */
  }
  return 'https://erp.donboscocollege.ac.in';
}

export function webPortalPath(path: string): string {
  const origin = resolveWebPortalOrigin();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${p}`;
}

export async function openWebPortal(path: string) {
  await Linking.openURL(webPortalPath(path));
}
