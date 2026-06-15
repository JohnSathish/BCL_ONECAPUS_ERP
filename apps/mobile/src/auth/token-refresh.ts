import { API_BASE, mobileHeaders } from '@/api/config';
import { clearSession, getRefreshToken, saveSession } from '@/auth/session';

let refreshPromise: Promise<string> | null = null;

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string;
};

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: mobileHeaders(),
      body: JSON.stringify({ refreshToken }),
    });
    const json = await res.json().catch(() => ({}));
    const data = ((json as { data?: RefreshResponse })?.data ?? json) as RefreshResponse;

    if (!res.ok) {
      throw new Error(
        typeof data === 'object' && data && 'message' in data
          ? String((data as { message?: string }).message)
          : 'Refresh failed',
      );
    }

    await saveSession(data.accessToken, data.refreshToken);
    return data.accessToken;
  })()
    .catch(async (err) => {
      await clearSession();
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}
