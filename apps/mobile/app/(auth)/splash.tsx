import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { ensureDeviceId, hydrateAppType } from '@/api/config';
import { PremiumSplashScreen } from '@/components/auth/premium-splash-screen';
import { bootstrapSession } from '@/auth/bootstrap-session';
import { SPLASH_DURATION_MS } from '@/constants/release';
import { StatusBar } from 'expo-status-bar';
import * as ExpoSplashScreen from 'expo-splash-screen';

ExpoSplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function AuthSplashScreen() {
  const router = useRouter();

  useEffect(() => {
    void ExpoSplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        try {
          await hydrateAppType();
          await ensureDeviceId();
          const result = await bootstrapSession();
          // Initial push tap is handled once in root layout via consumeInitialPushResponse.
          if (!cancelled) {
            router.replace(result.href as never);
          }
        } catch {
          if (!cancelled) {
            router.replace('/(auth)/welcome');
          }
        }
      })();
    }, SPLASH_DURATION_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <>
      <StatusBar style="light" />
      <PremiumSplashScreen />
    </>
  );
}
