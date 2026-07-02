import { useEffect } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ensureDeviceId, hydrateAppType } from '@/api/config';
import { useBootstrap } from '@/hooks/useBootstrap';
import { getAccessToken, getUserSnapshot } from '@/auth/session';
import { resolveMobileRoute } from '@/auth/role-router';
import { APP_VERSION } from '@/api/client';

function versionBelow(current: string, minimum: string) {
  const pa = current.split('.').map(Number);
  const pb = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const a = pa[i] ?? 0;
    const b = pb[i] ?? 0;
    if (a !== b) return a < b;
  }
  return false;
}

export default function IndexScreen() {
  const router = useRouter();
  const { config, loading, error, retry } = useBootstrap();

  useEffect(() => {
    if (loading || !config) return;
    if (config.maintenanceMode) {
      router.replace('/(auth)/maintenance');
      return;
    }
    if (config.forceUpdate && versionBelow(APP_VERSION, config.minVersion)) {
      router.replace('/(auth)/maintenance');
      return;
    }
    (async () => {
      await hydrateAppType();
      await ensureDeviceId();
      const token = await getAccessToken();
      if (!token) {
        router.replace('/(auth)/splash');
        return;
      }
      try {
        const snapshot = await getUserSnapshot();
        if (snapshot) {
          const route = resolveMobileRoute(snapshot);
          router.replace(route.href as never);
          return;
        }
        router.replace('/(student)/(tabs)' as never);
      } catch {
        router.replace('/(auth)/splash');
      }
    })();
  }, [loading, config, router]);

  if (!loading && error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Could not connect</Text>
        <Text style={styles.message}>
          Check your internet connection and that the college server is reachable.
        </Text>
        <Text style={styles.detail}>{error}</Text>
        <Button title="Try again" onPress={retry} />
        <View style={styles.spacer} />
        <Button title="Continue to sign in" onPress={() => router.replace('/(auth)/splash')} />
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#0f3c89" />
      <Text style={styles.loadingText}>Starting OneCampus…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  title: { fontSize: 20, fontWeight: '600' },
  message: { fontSize: 14, color: '#4b5563', textAlign: 'center' },
  detail: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },
  loadingText: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  spacer: { height: 8 },
});
