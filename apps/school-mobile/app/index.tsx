import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { apiFetch } from '@/api/client';
import { APP_VERSION } from '@/api/config';
import { getAccessToken, getUser } from '@/auth/session';
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
        const user = await getUser();
        if (token && user?.mustResetPassword) {
          router.replace('/password');
        } else {
          router.replace(token ? '/(tabs)' : '/login');
        }
      } catch {
        const token = await getAccessToken();
        const user = await getUser();
        if (token && user?.mustResetPassword) {
          router.replace('/password');
        } else {
          router.replace(token ? '/(tabs)' : '/login');
        }
      } finally {
        await SplashScreen.hideAsync().catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <LinearGradient colors={['#0b1048', '#1a237e', '#24308f']} style={styles.fill}>
      <Image source={require('../assets/icon.png')} style={styles.crest} />
      <Text style={styles.name}>St. Luke's Secondary School</Text>
      <Text style={styles.place}>Tura, Meghalaya</Text>
      <View style={styles.ribbon}>
        <Text style={styles.ribbonText}>ENLIGHTEN · EMPOWER · SERVE</Text>
      </View>
      <Text style={styles.motto}>Shaping Brighter Futures</Text>
      <View style={styles.bar} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  crest: { width: 128, height: 128, borderRadius: 64, marginBottom: 8 },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  place: { color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  ribbon: {
    marginTop: 8,
    backgroundColor: colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ribbonText: { color: colors.navyDeep, fontWeight: '800', fontSize: 11, letterSpacing: 0.6 },
  motto: { color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', marginTop: 12 },
  bar: { width: 72, height: 4, backgroundColor: colors.gold, borderRadius: 2, marginTop: 16 },
});
