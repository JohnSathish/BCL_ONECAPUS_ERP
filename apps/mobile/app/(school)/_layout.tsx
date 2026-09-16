import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { fetchSchoolBootstrap } from '@/api/school-mobile';
import { schoolQueryClient } from '@/api/query-client';
import { hasSchoolMobileAccess } from '@/auth/role-router';
import { getAccessToken, getUserSnapshot } from '@/auth/session';
import { useSchoolSession } from '@/store/school-session';

export default function SchoolLayout() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const setFeatures = useSchoolSession((s) => s.setFeatures);
  const setPermissions = useSchoolSession((s) => s.setPermissions);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getAccessToken();
      const user = await getUserSnapshot();
      if (!token || !user || !hasSchoolMobileAccess(user)) {
        router.replace('/(auth)/login');
        return;
      }
      setPermissions(user.permissions ?? []);
      try {
        const boot = await fetchSchoolBootstrap();
        const features = (boot.features ?? {}) as Record<string, boolean>;
        setFeatures(features);
      } catch {
        // keep defaults
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, setFeatures, setPermissions]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <QueryClientProvider client={schoolQueryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="attendance" />
        <Stack.Screen name="timetable" />
        <Stack.Screen name="exams" />
        <Stack.Screen name="library" />
        <Stack.Screen name="transport" />
        <Stack.Screen name="hr" />
        <Stack.Screen name="notices" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="take-attendance" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="id-card" />
        <Stack.Screen name="homework" />
        <Stack.Screen name="leave" />
        <Stack.Screen name="reports" />
        <Stack.Screen name="documents" />
        <Stack.Screen name="payroll" />
      </Stack>
    </QueryClientProvider>
  );
}
