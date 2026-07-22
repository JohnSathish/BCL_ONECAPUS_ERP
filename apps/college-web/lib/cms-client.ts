import 'server-only';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const safeTenant = () => {
  const value = process.env.COLLEGE_TENANT_SLUG ?? process.env.NEXT_PUBLIC_TENANT_SLUG;
  if (value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return value;
  if (process.env.NODE_ENV !== 'production') return 'demo';
  return undefined;
};

export const cmsBase = () => {
  const internal = process.env.API_INTERNAL_ORIGIN?.replace(/\/+$/, '');
  if (internal && /^https?:\/\/[^/]+$/i.test(internal)) return `${internal}/api`;
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.endsWith('/api') ? configured : `${configured}/api`;
  }
  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:3001/api';
  return undefined;
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
): Promise<unknown | null> {
  const url = cmsUrl(endpoint, query);
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: cmsHeaders(),
      // Dev: always hit API so CMS edits show immediately. Prod: ISR via tags.
      ...(process.env.NODE_ENV !== 'production'
        ? { cache: 'no-store' as const }
        : { next: { revalidate, tags: ['website-cms'] } }),
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) {
      if (process.env.NODE_ENV !== 'production' && response.status !== 404) {
        console.warn(`[college-web] CMS ${endpoint} responded ${response.status}`);
      }
      return null;
    }
    const payload = (await response.json()) as unknown;
    if (isRecord(payload) && payload.success === true && 'data' in payload) {
      return payload.data;
    }
    return payload;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[college-web] CMS ${endpoint} unavailable`, error);
    }
    return null;
  }
}

export { isRecord };
