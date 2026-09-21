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
import { destinationIfReauthNeeded } from '@/auth/reauth';
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

export async function restoreSchoolSession(): Promise<{ route: AuthRoute }> {
  try {
    const refresh = await getRefreshToken();
    if (!refresh) {
      if (justDidPasswordLogin()) {
        const user = await getUser();
        return { route: destinationAfterAuth(user) };
      }
      const reauth = await destinationIfReauthNeeded();
      return { route: reauth ?? '/login' };
    }

    if (await biometricEnrollmentChanged()) {
      await setBiometricLoginEnabled(false);
    }

    if (await isAppLockEnabled()) {
      if (justDidPasswordLogin()) {
        const user = await getUser();
        return { route: destinationAfterAuth(user, user?.firstLogin) };
      }
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
      if (err instanceof SessionExpiredError) {
        const reauth = await destinationIfReauthNeeded();
        if (reauth === '/unlock') return { route: '/unlock' };
        const user = await getUser();
        return { route: homeFor(user) };
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
    const reauth = await destinationIfReauthNeeded().catch(() => '/login' as const);
    return { route: reauth ?? '/login' };
  }
}
