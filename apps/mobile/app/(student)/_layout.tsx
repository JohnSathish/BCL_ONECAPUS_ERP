import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StudentDrawer } from '@/components/student-portal/student-drawer';
import { StudentPortalProvider } from '@/components/student-portal/student-portal-context';
import { getAccessToken, getRefreshToken } from '@/auth/session';

export default function StudentLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [access, refresh] = await Promise.all([getAccessToken(), getRefreshToken()]);
      if (!access && !refresh) {
        router.replace('/(auth)/login');
        return;
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <StudentPortalProvider>
      <StudentDrawer />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="timetable" />
        <Stack.Screen name="exam-schedule" />
        <Stack.Screen name="examination-fees" />
        <Stack.Screen name="results" />
        <Stack.Screen name="leave" />
        <Stack.Screen name="library" />
        <Stack.Screen name="assignments" />
        <Stack.Screen name="complete-profile" />
        <Stack.Screen name="notification-preferences" />
        <Stack.Screen name="about" />
      </Stack>
    </StudentPortalProvider>
  );
}
