import { API_BASE_URL, getRealtimeOrigin } from '@/lib/http/env';

function apiOrigin(): string {
  if (API_BASE_URL.startsWith('http')) {
    return API_BASE_URL.replace(/\/api\/?$/, '');
  }
  // Prefer Nest origin so Puppeteer PDF and browser both load /uploads without needing Next proxy.
  return getRealtimeOrigin();
}

/** Resolve API-hosted upload paths to absolute URLs for images and downloads. */
export function resolveUploadAssetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const origin = apiOrigin();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalized}`;
}

/** @deprecated Use resolveUploadAssetUrl */
export const resolveBrandingAssetUrl = resolveUploadAssetUrl;

export const DEFAULT_LOGIN_LOGO = '/branding/basecode-labs-logo.png';
export const DEFAULT_FAVICON = '/branding/basecode-labs-logo.png';
