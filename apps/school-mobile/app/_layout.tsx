import { useEffect, useRef } from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAuthFailureHandler } from '@/api/client';
import { isAppLockEnabled, isBiometricLoginEnabled } from '@/auth/session';
import { notificationPath } from '@/services/notification-path';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const OPEN_ROUTES = new Set([
  '/login',
  '/activate',
  '/forgot-password',
  '/auth-verify',
  '/auth-password',
  '/auth-success',
  '/unlock',
  '/account-disabled',
  '/biometric-setup',
  '/',
]);

export default function RootLayout() {
  const router = useRouter();
  const path = usePathname();
  const backgroundedAt = useRef(0);

  useEffect(() => {
    setAuthFailureHandler((kind) => {
      router.replace(kind === 'disabled' ? '/account-disabled' : '/login');
    });
    let sub: { remove: () => void } | undefined;
    void import('expo-notifications')
      .then((Notifications) => {
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as Record<string, unknown>;
          void import('@/services/push').then(({ markNotificationOpened }) => {
            void markNotificationOpened(String(data?.notificationId || ''));
          });
          const dest = notificationPath(data);
          if (/^https?:\/\//i.test(dest)) {
            void Linking.openURL(dest);
            return;
          }
          router.push(dest as never);
        });
      })
      .catch(() => undefined);
    const failsafe = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 6000);
    return () => {
      sub?.remove();
      clearTimeout(failsafe);
    };
  }, [router]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active') return;
      const away = Date.now() - backgroundedAt.current;
      if (!backgroundedAt.current || away < 8_000) return;
      if (OPEN_ROUTES.has(path)) return;
      void Promise.all([isAppLockEnabled(), isBiometricLoginEnabled()]).then(([lock, bio]) => {
        if (lock && bio) router.replace('/unlock');
      });
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [path, router]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="activate" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="auth-verify" />
        <Stack.Screen name="auth-password" />
        <Stack.Screen name="auth-success" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="biometric-setup" />
        <Stack.Screen name="unlock" />
        <Stack.Screen name="account-disabled" />
        <Stack.Screen name="password" />
        <Stack.Screen name="security" />
        <Stack.Screen name="update" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notice/[slug]" />
        <Stack.Screen name="event/[slug]" />
        <Stack.Screen name="gallery/[slug]" />
        <Stack.Screen name="page/[slug]" />
        <Stack.Screen name="prayer" />
        <Stack.Screen name="inbox" />
        <Stack.Screen name="inbox/[id]" />
        <Stack.Screen name="media-view" />
        <Stack.Screen name="timetable" />
        <Stack.Screen name="fees" />
        <Stack.Screen name="fees-history" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="profile-personal" />
        <Stack.Screen name="profile-guardians" />
        <Stack.Screen name="academics" />
        <Stack.Screen name="homework" />
        <Stack.Screen name="leave" />
        <Stack.Screen name="lesson-plan" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="school" />
        <Stack.Screen name="feedback" />
        <Stack.Screen name="examinations" />
        <Stack.Screen name="study-material" />
        <Stack.Screen name="lunch" />
        <Stack.Screen name="transport" />
        <Stack.Screen name="stationery" />
        <Stack.Screen name="app-info" />
      </Stack>
    </SafeAreaProvider>
  );
}
