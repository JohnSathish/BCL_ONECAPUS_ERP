import { API_BASE_URL, getDirectApiBaseUrl, getRealtimeOrigin } from '@/lib/http/env';

/** Nest/API origin that serves `/uploads` (for Puppeteer / direct fetches). */
function nestUploadOrigin(): string {
  const direct = getDirectApiBaseUrl();
  if (direct.startsWith('http')) {
    return direct.replace(/\/api\/?$/, '');
  }
  if (API_BASE_URL.startsWith('http')) {
    return API_BASE_URL.replace(/\/api\/?$/, '');
  }
  return getRealtimeOrigin();
}

/**
 * Origin for <img> / links in the browser.
 * Prefer same-origin so Next CSP (`img-src 'self'`) and `/uploads` rewrites work.
 * Pointing at http://127.0.0.1:3001 is blocked by CSP in local dev.
 */
function displayUploadOrigin(): string {
  if (API_BASE_URL.startsWith('http')) {
    return API_BASE_URL.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

/** Strip host from absolute upload URLs so we can re-point them. */
function uploadsPathOnly(path: string): string | null {
  if (path.startsWith('/uploads/') || path.startsWith('uploads/')) {
    return path.startsWith('/') ? path : `/${path}`;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const u = new URL(path);
      if (u.pathname.startsWith('/uploads/')) {
        return `${u.pathname}${u.search}`;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** Resolve API-hosted upload paths to URLs safe for browser display (CSP + Next rewrite). */
export function resolveUploadAssetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;

  const uploads = uploadsPathOnly(path);
  if (!uploads) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const origin = displayUploadOrigin();
    return origin ? `${origin}${normalized}` : normalized;
  }

  const origin = displayUploadOrigin();
  return origin ? `${origin}${uploads}` : uploads;
}

/**
 * Absolute Nest URL for print/PDF (Puppeteer loads assets from the API host,
 * not the Next.js origin).
 */
export function resolveUploadAssetUrlForPrint(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;

  const uploads = uploadsPathOnly(path);
  if (!uploads) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${nestUploadOrigin()}${normalized}`;
  }

  return `${nestUploadOrigin()}${uploads}`;
}

/** @deprecated Use resolveUploadAssetUrl */
export const resolveBrandingAssetUrl = resolveUploadAssetUrl;

export const DEFAULT_LOGIN_LOGO = '/branding/basecode-labs-logo.png';
export const DEFAULT_FAVICON = '/branding/basecode-labs-logo.png';
