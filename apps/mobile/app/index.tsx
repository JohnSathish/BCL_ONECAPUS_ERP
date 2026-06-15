import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBootstrap } from '@/hooks/useBootstrap';
import { getAccessToken } from '@/auth/session';
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
  const { config, loading } = useBootstrap();

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
      const token = await getAccessToken();
      if (!token) {
        router.replace('/(auth)/login');
        return;
      }
      router.replace('/(student)' as never);
    })();
  }, [loading, config, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
