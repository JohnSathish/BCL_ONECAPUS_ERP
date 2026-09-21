import {
  accessTokenLooksExpired,
  getAccessToken,
  getRefreshToken,
  getUser,
  isAppLockEnabled,
  isBiometricLoginEnabled,
  setBiometricLoginEnabled,
} from '@/auth/session';
import { biometricCapability, biometricEnrollmentChanged } from '@/auth/biometric';
import {
  AccountDisabledError,
  DeviceBlockedError,
  refreshAccessToken,
  SessionExpiredError,
  SessionRevokedError,
} from '@/auth/token-refresh';
import { HOME_PATH } from '@/services/notification-path';
import { justDidPasswordLogin } from '@/auth/password-gate';
import { destinationAfterAuth, PASSWORD_PATH } from '@/auth/post-login';

export type AuthRoute =
  | typeof HOME_PATH
  | '/welcome'
  | '/login'
  | '/unlock'
  | '/account-disabled'
  | '/session-ended'
  | '/device-blocked'
  | typeof PASSWORD_PATH;

export async function routeAfterPasswordLogin(
  user?: { mustResetPassword?: boolean; firstLogin?: boolean } | null,
  firstLogin?: boolean,
) {
  return destinationAfterAuth(user, firstLogin ?? user?.firstLogin);
}

function homeFor(user: Awaited<ReturnType<typeof getUser>>) {
  return destinationAfterAuth(user, user?.firstLogin);
}

/**
 * Cold-start / resume session restore.
 * Keep the user signed in whenever a refresh token is still on device.
 * Only the login screen is shown when there is no persisted refresh token.
 */
export async function restoreSchoolSession(): Promise<{ route: AuthRoute }> {
  try {
    const refresh = await getRefreshToken();
    if (!refresh) {
      if (justDidPasswordLogin()) {
        const user = await getUser();
        return { route: destinationAfterAuth(user) };
      }
      return { route: '/login' };
    }

    if (await biometricEnrollmentChanged()) {
      await setBiometricLoginEnabled(false);
    }

    // Optional app lock only — not the same as "logged out".
    if ((await isAppLockEnabled()) && !justDidPasswordLogin()) {
      const cap = await biometricCapability();
      if (cap.available && (await isBiometricLoginEnabled())) {
        return { route: '/unlock' };
      }
    }

    const access = await getAccessToken();
    if (access && !accessTokenLooksExpired(access)) {
      const user = await getUser();
      return { route: homeFor(user) };
    }

    try {
      await refreshAccessToken();
      const user = await getUser();
      return { route: homeFor(user) };
    } catch (err) {
      if (err instanceof AccountDisabledError) return { route: '/account-disabled' };
      if (err instanceof DeviceBlockedError) return { route: '/device-blocked' };
      if (err instanceof SessionRevokedError) return { route: '/session-ended' };
      // Soft failure (offline / transient): stay signed in with stored session.
      if (err instanceof SessionExpiredError) {
        const still = await getRefreshToken().catch(() => null);
        if (!still) return { route: '/login' };
      }
      const user = await getUser();
      return { route: homeFor(user) };
    }
  } catch {
    const refresh = await getRefreshToken().catch(() => null);
    if (refresh || justDidPasswordLogin()) {
      const user = await getUser().catch(() => null);
      return { route: homeFor(user) };
    }
    return { route: '/login' };
  }
}
