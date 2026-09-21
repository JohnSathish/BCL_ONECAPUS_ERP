import { secureDel, secureGet, secureSet } from '@/auth/secure-storage';

const ACCESS = 'sls_access_token';
const REFRESH = 'sls_refresh_token';
const USER = 'sls_user_snapshot';
const CHILD = 'sls_active_child';
const BIOMETRIC = 'sls_biometric_login';
const APP_LOCK = 'sls_app_lock';
const BIOMETRIC_LEVEL = 'sls_biometric_level';
const BIOMETRIC_PROMPTED = 'sls_biometric_prompted';

export type StoredUser = {
  permissions?: string[];
  roles?: string[];
  displayName?: string;
  persona?: string;
  mustResetPassword?: boolean;
  firstLogin?: boolean;
};

const setSecure = secureSet;
const getSecure = secureGet;
const delSecure = secureDel;

export async function saveSession(accessToken: string, refreshToken: string) {
  if (!accessToken || !refreshToken) {
    throw new Error('Login did not return a session. Please try again.');
  }
  await setSecure(ACCESS, accessToken);
  await setSecure(REFRESH, refreshToken);
}

export async function saveUser(user: StoredUser) {
  await setSecure(USER, JSON.stringify(user));
}

export async function getUser(): Promise<StoredUser | null> {
  const raw = await getSecure(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function getAccessToken() {
  return getSecure(ACCESS);
}

export async function getRefreshToken() {
  return getSecure(REFRESH);
}

export function accessTokenLooksExpired(token: string | null) {
  if (!token) return true;
  const parts = token.split('.');
  if (parts.length < 2) return true;
  try {
    const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    if (!json.exp) return false;
    return json.exp * 1000 < Date.now() + 15_000;
  } catch {
    return true;
  }
}

export async function saveActiveChild(id: string | null) {
  if (!id) {
    await delSecure(CHILD);
    return;
  }
  await setSecure(CHILD, id);
}

export async function getActiveChild() {
  return getSecure(CHILD);
}

export async function isBiometricLoginEnabled() {
  return (await getSecure(BIOMETRIC)) === '1';
}

export async function isAppLockEnabled() {
  return (await getSecure(APP_LOCK)) === '1';
}

export async function wasBiometricPrompted() {
  return (await getSecure(BIOMETRIC_PROMPTED)) === '1';
}

export async function setBiometricPrompted(value: boolean) {
  await setSecure(BIOMETRIC_PROMPTED, value ? '1' : '0');
}

export async function setBiometricLoginEnabled(value: boolean, enrolledLevel?: number) {
  await setSecure(BIOMETRIC, value ? '1' : '0');
  if (value && enrolledLevel != null) {
    await setSecure(BIOMETRIC_LEVEL, String(enrolledLevel));
  }
  if (!value) {
    await delSecure(BIOMETRIC_LEVEL);
    await setSecure(APP_LOCK, '0');
  }
}

export async function setAppLockEnabled(value: boolean) {
  await setSecure(APP_LOCK, value ? '1' : '0');
}

export async function getStoredBiometricLevel() {
  const raw = await getSecure(BIOMETRIC_LEVEL);
  return raw ? Number(raw) : null;
}

export async function hasPersistedSession() {
  const refresh = await getRefreshToken();
  return Boolean(refresh);
}

/** Drop access/refresh tokens only. Keep biometric preference and the user snapshot. */
export async function clearAuthTokens() {
  await Promise.all([delSecure(ACCESS), delSecure(REFRESH)]);
}

/** Explicit logout, revoked session, or disabled account. Closing the app must never call this. */
export async function clearSession() {
  await Promise.all([
    delSecure(ACCESS),
    delSecure(REFRESH),
    delSecure(USER),
    delSecure(CHILD),
    delSecure(BIOMETRIC),
    delSecure(APP_LOCK),
    delSecure(BIOMETRIC_LEVEL),
    delSecure(BIOMETRIC_PROMPTED),
  ]);
}
