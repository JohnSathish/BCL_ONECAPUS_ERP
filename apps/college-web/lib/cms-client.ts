import 'server-only';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const safeTenant = () => {
  const value = process.env.COLLEGE_TENANT_SLUG ?? process.env.NEXT_PUBLIC_TENANT_SLUG;
  if (value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return value;
  if (process.env.NODE_ENV !== 'production') return 'demo';
  return undefined;
};

/**
 * Absolute Nest `/api` base for server-side CMS fetches.
 * Prefer Docker-internal origin; never return a relative `/api` (SSR cannot resolve it).
 */
export const cmsBase = () => {
  const internal = process.env.API_INTERNAL_ORIGIN?.replace(/\/+$/, '');
  if (internal && /^https?:\/\/[^/]+$/i.test(internal)) return `${internal}/api`;

  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.endsWith('/api') ? configured : `${configured}/api`;
  }

  // Absolute ERP / web API when college-web is only given a relative `/api`.
  const erpOrigin = (
    process.env.ERP_API_ORIGIN ??
    process.env.WEB_ORIGIN ??
    process.env.NEXT_PUBLIC_ERP_LOGIN_URL?.replace(/\/login\/?$/i, '')
  )?.replace(/\/+$/, '');
  if (erpOrigin && /^https?:\/\/[^/]+$/i.test(erpOrigin)) {
    return `${erpOrigin}/api`;
  }

  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:3001/api';

  // Compose service name used by docker-compose.prod.yml
  return 'http://api:3001/api';
};

export const cmsUrl = (endpoint: string, query: Record<string, string> = {}) => {
  const base = cmsBase();
  if (!base) return undefined;
  const url = new URL(`${base}/v1/website/public/${endpoint}`);
  const tenant = safeTenant();
  if (tenant) url.searchParams.set('tenant', tenant);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
};

export const cmsHeaders = () => {
  const host = process.env.COLLEGE_CMS_HOST?.trim().toLowerCase();
  return host && /^[a-z0-9.-]+(?::\d+)?$/.test(host) ? { 'x-forwarded-host': host } : undefined;
};

/**
 * Soft-fail CMS fetch: returns null on network errors, timeouts, and non-OK
 * responses (including 404). Callers merge whatever succeeds — a missing
 * homepage page must not abandon site/news/notices payloads.
 */
export async function fetchCms(
  endpoint: string,
  query?: Record<string, string>,
  revalidate = 300,
  timeoutMs = 4500,
): Promise<unknown | null> {
  const url = cmsUrl(endpoint, query);
  if (!url) {
    console.warn(`[college-web] CMS ${endpoint} skipped — no API base URL`);
    return null;
  }
  try {
    const response = await fetch(url, {
      headers: cmsHeaders(),
      // Dev: always hit API so CMS edits show immediately. Prod: ISR via tags.
      ...(process.env.NODE_ENV !== 'production'
        ? { cache: 'no-store' as const }
        : { next: { revalidate, tags: ['website-cms'] } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.warn(`[college-web] CMS ${endpoint} responded ${response.status} (${url.origin})`);
      return null;
    }
    const payload = (await response.json()) as unknown;
    if (isRecord(payload) && payload.success === true && 'data' in payload) {
      return payload.data;
    }
    return payload;
  } catch (error) {
    console.warn(`[college-web] CMS ${endpoint} unavailable`, error);
    return null;
  }
}

export { isRecord };
