import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { apiFetch } from '@/api/client';
import { APP_VERSION } from '@/api/config';
import { restoreSchoolSession } from '@/auth/restore';
import { CREST, SCHOOL } from '@/brand';
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
          await SplashScreen.hideAsync().catch(() => undefined);
          return;
        }
      } catch {
        /* continue with local session */
      }
      if (cancelled) return;
      const restored = await restoreSchoolSession();
      if (cancelled) return;
      if (restored.route !== '/login' && restored.route !== '/account-disabled') {
        void import('@/services/push').then(({ registerSchoolPush }) => {
          void registerSchoolPush();
        });
      }
      router.replace(restored.route);
      await SplashScreen.hideAsync().catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <LinearGradient colors={['#0b1048', '#1a237e', '#24308f']} style={styles.fill}>
      <Image source={CREST} style={styles.crest} resizeMode="contain" />
      <Text style={styles.name}>{SCHOOL.legalName}</Text>
      <Text style={styles.place}>{SCHOOL.city}</Text>
      <View style={styles.ribbon}>
        <Text style={styles.ribbonText}>{SCHOOL.motto.toUpperCase()}</Text>
      </View>
      <Text style={styles.motto}>Shaping Brighter Futures</Text>
      <View style={styles.bar} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  crest: { width: 148, height: 148, marginBottom: 8 },
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
