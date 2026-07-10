import { setAppType } from '@/api/client';
import { getApiBase, mobileHeadersAsync } from '@/api/config';
import { clearSession, getRefreshToken } from '@/auth/session';
import { unregisterPushDevice } from '@/services/push-notifications';

/** Best-effort server revoke of the current refresh session. */
async function revokeServerSession() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return;

  try {
    const [apiBase, headers] = await Promise.all([getApiBase(), mobileHeadersAsync()]);
    await fetch(`${apiBase}/v1/auth/logout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Continue clearing local session even if network/logout fails
  }
}

export async function logout() {
  try {
    await revokeServerSession();
  } catch {
    // ignore
  }
  try {
    await unregisterPushDevice();
  } catch {
    // continue clearing local session
  }
  await clearSession();
  setAppType('student');
}
