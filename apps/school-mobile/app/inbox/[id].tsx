import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { markNotificationOpened } from '@/services/push';
import { notificationPath } from '@/services/notification-path';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type Item = {
  id: string;
  title: string;
  body: string;
  type: string;
  imageUrl?: string | null;
  deepLink?: string | null;
  relatedId?: string | null;
  createdAt?: string;
};

function isPdf(url?: string | null) {
  return Boolean(url && /\.pdf($|\?)/i.test(url));
}

export default function InboxDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const row = await apiFetch<Item>(`/v1/school-mobile/inbox/${id}`);
      setItem(row);
      await apiFetch(`/v1/school-mobile/inbox/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      });
      void markNotificationOpened(row.relatedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notification unavailable');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!item && !error) {
    return (
      <Screen title="Notification" onBack navy>
        <Loader />
      </Screen>
    );
  }
  if (error || !item) {
    return (
      <Screen title="Notification" onBack navy>
        <EmptyState title="Notification unavailable" body={error ?? ''} />
      </Screen>
    );
  }

  const attach = item.imageUrl ? mediaUrl(item.imageUrl) : '';
  const pdf = isPdf(attach);
  const dest = notificationPath({
    deepLink: item.deepLink,
    type: item.type,
    relatedId: item.relatedId,
    attachmentUrl: attach,
    attachmentType: pdf ? 'pdf' : attach ? 'image' : '',
  });

  return (
    <Screen title="Notification" onBack navy>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>{item.type.replaceAll('_', ' ').toUpperCase()}</Text>
        <Text style={styles.title}>{item.title}</Text>
        {item.createdAt ? (
          <Text style={styles.when}>
            {new Date(item.createdAt).toLocaleString('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Text>
        ) : null}
        <Text style={styles.copy}>{item.body}</Text>
        {attach && !pdf ? (
          <Image source={{ uri: attach }} style={styles.image} resizeMode="cover" />
        ) : null}
        {pdf ? (
          <Pressable style={styles.pdf} onPress={() => void Linking.openURL(attach)}>
            <Text style={styles.pdfIcon}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pdfTitle}>PDF attachment</Text>
              <Text style={styles.pdfHint}>Tap to open</Text>
            </View>
          </Pressable>
        ) : null}
        {dest && dest !== '/inbox' && !/^https?:\/\//i.test(dest) ? (
          <Pressable style={styles.link} onPress={() => router.push(dest as never)}>
            <Text style={styles.linkText}>Open related page</Text>
          </Pressable>
        ) : null}
        {attach && /^https?:\/\//i.test(dest) && dest !== attach ? (
          <Pressable style={styles.link} onPress={() => void Linking.openURL(dest)}>
            <Text style={styles.linkText}>Open attachment</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 10, backgroundColor: '#eef3fb', paddingBottom: 40 },
  kicker: { color: colors.navy, fontWeight: '800', fontSize: 11, letterSpacing: 0.6 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  when: { color: colors.muted, fontWeight: '600' },
  copy: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  image: { width: '100%', height: 240, borderRadius: 18, backgroundColor: '#dbe4f5', marginTop: 8 },
  pdf: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  pdfIcon: { fontSize: 28 },
  pdfTitle: { fontWeight: '800', color: colors.ink },
  pdfHint: { color: colors.muted, marginTop: 2 },
  link: {
    backgroundColor: colors.navy,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: { color: '#fff', fontWeight: '800' },
});
