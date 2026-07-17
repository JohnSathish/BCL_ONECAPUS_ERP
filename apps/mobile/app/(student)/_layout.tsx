import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StudentDrawer } from '@/components/student-portal/student-drawer';
import { StudentPortalProvider } from '@/components/student-portal/student-portal-context';
import { CHANGE_PASSWORD_HREF, getMustResetPassword } from '@/auth/password-reset-guard';
import { getAccessToken, getRefreshToken } from '@/auth/session';
import { SyncGuardProvider } from '@/state/sync-guard';

export default function StudentLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [access, refresh] = await Promise.all([getAccessToken(), getRefreshToken()]);
      if (!access && !refresh) {
        router.replace('/(auth)/login');
        return;
      }
      if (await getMustResetPassword()) {
        router.replace(CHANGE_PASSWORD_HREF);
        return;
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Prevent leaving the portal while a forced reset may still be pending.
      return false;
    });
    return () => sub.remove();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SyncGuardProvider>
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
          <Stack.Screen name="syllabus" />
          <Stack.Screen name="complete-profile" />
          <Stack.Screen name="registration-web" />
          <Stack.Screen name="feedback" />
          <Stack.Screen name="certificates" />
          <Stack.Screen name="department-activities" />
          <Stack.Screen name="campus-competitions" />
          <Stack.Screen name="notification-preferences" />
          <Stack.Screen name="about" />
          <Stack.Screen name="account-deletion" />
        </Stack>
      </StudentPortalProvider>
    </SyncGuardProvider>
  );
}
