import { Platform } from 'react-native';
import { getApiBaseSync } from '@/auth/school-config';

/** Bundled PNG is used when tenant branding has no supported remote logo. */
export const COLLEGE_LOGO_FALLBACK_URL = process.env.EXPO_PUBLIC_COLLEGE_LOGO_URL ?? '';

/** RN Image does not reliably render ICO / favicon URLs on Android. */
export function isSupportedRemoteImageUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  const lower = url.trim().toLowerCase();
  if (lower.endsWith('.ico')) return false;
  if (lower.includes('favicon')) return false;
  return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('/');
}

/** Map API host for Android emulator (host machine via 10.0.2.2). */
export function resolveApiOriginForDevice(apiBase: string): string {
  let origin = apiBase.replace(/\/api\/?$/, '');
  if (Platform.OS === 'android') {
    origin = origin.replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://10.0.2.2');
    origin = origin.replace(/^http:\/\/127\.0\.0\.1(?=[:/]|$)/, 'http://10.0.2.2');
  }
  return origin;
}

/** Turn stored `/uploads/...` paths into absolute URLs for React Native. */
export function resolveUploadAssetUrl(path?: string | null): string | undefined {
  if (!path?.trim()) return undefined;
  const trimmed = path.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Reject favicon/ICO only — PDFs and other files must remain openable.
    const lower = trimmed.toLowerCase();
    if (lower.endsWith('.ico') || lower.includes('favicon')) return undefined;
    if (Platform.OS === 'android') {
      return trimmed
        .replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://10.0.2.2')
        .replace(/^http:\/\/127\.0\.0\.1(?=[:/]|$)/, 'http://10.0.2.2');
    }
    return trimmed;
  }
  const apiBase = getApiBaseSync();
  if (!apiBase?.trim()) return undefined;
  const origin = resolveApiOriginForDevice(apiBase);
  if (!origin) return undefined;
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (normalized.startsWith('/uploads/')) {
    return `${origin}${normalized}`;
  }
  return `${origin}/uploads/${normalized.replace(/^\/+/, '')}`;
}

/** Cache-bust profile photos cached as immutable static assets. */
export function resolveUploadAvatarUrl(path?: string | null): string | undefined {
  const base = resolveUploadAssetUrl(path);
  if (!base) return undefined;
  if (base.startsWith('file:') || base.startsWith('content:')) return base;
  const stamped = path?.match(/photo-(\d+)\./)?.[1];
  const v = stamped ?? encodeURIComponent(path || base);
  return `${base}${base.includes('?') ? '&' : '?'}v=${v}`;
}

export function resolveCollegeLogoUri(
  branding?: { logoUrl?: string | null },
  extraCandidates: Array<string | null | undefined> = [],
): string | undefined {
  const candidates = [branding?.logoUrl, ...extraCandidates, COLLEGE_LOGO_FALLBACK_URL];
  for (const raw of candidates) {
    const resolved = resolveUploadAssetUrl(raw);
    if (resolved && isSupportedRemoteImageUrl(resolved)) {
      return resolved;
    }
  }
  return undefined;
}
