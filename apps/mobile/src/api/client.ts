import { getApiBase, getAppType, mobileHeadersAsync, setAppType } from '@/api/config';
import { getAccessToken, getUserSnapshot } from '@/auth/session';
import { refreshAccessTokenString } from '@/auth/token-refresh';
import { emitUpdateRequired } from '@/services/app-update-events';

export {
  APP_VERSION,
  getApiBase,
  getTenantSlug,
  getAppType,
  hydrateAppType,
  setAppType,
} from '@/api/config';

/** @deprecated Use getApiBase() */
export { API_BASE, TENANT_SLUG } from '@/api/config';

let authFailureHandler: (() => void) | null = null;

export function setAuthFailureHandler(handler: () => void) {
  authFailureHandler = handler;
}

type FetchOptions = RequestInit & {
  auth?: string;
  skipAuth?: boolean;
  _retried?: boolean;
  /** Request timeout in ms (default 20s). */
  timeoutMs?: number;
};

const MOBILE_WRITABLE =
  /\/(?:library|question-bank)(?:\/|$)|\/auth\/(?:logout|refresh|change-password|permissions\/refresh|sessions\/revoke-all)(?:\/|$)|\/mfa\/(?:setup|verify-setup|disable|email-otp\/send|verify-login)(?:\/|$)|\/(?:export|download|print)(?:\/|$)/;

function mobileRestrictedStaffMayMutate(method: string, rawPath: string) {
  const verb = method.toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return true;
  const path = (rawPath.split('?')[0] ?? rawPath).replace(/\/+$/, '');
  return MOBILE_WRITABLE.test(path);
}

function parseError(data: unknown, fallback: string) {
  if (typeof data === 'object' && data) {
    if ('detail' in data && data.detail) return String(data.detail);
    if ('message' in data && data.message) return String(data.message);
  }
  return fallback;
}

async function doFetch<T>(path: string, options: FetchOptions): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const method = (options.method ?? 'GET').toUpperCase();
  const [apiBase, headers] = await Promise.all([
    getApiBase(),
    mobileHeadersAsync(options.headers as Record<string, string>),
  ]);

  // GET/HEAD must not force Content-Type — some WAFs reject it and RN has no body.
  if (method === 'GET' || method === 'HEAD' || isFormData) {
    delete headers['Content-Type'];
  }

  if (!options.skipAuth) {
    const token = options.auth ?? (await getAccessToken());
    if (token) headers.Authorization = `Bearer ${token}`;
    const snapshot = await getUserSnapshot();
    const restrictedEmail = (snapshot?.email ?? '').trim().toLowerCase();
    const restrictedAccount =
      snapshot?.roles?.includes('library-qp-readonly') ||
      restrictedEmail === 'rehny@donboscocollege.ac.in' ||
      restrictedEmail === 'threena@donboscocollege.ac.in' ||
      restrictedEmail === 'stephen@donboscocollege.ac.in';
    if (restrictedAccount && !mobileRestrictedStaffMayMutate(method, path)) {
      throw Object.assign(
        new Error('This account can change the library and the question paper repository only.'),
        { status: 403 },
      );
    }
  }

  const base = apiBase.replace(/\/+$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const timeoutMs = options.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'AbortError' || /aborted/i.test(err.message))) {
      let host = url;
      try {
        host = new URL(url).host;
      } catch {
        /* keep url */
      }
      const loopback = /localhost|127\.0\.0\.1|10\.0\.2\.2|10\.0\.3\.2/i.test(host);
      throw Object.assign(
        new Error(
          loopback
            ? `Could not reach ${host} in time. That address is this computer, and the school API is not running there. Reload the app to use https://erp.stlukestura.in, or start the API on port 3001.`
            : `Could not reach the school ERP (${host}). Check your internet connection and try again.`,
        ),
        { status: 408 },
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const rawText = await res.text().catch(() => '');
  let json: unknown = {};
  if (rawText) {
    try {
      json = JSON.parse(rawText);
    } catch {
      if (!res.ok) {
        const err = new Error(res.statusText || 'Request failed') as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      throw new Error('Server returned a non-JSON response. Check the institution API URL.');
    }
  }

  const data = (json as { data?: T })?.data ?? json;

  if (res.status === 401 && !options.skipAuth && !options._retried) {
    try {
      const newToken = await refreshAccessTokenString();
      return doFetch<T>(path, { ...options, auth: newToken, _retried: true });
    } catch {
      authFailureHandler?.();
      const err = new Error('Session expired') as Error & { status?: number };
      err.status = 401;
      throw err;
    }
  }

  if (!res.ok) {
    if (res.status === 426) {
      const body = (data ?? {}) as { minVersion?: string; storeUrl?: string };
      emitUpdateRequired({
        minVersion: body.minVersion ?? null,
        storeUrl: body.storeUrl ?? null,
        message: parseError(data, ''),
      });
    }
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
