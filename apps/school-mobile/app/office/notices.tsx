import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { colors } from '@/theme/tokens';
import { OfficeShell, RowCard } from '@/ui/office-shell';

type Notice = {
  slug: string;
  title: string;
  publishedAt?: string | null;
  category?: string | null;
};
type Broadcast = { id: string; title: string; createdAt: string; audience: string };

export default function OfficeNotices() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      apiFetch<{ notices: Notice[]; broadcasts: Broadcast[] }>(
        '/v1/school-mobile/principal/notices',
      )
        .then((data) => {
          setNotices(data.notices ?? []);
          setBroadcasts(data.broadcasts ?? []);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <OfficeShell
      title="Notices & Circulars"
      subtitle="What the school family is reading"
      loading={loading}
      error={error}
      action={
        <Pressable onPress={() => router.push('/office/announcements')}>
          <Text style={styles.link}>Announce</Text>
        </Pressable>
      }
    >
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Need a same-day circular?</Text>
        <Text style={styles.bannerBody}>
          Send it as an announcement. It lands in the school app inbox even without a lock-screen
          banner.
        </Text>
      </View>
      <Text style={styles.section}>Website circulars</Text>
      {notices.map((row) => (
        <RowCard
          key={row.slug}
          title={row.title}
          meta={
            row.publishedAt
              ? new Date(row.publishedAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : row.category || 'Notice'
          }
          onPress={() => router.push(`/notice/${row.slug}`)}
        />
      ))}
      {!notices.length ? <Text style={styles.empty}>No published circulars yet.</Text> : null}
      <Text style={styles.section}>App announcements</Text>
      {broadcasts.map((row) => (
        <RowCard
          key={row.id}
          title={row.title}
          meta={`${row.audience} · ${new Date(row.createdAt).toLocaleDateString('en-IN')}`}
        />
      ))}
    </OfficeShell>
  );
}

const styles = StyleSheet.create({
  link: { color: '#fff', fontWeight: '700' },
  banner: { backgroundColor: '#eef2ff', borderRadius: 18, padding: 14 },
  bannerTitle: { fontWeight: '800', color: colors.navy },
  bannerBody: { color: colors.muted, marginTop: 4, lineHeight: 18 },
  section: { fontWeight: '800', color: colors.ink, marginTop: 6 },
  empty: { color: colors.muted },
});
