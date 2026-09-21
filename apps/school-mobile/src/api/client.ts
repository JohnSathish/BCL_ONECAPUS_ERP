import { getApiBase, schoolHeaders } from '@/api/config';
import { accessTokenLooksExpired, getAccessToken, getUser, saveUser } from '@/auth/session';
import { justDidPasswordLogin } from '@/auth/password-gate';
import {
  AccountDisabledError,
  DeviceBlockedError,
  refreshAccessToken,
  SessionExpiredError,
  SessionRevokedError,
} from '@/auth/token-refresh';

let onAuthFailure: ((kind: 'expired' | 'disabled' | 'revoked' | 'blocked') => void) | null = null;
let onPasswordResetRequired: (() => void) | null = null;
export function setAuthFailureHandler(
  handler: (kind: 'expired' | 'disabled' | 'revoked' | 'blocked') => void,
) {
  onAuthFailure = handler;
}

export function setPasswordResetHandler(handler: () => void) {
  onPasswordResetRequired = handler;
}

type Options = RequestInit & {
  skipAuth?: boolean;
  _retried?: boolean;
  ignoreAuthFailure?: boolean;
};

function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

function messageOf(json: unknown, fallback: string) {
  if (json && typeof json === 'object') {
    const row = json as { message?: string; detail?: string };
    return row.detail || row.message || fallback;
  }
  return fallback;
}

function isOfflineMessage(msg: string) {
  return /offline|network request failed|failed to fetch|timeout/i.test(msg);
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const headers = await schoolHeaders(options.headers as Record<string, string>);
  if (!options.skipAuth) {
    let token = await getAccessToken();
    if (token && accessTokenLooksExpired(token) && !options._retried) {
      try {
        const refreshed = await refreshAccessToken();
        token = refreshed.accessToken;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (isOfflineMessage(msg)) {
          throw err instanceof Error ? err : new Error(msg);
        }
        if (
          err instanceof AccountDisabledError ||
          err instanceof DeviceBlockedError ||
          err instanceof SessionRevokedError
        ) {
          if (!options.ignoreAuthFailure) {
            onAuthFailure?.(
              err instanceof AccountDisabledError
                ? 'disabled'
                : err instanceof DeviceBlockedError
                  ? 'blocked'
                  : 'revoked',
            );
          }
          throw err;
        }
        if (err instanceof SessionExpiredError) {
          if (!options.ignoreAuthFailure && !justDidPasswordLogin()) onAuthFailure?.('expired');
          throw new Error('Please sign in again.');
        }
      }
    }
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error("You're offline. Some information may be unavailable.");
  }
  const json = await res.json().catch(() => ({}));
  const combined = `${messageOf(json, '')}`;
  if ((res.status === 401 || res.status === 403) && /DEVICE_BLOCKED/i.test(combined)) {
    if (!options.ignoreAuthFailure) onAuthFailure?.('blocked');
    throw new DeviceBlockedError();
  }
  if ((res.status === 401 || res.status === 403) && /SESSION_REVOKED/i.test(combined)) {
    if (!options.ignoreAuthFailure) onAuthFailure?.('revoked');
    throw new SessionRevokedError();
  }
  if ((res.status === 401 || res.status === 403) && /ACCOUNT_DISABLED/i.test(combined)) {
    if (!options.ignoreAuthFailure) onAuthFailure?.('disabled');
    throw new AccountDisabledError();
  }
  if (res.status === 403 && /PASSWORD_RESET_REQUIRED/i.test(combined)) {
    const user = await getUser();
    if (user) await saveUser({ ...user, mustResetPassword: true });
    if (!options.ignoreAuthFailure) onPasswordResetRequired?.();
    throw new Error('Change your temporary password before continuing.');
  }
  if (res.status === 401 && !options.skipAuth && !options._retried) {
    try {
      await refreshAccessToken();
      return apiFetch<T>(path, { ...options, _retried: true });
    } catch (err) {
      if (err instanceof AccountDisabledError) {
        if (!options.ignoreAuthFailure) onAuthFailure?.('disabled');
        throw err;
      }
      if (err instanceof DeviceBlockedError) {
        if (!options.ignoreAuthFailure) onAuthFailure?.('blocked');
        throw err;
      }
      if (err instanceof SessionRevokedError) {
        if (!options.ignoreAuthFailure) onAuthFailure?.('revoked');
        throw err;
      }
      const msg = err instanceof Error ? err.message : '';
      if (isOfflineMessage(msg)) {
        throw err instanceof Error ? err : new Error(msg);
      }
      if (err instanceof SessionExpiredError) {
        if (!options.ignoreAuthFailure && !justDidPasswordLogin()) onAuthFailure?.('expired');
        throw new Error('Please sign in again.');
      }
      throw err instanceof Error ? err : new Error(msg);
    }
  }
  if (!res.ok) {
    throw new Error(messageOf(json, 'Something went wrong. Please try again.'));
  }
  return unwrap<T>(json);
}
