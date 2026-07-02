import { API_BASE } from '@/api/config';

/** Remote fallback when tenant branding has no uploaded logo yet. */
export const COLLEGE_LOGO_FALLBACK_URL =
  process.env.EXPO_PUBLIC_COLLEGE_LOGO_URL ?? 'https://donboscocollege.ac.in/favicon.ico';

/** Turn stored `/uploads/...` paths into absolute URLs for React Native Image. */
export function resolveUploadAssetUrl(path?: string | null): string | undefined {
  if (!path?.trim()) return undefined;
  const trimmed = path.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const origin = API_BASE.replace(/\/api\/?$/, '');
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (normalized.startsWith('/uploads/')) {
    return `${origin}${normalized}`;
  }
  return `${origin}/uploads/${normalized.replace(/^\/+/, '')}`;
}

export function resolveCollegeLogoUri(branding?: {
  logoUrl?: string | null;
  splashImageUrl?: string | null;
}): string {
  return (
    resolveUploadAssetUrl(branding?.logoUrl) ??
    resolveUploadAssetUrl(branding?.splashImageUrl) ??
    COLLEGE_LOGO_FALLBACK_URL
  );
}
