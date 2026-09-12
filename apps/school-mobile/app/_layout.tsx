import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAuthFailureHandler } from '@/api/client';
import { clearSession } from '@/auth/session';
import { notificationPath } from '@/services/push';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    setAuthFailureHandler(() => {
      void clearSession();
      router.replace('/login');
    });
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      router.push(notificationPath(data) as never);
    });
    const failsafe = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => undefined);
    }, 6000);
    return () => {
      sub.remove();
      clearTimeout(failsafe);
    };
  }, [router]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="password" />
        <Stack.Screen name="update" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notice/[slug]" />
        <Stack.Screen name="event/[slug]" />
        <Stack.Screen name="gallery/[slug]" />
        <Stack.Screen name="page/[slug]" />
        <Stack.Screen name="prayer" />
        <Stack.Screen name="inbox" />
        <Stack.Screen name="timetable" />
        <Stack.Screen name="fees" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="academics" />
        <Stack.Screen name="homework" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="school" />
        <Stack.Screen name="feedback" />
        <Stack.Screen name="app-info" />
      </Stack>
    </SafeAreaProvider>
  );
}
