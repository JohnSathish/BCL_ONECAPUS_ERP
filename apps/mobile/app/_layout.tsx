import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthFailureRedirect } from '@/hooks/useAuthFailureRedirect';
import {
  attachPushResponseListener,
  consumeInitialPushResponse,
  detachPushResponseListener,
  ensureAndroidDefaultChannel,
  refreshPushRegistrationIfLoggedIn,
  requestPushPermissions,
} from '@/services/push-notifications';

ExpoSplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  useAuthFailureRedirect();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Fail-safe: never leave users on the native splash forever if a later screen hangs.
    const failsafe = setTimeout(() => {
      void ExpoSplashScreen.hideAsync().catch(() => undefined);
    }, 8000);

    try {
      void ensureAndroidDefaultChannel();
      void requestPushPermissions();
      attachPushResponseListener();
      void consumeInitialPushResponse();
      void refreshPushRegistrationIfLoggedIn();
    } catch (err) {
      console.warn('[root] push bootstrap failed', err);
    }

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        void refreshPushRegistrationIfLoggedIn();
      }
      appState.current = next;
    });

    return () => {
      clearTimeout(failsafe);
      sub.remove();
      detachPushResponseListener();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(staff)" />
      </Stack>
    </SafeAreaProvider>
  );
}
