import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthFailureRedirect } from '@/hooks/useAuthFailureRedirect';
import {
  attachPushResponseListener,
  detachPushResponseListener,
  refreshPushRegistrationIfLoggedIn,
} from '@/services/push-notifications';

export default function RootLayout() {
  useAuthFailureRedirect();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    attachPushResponseListener();
    void refreshPushRegistrationIfLoggedIn();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        void refreshPushRegistrationIfLoggedIn();
      }
      appState.current = next;
    });

    return () => {
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
