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
  refreshAccessToken,
  SessionExpiredError,
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
  | typeof PASSWORD_PATH;

export async function routeAfterPasswordLogin(
  user?: { mustResetPassword?: boolean; firstLogin?: boolean } | null,
  firstLogin?: boolean,
) {
  return destinationAfterAuth(user, firstLogin ?? user?.firstLogin);
}

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
      return { route: destinationAfterAuth(user, user?.firstLogin) };
    }

    try {
      await refreshAccessToken();
      const user = await getUser();
      return { route: destinationAfterAuth(user, user?.firstLogin) };
    } catch (err) {
      if (err instanceof AccountDisabledError) {
        return { route: '/account-disabled' };
      }
      if (err instanceof SessionExpiredError) {
        return { route: '/login' };
      }
      const offline = err instanceof Error && err.message.toLowerCase().includes('offline');
      if (offline && refresh) {
        const user = await getUser();
        return { route: destinationAfterAuth(user, user?.firstLogin) };
      }
      return { route: '/login' };
    }
  } catch {
    return { route: '/login' };
  }
}
