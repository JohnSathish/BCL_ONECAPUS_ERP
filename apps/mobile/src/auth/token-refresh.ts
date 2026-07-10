import { getApiBase, mobileHeadersAsync } from '@/api/config';
import { clearSession, getRefreshToken, getRememberMe, saveSession } from '@/auth/session';

let refreshPromise: Promise<RefreshSessionResult> | null = null;

export type RefreshSessionResult = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string;
  user?: {
    permissions?: string[];
    roles?: string[];
    shiftIds?: string[];
    allShifts?: boolean;
    mustResetPassword?: boolean;
  };
};

export class NetworkRefreshError extends Error {
  constructor(message = 'Network error during session refresh') {
    super(message);
    this.name = 'NetworkRefreshError';
  }
}

export function isNetworkRefreshError(err: unknown): err is NetworkRefreshError {
  return (
    err instanceof NetworkRefreshError ||
    (err instanceof Error && err.name === 'NetworkRefreshError')
  );
}

type RefreshResponse = RefreshSessionResult & { message?: string };

/**
 * Silently rotate access (+ refresh) tokens.
 * Auth failures clear the local session; network failures do not.
 */
export async function refreshAccessToken(): Promise<RefreshSessionResult> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const rememberMe = await getRememberMe();
    const [apiBase, headers] = await Promise.all([getApiBase(), mobileHeadersAsync()]);

    let res: Response;
    try {
      res = await fetch(`${apiBase}/v1/auth/refresh`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          refreshToken,
          ...(rememberMe != null ? { rememberMe } : {}),
        }),
      });
    } catch {
      throw new NetworkRefreshError();
    }

    const json = await res.json().catch(() => ({}));
    const data = ((json as { data?: RefreshResponse })?.data ?? json) as RefreshResponse;

    if (!res.ok) {
      const message =
        typeof data === 'object' && data && 'message' in data
          ? String(data.message)
          : 'Refresh failed';
      throw new Error(message);
    }

    if (!data.accessToken || !data.refreshToken) {
      throw new Error('Invalid refresh response');
    }

    await saveSession(data.accessToken, data.refreshToken);
    return data;
  })()
    .catch(async (err) => {
      if (!isNetworkRefreshError(err)) {
        await clearSession();
      }
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/** Access-token-only helper for API client retries. */
export async function refreshAccessTokenString(): Promise<string> {
  const session = await refreshAccessToken();
  return session.accessToken;
}
