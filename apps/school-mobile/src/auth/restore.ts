import {
  accessTokenLooksExpired,
  getAccessToken,
  getRefreshToken,
  getUser,
  isAppLockEnabled,
  isBiometricLoginEnabled,
  setBiometricLoginEnabled,
  wasBiometricPrompted,
} from '@/auth/session';
import { biometricCapability, biometricEnrollmentChanged } from '@/auth/biometric';
import {
  AccountDisabledError,
  refreshAccessToken,
  SessionExpiredError,
} from '@/auth/token-refresh';
import { HOME_PATH } from '@/services/notification-path';

export type AuthRoute =
  | typeof HOME_PATH
  | '/welcome'
  | '/login'
  | '/unlock'
  | '/account-disabled'
  | '/biometric-setup';

export async function routeAfterPasswordLogin(firstLogin?: boolean) {
  if (firstLogin) return '/welcome' as const;
  const cap = await biometricCapability();
  if (cap.available && !(await isBiometricLoginEnabled()) && !(await wasBiometricPrompted())) {
    return '/biometric-setup' as const;
  }
  return HOME_PATH;
}

export async function restoreSchoolSession(): Promise<{ route: AuthRoute }> {
  try {
    const refresh = await getRefreshToken();
    if (!refresh) return { route: '/login' };

    if (await biometricEnrollmentChanged()) {
      await setBiometricLoginEnabled(false);
    }

    if (await isAppLockEnabled()) {
      const cap = await biometricCapability();
      if (cap.available && (await isBiometricLoginEnabled())) {
        return { route: '/unlock' };
      }
    }

    const access = await getAccessToken();
    if (access && !accessTokenLooksExpired(access)) {
      const user = await getUser();
      return { route: user?.firstLogin ? '/welcome' : HOME_PATH };
    }

    try {
      await refreshAccessToken();
      const user = await getUser();
      return { route: user?.firstLogin ? '/welcome' : HOME_PATH };
    } catch (err) {
      if (err instanceof AccountDisabledError) {
        return { route: '/account-disabled' };
      }
      if (err instanceof SessionExpiredError) {
        return { route: '/login' };
      }
      const offline = err instanceof Error && err.message.toLowerCase().includes('offline');
      if (offline && refresh) {
        return { route: HOME_PATH };
      }
      return { route: '/login' };
    }
  } catch {
    return { route: '/login' };
  }
}
