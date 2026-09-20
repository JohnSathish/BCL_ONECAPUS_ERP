import { getApiBase, schoolHeaders } from '@/api/config';
import { justDidPasswordLogin } from '@/auth/password-gate';
import { clearSession, getRefreshToken, saveSession } from '@/auth/session';

export class AccountDisabledError extends Error {
  constructor() {
    super('ACCOUNT_DISABLED');
    this.name = 'AccountDisabledError';
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super('SESSION_REVOKED');
    this.name = 'SessionRevokedError';
  }
}

export class DeviceBlockedError extends Error {
  constructor() {
    super('DEVICE_BLOCKED');
    this.name = 'DeviceBlockedError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export async function refreshAccessToken(opts?: { biometricUnlock?: boolean }) {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new SessionExpiredError('No refresh token');
  const headers = await schoolHeaders();
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/v1/auth/refresh`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        refreshToken,
        rememberMe: true,
        ...(opts?.biometricUnlock ? { unlockMethod: 'biometric_unlock' } : {}),
      }),
    });
  } catch {
    throw new Error("You're offline. Some information may be unavailable.");
  }
  const json = await res.json().catch(() => ({}));
  const data = ((json as { data?: { accessToken?: string; refreshToken?: string } }).data ??
    json) as { accessToken?: string; refreshToken?: string; message?: string };
  const message = `${data.message || ''} ${(json as { message?: string }).message || ''}`;
  if (res.status === 401 || res.status === 403) {
    if (/DEVICE_BLOCKED/i.test(message)) {
      if (!justDidPasswordLogin()) await clearSession();
      throw new DeviceBlockedError();
    }
    if (/SESSION_REVOKED/i.test(message)) {
      if (!justDidPasswordLogin()) await clearSession();
      throw new SessionRevokedError();
    }
    if (/ACCOUNT_DISABLED|disabled/i.test(message)) {
      if (!justDidPasswordLogin()) await clearSession();
      throw new AccountDisabledError();
    }
    if (!justDidPasswordLogin()) await clearSession();
    throw new SessionExpiredError(data.message || 'Session expired');
  }
  if (!res.ok || !data.accessToken || !data.refreshToken) {
    throw new Error(data.message || 'Could not refresh session');
  }
  await saveSession(data.accessToken, data.refreshToken);
  return data;
}
