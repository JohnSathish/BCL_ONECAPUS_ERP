import type { Href } from 'expo-router';
import { ensureDeviceId, hydrateAppType, setAppType } from '@/api/config';
import { CHANGE_PASSWORD_HREF, userMustResetPassword } from '@/auth/password-reset-guard';
import { resolveMobileRoute } from '@/auth/role-router';
import {
  ensureSchoolConfigFromEnv,
  getSchoolConfig,
  hydrateSchoolConfig,
} from '@/auth/school-config';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getUserSnapshot,
  saveAppType,
  saveUserSnapshot,
} from '@/auth/session';
import { isNetworkRefreshError, refreshAccessToken } from '@/auth/token-refresh';

export type BootstrapResult = {
  href: Href;
  reason?: 'session_expired' | 'offline_cached' | 'must_reset_password';
};

/**
 * Cold-start session validation: school → silent refresh → dashboard.
 * Offline with cached tokens keeps the user in the portal.
 * Users with mustResetPassword are always sent to change-password.
 */
export async function bootstrapSession(): Promise<BootstrapResult> {
  await hydrateSchoolConfig();
  await ensureSchoolConfigFromEnv();
  await hydrateAppType();
  await ensureDeviceId();

  const school = await getSchoolConfig();
  if (!school) {
    return { href: '/(auth)/select-school' as Href };
  }

  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return { href: '/(auth)/welcome' as Href };
  }

  try {
    const session = await refreshAccessToken();
    if (session.user) {
      await saveUserSnapshot(session.user);
      if (userMustResetPassword(session.user)) {
        return { href: CHANGE_PASSWORD_HREF, reason: 'must_reset_password' };
      }
      const route = resolveMobileRoute(session.user);
      setAppType(route.appType);
      await saveAppType(route.appType);
      return { href: route.href };
    }

    const snapshot = await getUserSnapshot();
    if (snapshot) {
      if (userMustResetPassword(snapshot)) {
        return { href: CHANGE_PASSWORD_HREF, reason: 'must_reset_password' };
      }
      const route = resolveMobileRoute(snapshot);
      setAppType(route.appType);
      await saveAppType(route.appType);
      return { href: route.href };
    }

    await clearSession();
    return {
      href: '/(auth)/login?reason=session_expired' as Href,
      reason: 'session_expired',
    };
  } catch (err) {
    if (isNetworkRefreshError(err)) {
      const access = await getAccessToken();
      const snapshot = await getUserSnapshot();
      if (access && snapshot) {
        if (userMustResetPassword(snapshot)) {
          return { href: CHANGE_PASSWORD_HREF, reason: 'must_reset_password' };
        }
        const route = resolveMobileRoute(snapshot);
        setAppType(route.appType);
        return { href: route.href, reason: 'offline_cached' };
      }
    }

    await clearSession();
    return {
      href: '/(auth)/login?reason=session_expired' as Href,
      reason: 'session_expired',
    };
  }
}
