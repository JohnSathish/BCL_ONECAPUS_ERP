import { getApiBase, schoolHeaders } from '@/api/config';
import { clearSession, getRefreshToken, saveSession } from '@/auth/session';

export async function refreshAccessToken() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');
  const headers = await schoolHeaders();
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/v1/auth/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new Error("You're offline. Some information may be unavailable.");
  }
  const json = await res.json().catch(() => ({}));
  const data = ((json as { data?: { accessToken?: string; refreshToken?: string } }).data ??
    json) as { accessToken?: string; refreshToken?: string; message?: string };
  if (!res.ok || !data.accessToken || !data.refreshToken) {
    await clearSession();
    throw new Error(data.message || 'Session expired');
  }
  await saveSession(data.accessToken, data.refreshToken);
  return data;
}
