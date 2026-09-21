import { useEffect, useRef } from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAuthFailureHandler, setPasswordResetHandler } from '@/api/client';
import {
  getRefreshToken,
  getUser,
  isAppLockEnabled,
  isBiometricLoginEnabled,
} from '@/auth/session';
import { justDidPasswordLogin } from '@/auth/password-gate';
import { PASSWORD_PATH } from '@/auth/post-login';
import { destinationIfReauthNeeded } from '@/auth/reauth';
import { ExitAppDialog } from '@/components/exit-app-dialog';
import { useSchoolAndroidBack } from '@/navigation/use-android-back';
import {
  consumeNotificationResponse,
  takeNotificationDestination,
  wasOpenedFromNotificationRecently,
} from '@/services/notification-open';
import { resolveAppHref } from '@/services/notification-path';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const AUTH_HOLD = new Set([
  '/login',
  '/activate',
  '/forgot-password',
  '/auth-verify',
  '/auth-password',
  '/auth-success',
  '/unlock',
  '/account-disabled',
  '/session-ended',
  '/device-blocked',
  '/welcome',
  '/password',
]);

export default function RootLayout() {
  const router = useRouter();
  const path = usePathname();
  const segments = useSegments();
  const backgroundedAt = useRef(0);
  const pathRef = useRef(path);
  const segmentsRef = useRef(segments);
  pathRef.current = path;
  segmentsRef.current = segments;
  useSchoolAndroidBack();

  const onAuthHold = () => {
    const segs = segmentsRef.current;
    if (!segs.length) return true;
    if (segs[0] === '(tabs)') return false;
    const current = pathRef.current;
    if (AUTH_HOLD.has(current)) return true;
    return current === '/' || segs[0] === 'index';
  };

  useEffect(() => {
    setAuthFailureHandler((kind) => {
      if (kind === 'expired' && justDidPasswordLogin()) return;
      if (kind === 'disabled') router.replace('/account-disabled');
      else if (kind === 'blocked') router.replace('/device-blocked');
      else if (kind === 'revoked') router.replace('/session-ended');
      else {
        void destinationIfReauthNeeded().then((dest) => {
          if (dest === '/unlock') router.replace('/unlock');
          else if (dest === '/login') router.replace('/login');
        });
      }
    });
    setPasswordResetHandler(() => {
      router.replace(PASSWORD_PATH);
    });
    let sub: { remove: () => void } | undefined;
    void import('expo-notifications')
      .then((Notifications) => {
        sub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as Record<string, unknown>;
          void import('@/services/push').then(({ markNotificationOpened }) => {
            void markNotificationOpened(String(data?.notificationId || ''));
          });
          void consumeNotificationResponse(response).then((dest) => {
            if (!dest) return;
            if (/^https?:\/\//i.test(dest)) {
              takeNotificationDestination();
              void Linking.openURL(dest);
              return;
            }
            if (onAuthHold()) return;
            takeNotificationDestination();
            router.navigate(resolveAppHref(dest) as never);
          });
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
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active') return;
      const away = Date.now() - backgroundedAt.current;
      if (wasOpenedFromNotificationRecently()) return;
      if (AUTH_HOLD.has(path) || path === '/') return;
      void import('@/auth/token-refresh').then(
        ({
          AccountDisabledError,
          DeviceBlockedError,
          refreshAccessToken,
          SessionExpiredError,
          SessionRevokedError,
        }) => {
          void getRefreshToken().then((refresh) => {
            if (!refresh) return;
            void refreshAccessToken().catch((err) => {
              if (justDidPasswordLogin()) return;
              if (err instanceof AccountDisabledError) {
                router.replace('/account-disabled');
                return;
              }
              if (err instanceof DeviceBlockedError) {
                router.replace('/device-blocked');
                return;
              }
              if (err instanceof SessionRevokedError) {
                router.replace('/session-ended');
                return;
              }
              if (err instanceof SessionExpiredError) {
                void destinationIfReauthNeeded().then((dest) => {
                  if (dest === '/unlock') router.replace('/unlock');
                  else if (dest === '/login') router.replace('/login');
                });
              }
            });
          });
        },
      );
      if (!backgroundedAt.current || away < 8_000) return;
      void import('@/services/push').then(({ pingDeviceHeartbeat, registerSchoolPush }) => {
        void registerSchoolPush();
        void pingDeviceHeartbeat();
      });
      void Promise.all([isAppLockEnabled(), isBiometricLoginEnabled()]).then(([lock, bio]) => {
        if (justDidPasswordLogin()) return;
        if (lock && bio) router.replace('/unlock');
      });
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [path, router]);

  useEffect(() => {
    void getUser().then((user) => {
      if (!user?.mustResetPassword) return;
      if (
        path === PASSWORD_PATH ||
        path === '/login' ||
        path === '/' ||
        path === '/account-disabled' ||
        path === '/session-ended'
      ) {
        return;
      }
      router.replace(PASSWORD_PATH);
    });
  }, [path, router]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync('#ffffff');
  }, []);

  const splash = !path || path === '/';

  return (
    <SafeAreaProvider>
      <StatusBar
        style={splash ? 'light' : 'dark'}
        backgroundColor={splash ? '#0b2db8' : '#ffffff'}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationTypeForReplace: 'push',
          gestureEnabled: true,
          contentStyle: { backgroundColor: splash ? '#0b2db8' : '#ffffff' },
        }}
      >
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: '#0b2db8' } }} />
        <Stack.Screen
          name="login"
          options={{ contentStyle: { backgroundColor: '#ffffff' }, animation: 'fade' }}
        />
        <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
        <Stack.Screen
          name="password"
          options={{
            contentStyle: { backgroundColor: '#ffffff' },
            gestureEnabled: false,
            animationTypeForReplace: 'push',
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{ contentStyle: { backgroundColor: '#f4f6fb' }, animation: 'fade' }}
        />
        <Stack.Screen name="unlock" options={{ contentStyle: { backgroundColor: '#ffffff' } }} />
      </Stack>
      <ExitAppDialog />
    </SafeAreaProvider>
  );
}
