import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, usePathname, useRouter, type Href } from 'expo-router';
import { CHANGE_PASSWORD_HREF, getMustResetPassword } from '@/auth/password-reset-guard';
import { getAccessToken, getRefreshToken, getUserSnapshot } from '@/auth/session';
import { PrincipalDrawerProvider } from '@/components/principal-portal/principal-drawer-context';
import { PrincipalDrawer } from '@/components/principal-portal/principal-drawer';
import { fetchPrincipalMobileSummary } from '@/services/principal-desk';

export default function PrincipalLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [badges, setBadges] = useState<{ leavePending?: number; unreadEmails?: number }>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [access, refresh, snapshot] = await Promise.all([
        getAccessToken(),
        getRefreshToken(),
        getUserSnapshot(),
      ]);
      if (!access && !refresh) {
        router.replace('/(auth)/login' as Href);
        return;
      }
      if (await getMustResetPassword()) {
        router.replace(CHANGE_PASSWORD_HREF);
        return;
      }
      const perms = snapshot?.permissions ?? [];
      if (!perms.includes('principal-mobile:access')) {
        router.replace('/(auth)/login' as Href);
        return;
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const summary = await fetchPrincipalMobileSummary();
        if (cancelled) return;
        setBadges({
          leavePending: summary.overview?.pendingApprovals ?? 0,
          unreadEmails: summary.overview?.unreadEmails ?? summary.mail?.unread ?? 0,
        });
      } catch {
        /* ignore badge refresh errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, pathname]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <PrincipalDrawerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="mail/[id]" />
        <Stack.Screen name="compose" />
        <Stack.Screen name="leave/[id]" />
        <Stack.Screen name="student-lookup" />
        <Stack.Screen name="module/[slug]" />
      </Stack>
      <PrincipalDrawer badges={badges} showOptionalCampus />
    </PrincipalDrawerProvider>
  );
}
