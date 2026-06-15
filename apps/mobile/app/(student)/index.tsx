import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { useMobileConfig } from '@/hooks/useMobileConfig';
import { formatInr } from '@/utils/currency';

const CARD_ROUTES: Record<string, string> = {
  attendance: '/(student)/attendance' as const,
  fees: '/(student)/fees' as const,
  notifications: '/(student)/notifications' as const,
};

const CARD_LABELS: Record<string, string> = {
  attendance: 'Attendance',
  fees: 'Fees',
  timetable: 'Timetable',
  results: 'Results',
  library: 'Library',
  hostel: 'Hostel',
  notifications: 'Notifications',
  lms: 'LMS',
  examinations: 'Examinations',
};

export default function StudentHomeScreen() {
  const router = useRouter();
  const { cards } = useMobileConfig();
  const [home, setHome] = useState<{
    profile?: { displayFullName?: string };
    fees?: { due?: number; status?: string };
    unreadNotificationCount?: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<typeof home>('/v1/mobile-app/student/home');
        setHome(data);
      } catch {
        // home stats are optional; cards still render from config
      }
    })();
  }, []);

  const enabled = Object.entries(cards)
    .filter(([, on]) => on)
    .map(([key]) => key);

  const feeDue = home?.fees?.due ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Student Home</Text>
      <Text style={styles.subtitle}>{home?.profile?.displayFullName ?? 'Welcome'}</Text>

      {feeDue > 0 ? (
        <Pressable style={styles.feeBanner} onPress={() => router.push('/(student)/fees')}>
          <Text style={styles.feeBannerText}>Fee due: {formatInr(feeDue)}</Text>
          <Text style={styles.feeBannerLink}>Pay now →</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>Quick access</Text>
      {enabled.map((card) => {
        const route = CARD_ROUTES[card];
        const label = CARD_LABELS[card] ?? card;
        return (
          <Pressable
            key={card}
            style={[styles.card, route && styles.cardActive]}
            disabled={!route}
            onPress={() => route && router.push(route as never)}
          >
            <Text style={styles.cardTitle}>{label}</Text>
            {route ? (
              <Text style={styles.cardHint}>Tap to open</Text>
            ) : (
              <Text style={styles.cardStub}>Coming in a later Phase 2 slice</Text>
            )}
          </Pressable>
        );
      })}

      {(home?.unreadNotificationCount ?? 0) > 0 ? (
        <Pressable
          style={styles.notifBanner}
          onPress={() => router.push('/(student)/notifications' as never)}
        >
          <Text style={styles.notifBannerText}>
            {home?.unreadNotificationCount} unread notifications
          </Text>
          <Text style={styles.feeBannerLink}>Open inbox →</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  subtitle: { fontSize: 16, color: '#374151' },
  section: { fontWeight: '600', marginTop: 8 },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#f9fafb',
  },
  cardActive: { backgroundColor: '#fff', borderColor: '#93c5fd' },
  cardTitle: { fontSize: 16, fontWeight: '600', textTransform: 'capitalize' },
  cardHint: { fontSize: 12, color: '#2563eb', marginTop: 4 },
  cardStub: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  feeBanner: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeBannerText: { fontWeight: '600', color: '#92400e' },
  feeBannerLink: { color: '#1d4ed8', fontWeight: '600' },
  muted: { fontSize: 13, color: '#6b7280' },
  notifBanner: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notifBannerText: { fontWeight: '600', color: '#1e3a8a' },
});
