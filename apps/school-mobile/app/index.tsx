import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { apiFetch } from '@/api/client';
import { APP_VERSION } from '@/api/config';
import { getAccessToken } from '@/auth/session';
import { colors } from '@/theme/tokens';

export default function GateScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const boot = await apiFetch<{
          forceUpdate?: boolean;
          maintenanceMode?: boolean;
          updateAvailable?: boolean;
          androidStoreUrl?: string | null;
          iosStoreUrl?: string | null;
          releaseNotes?: string | null;
        }>(`/v1/school-mobile/bootstrap?appVersion=${APP_VERSION}`, { skipAuth: true });
        if (cancelled) return;
        if (boot.forceUpdate || boot.maintenanceMode) {
          router.replace({
            pathname: '/update',
            params: {
              notes: boot.releaseNotes ?? '',
              store: boot.androidStoreUrl ?? boot.iosStoreUrl ?? '',
              maintenance: boot.maintenanceMode ? '1' : '0',
            },
          });
          return;
        }
        const token = await getAccessToken();
        router.replace(token ? '/(tabs)' : '/login');
      } catch {
        const token = await getAccessToken();
        router.replace(token ? '/(tabs)' : '/login');
      } finally {
        await SplashScreen.hideAsync().catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <LinearGradient colors={[colors.navyDeep, colors.navy]} style={styles.fill}>
      <Image source={require('../assets/icon.png')} style={styles.crest} />
      <Text style={styles.name}>St. Luke's School</Text>
      <Text style={styles.motto}>Knowledge · Service · Light</Text>
      <View style={styles.bar} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  crest: { width: 120, height: 120, borderRadius: 28 },
  name: { color: '#fff', fontSize: 26, fontWeight: '800' },
  motto: { color: colors.gold, letterSpacing: 1.2, fontWeight: '600' },
  bar: { width: 64, height: 4, backgroundColor: colors.gold, borderRadius: 2, marginTop: 8 },
});
