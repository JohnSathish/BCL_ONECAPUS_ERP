import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { apiFetch } from '@/api/client';
import { APP_VERSION } from '@/api/config';
import { restoreSchoolSession } from '@/auth/restore';
import { captureLaunchNotification } from '@/services/notification-open';
import { HOME_PATH } from '@/services/notification-path';
import { LaunchSplash } from '@/screens/launch-splash';

const MIN_SPLASH_MS = 2400;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function GateScreen() {
  const router = useRouter();
  const painted = useRef(false);

  const hideNativeSplash = () => {
    if (painted.current) return;
    painted.current = true;
    void SplashScreen.hideAsync().catch(() => undefined);
  };

  useEffect(() => {
    let cancelled = false;
    const failsafe = setTimeout(hideNativeSplash, 2500);

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
          hideNativeSplash();
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
      let next: '/login' | '/welcome' | '/account-disabled' | typeof HOME_PATH | '/unlock' =
        '/login';
      try {
        const restored = await restoreSchoolSession();
        next = restored.route === HOME_PATH ? HOME_PATH : restored.route;
      } catch {
        next = '/login';
      }
      const remaining = MIN_SPLASH_MS - (Date.now() - started);
      if (remaining > 0) await wait(remaining);
      if (cancelled) return;
      hideNativeSplash();
      if (next === HOME_PATH) {
        router.replace('/home');
        return;
      }
      router.replace(next);
    })();
    return () => {
      cancelled = true;
      clearTimeout(failsafe);
    };
  }, [router]);

  return <LaunchSplash onReady={hideNativeSplash} />;
}
