import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useNavigation, usePathname, useRouter, useSegments } from 'expo-router';
import { getUser } from '@/auth/session';
import { isBiometricPromptBusy } from '@/auth/biometric';
import { PASSWORD_PATH } from '@/auth/post-login';
import {
  dismissAppExitConfirm,
  isAppExitConfirmOpen,
  requestAppExitConfirm,
} from '@/components/exit-app-dialog';

const AUTH_ROOT = new Set([
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
]);

function isHomeScreen(path: string, segments: string[]) {
  if (path === '/home') return true;
  if (segments[0] === '(tabs)' && (segments[1] === 'home' || segments.length === 1)) {
    return true;
  }
  return false;
}

/**
 * Android system Back: pop the in-app stack, switch other tabs to Home,
 * and only offer Exit when already on Home. Never dumps the user to login.
 */
export function useSchoolAndroidBack() {
  const navigation = useNavigation();
  const router = useRouter();
  const path = usePathname();
  const segments = useSegments();
  const pathRef = useRef(path);
  const segmentsRef = useRef(segments);
  const exitOpen = useRef(false);
  const mustResetRef = useRef(false);
  pathRef.current = path;
  segmentsRef.current = segments;

  useEffect(() => {
    void getUser().then((user) => {
      mustResetRef.current = Boolean(user?.mustResetPassword);
    });
  }, [path]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isBiometricPromptBusy()) return false;
      if (isAppExitConfirmOpen()) {
        dismissAppExitConfirm();
        return true;
      }
      const current = pathRef.current;
      if (!current || current === '/') return true;
      const segs = segmentsRef.current as string[];
      const onHome = isHomeScreen(current, segs);
      const onAuth = AUTH_ROOT.has(current);
      const canGoBack = navigation.canGoBack();

      if (mustResetRef.current) {
        if (current !== PASSWORD_PATH) {
          router.replace(PASSWORD_PATH);
          return true;
        }
        if (exitOpen.current || isAppExitConfirmOpen()) return true;
        exitOpen.current = true;
        requestAppExitConfirm();
        setTimeout(() => {
          exitOpen.current = false;
        }, 400);
        return true;
      }

      if (onHome) {
        if (exitOpen.current || isAppExitConfirmOpen()) return true;
        exitOpen.current = true;
        requestAppExitConfirm();
        setTimeout(() => {
          exitOpen.current = false;
        }, 400);
        return true;
      }

      if (canGoBack) {
        router.back();
        return true;
      }

      if (segs[0] === '(tabs)' && !onHome) {
        router.navigate('/home');
        return true;
      }

      if (onAuth) {
        if (current === '/login' || current === '/unlock') {
          BackHandler.exitApp();
          return true;
        }
        router.replace('/login');
        return true;
      }

      router.navigate('/home');
      return true;
    });
    return () => sub.remove();
  }, [navigation, router]);
}
