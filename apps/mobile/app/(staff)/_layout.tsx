import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { FacultyDrawer } from '@/components/faculty-portal/faculty-drawer';
import { FacultyPortalProvider } from '@/components/faculty-portal/faculty-portal-context';
import { CHANGE_PASSWORD_HREF, getMustResetPassword } from '@/auth/password-reset-guard';
import { getAccessToken, getRefreshToken } from '@/auth/session';

export default function StaffLayout() {
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

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FacultyPortalProvider>
      <FacultyDrawer />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="mark-attendance/[sessionId]" />
        <Stack.Screen name="timetable" />
        <Stack.Screen name="marks/index" />
        <Stack.Screen name="marks/[paperId]" />
        <Stack.Screen name="class-roster/[sectionId]" />
        <Stack.Screen name="leave" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="teaching-load" />
        <Stack.Screen name="notices" />
        <Stack.Screen name="payroll" />
        <Stack.Screen name="notification-preferences" />
        <Stack.Screen name="about" />
        <Stack.Screen name="account-deletion" />
      </Stack>
    </FacultyPortalProvider>
  );
}
