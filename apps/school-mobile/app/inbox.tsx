import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { Card, EmptyState, Feed, GoldButton, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type Item = {
  id: string;
  title: string;
  body: string;
  type: string;
  imageUrl?: string | null;
  readAt?: string | null;
  createdAt?: string;
};

function isPdf(url?: string | null) {
  return Boolean(url && /\.pdf($|\?)/i.test(url));
}

function InboxList({ title }: { title: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const load = async () => {
    try {
      const payload = await apiFetch<{ unreadCount: number; items: Item[] }>(
        '/v1/school-mobile/inbox',
      );
      setItems(payload.items ?? []);
      setUnread(payload.unreadCount ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = tab === 'unread' ? items.filter((i) => !i.readAt) : items;

  return (
    <Screen
      title={`${title}${unread ? ` · ${unread} unread` : ''}`}
      onBack={title === 'Notifications'}
      navy
    >
      <View style={styles.page}>
        <View style={styles.tabs}>
          {(['all', 'unread'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabOn]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
                {t === 'all' ? 'All' : 'Unread'}
              </Text>
            </Pressable>
          ))}
        </View>
        {error ? <EmptyState title="Unavailable" body={error} /> : null}
        {!error && !visible.length ? (
          <EmptyState title="You're all caught up" body="School alerts will appear here." />
        ) : null}
        <Feed>
          {items.length ? (
            <GoldButton
              label="Mark all as read"
              onPress={() => {
                void apiFetch('/v1/school-mobile/inbox/read-all', { method: 'POST' }).then(load);
              }}
            />
          ) : null}
          {visible.map((item) => {
            const attach = item.imageUrl ? mediaUrl(item.imageUrl) : '';
            const pdf = isPdf(attach);
            return (
              <Card key={item.id} onPress={() => router.push(`/inbox/${item.id}`)}>
                <View style={styles.row}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontWeight: item.readAt ? '600' : '800', color: colors.ink }}>
                      {item.readAt ? '' : '● '}
                      {item.title}
                    </Text>
                    <Text style={styles.body} numberOfLines={3}>
                      {item.body}
                    </Text>
                    {pdf ? <Text style={styles.attach}>📄 PDF attached</Text> : null}
                    {item.createdAt ? (
                      <Text style={styles.when}>
                        {new Date(item.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </Text>
                    ) : null}
                  </View>
                  {attach && !pdf ? <Image source={{ uri: attach }} style={styles.thumb} /> : null}
                </View>
              </Card>
            );
          })}
        </Feed>
      </View>
    </Screen>
  );
}

export default function InboxScreen() {
  return <InboxList title="Notifications" />;
}

export function MessagesInbox() {
  return <InboxList title="Messages" />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#eef3fb' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  tabOn: { backgroundColor: colors.navy },
  tabText: { color: '#334155', fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  body: { color: colors.muted, lineHeight: 20 },
  attach: { color: colors.navy, fontWeight: '800', fontSize: 12, marginTop: 4 },
  when: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#dbe4f5' },
});
