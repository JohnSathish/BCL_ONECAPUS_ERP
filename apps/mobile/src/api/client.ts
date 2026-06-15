import { API_BASE, getAppType, mobileHeaders, setAppType } from '@/api/config';
import { getAccessToken } from '@/auth/session';
import { refreshAccessToken } from '@/auth/token-refresh';

export { APP_VERSION, API_BASE, TENANT_SLUG, getAppType, setAppType } from '@/api/config';

let authFailureHandler: (() => void) | null = null;

export function setAuthFailureHandler(handler: () => void) {
  authFailureHandler = handler;
}

type FetchOptions = RequestInit & {
  auth?: string;
  skipAuth?: boolean;
  _retried?: boolean;
};

function parseError(data: unknown, fallback: string) {
  if (typeof data === 'object' && data) {
    if ('detail' in data && data.detail) return String(data.detail);
    if ('message' in data && data.message) return String(data.message);
  }
  return fallback;
}

async function doFetch<T>(path: string, options: FetchOptions): Promise<T> {
  const headers: Record<string, string> = mobileHeaders(options.headers as Record<string, string>);
  if (!options.skipAuth) {
    const token = options.auth ?? (await getAccessToken());
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  const data = (json as { data?: T })?.data ?? json;

  if (res.status === 401 && !options.skipAuth && !options._retried) {
    try {
      const newToken = await refreshAccessToken();
      return doFetch<T>(path, { ...options, auth: newToken, _retried: true });
    } catch {
      authFailureHandler?.();
      const err = new Error('Session expired') as Error & { status?: number };
      err.status = 401;
      throw err;
    }
  }

  if (!res.ok) {
    const err = new Error(parseError(data, res.statusText)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return data as T;
}

export async function apiFetch<T>(
  path: string,
  options: Omit<FetchOptions, 'skipAuth'> & { skipAuth?: boolean } = {},
): Promise<T> {
  return doFetch<T>(path, options);
}
