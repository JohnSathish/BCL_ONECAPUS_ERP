import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { apiFetch } from '@/api/client';
import { APP_VERSION } from '@/api/config';
import { restoreSchoolSession, type AuthRoute } from '@/auth/restore';
import { captureLaunchNotification, replaceWithNotificationOr } from '@/services/notification-open';
import { isHomePath } from '@/services/notification-path';
import { LaunchSplash } from '@/screens/launch-splash';

const MIN_SPLASH_MS = 2200;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function restoreOrLogin(): Promise<{ route: AuthRoute }> {
  try {
    return await restoreSchoolSession();
  } catch {
    return { route: '/login' };
  }
}

export default function GateScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void SplashScreen.hideAsync().catch(() => undefined);

    (async () => {
      const started = Date.now();
      try {
        const boot = await apiFetch<{
          forceUpdate?: boolean;
          maintenanceMode?: boolean;
          androidStoreUrl?: string | null;
          iosStoreUrl?: string | null;
          releaseNotes?: string | null;
        }>(`/v1/school-mobile/bootstrap?appVersion=${APP_VERSION}`, { skipAuth: true });
        if (cancelled) return;
        if (boot.forceUpdate || boot.maintenanceMode) {
          router.replace({
            pathname: '/update',
            params: {
              notes: boot.releaseNotes ?? '',
              store: boot.androidStoreUrl ?? boot.iosStoreUrl ?? '',
              maintenance: boot.maintenanceMode ? '1' : '0',
            },
          });
          return;
        }
      } catch {
        /* continue with local session */
      }
      if (cancelled) return;
      await captureLaunchNotification();
      const restored = await restoreOrLogin();
      const remaining = MIN_SPLASH_MS - (Date.now() - started);
      if (remaining > 0) await wait(remaining);
      if (cancelled) return;
      if (restored.route !== '/login' && restored.route !== '/account-disabled') {
        void import('@/services/push').then(({ registerSchoolPush }) => {
          void registerSchoolPush();
        });
      }
      if (isHomePath(restored.route)) {
        replaceWithNotificationOr(router);
      } else {
        router.replace(restored.route);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <LaunchSplash />;
}
