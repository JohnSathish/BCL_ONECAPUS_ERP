import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { markNotificationOpened, notificationPath } from '@/services/push';
import { Card, EmptyState, Feed, GoldButton, Screen } from '@/ui/kit';

type Item = {
  id: string;
  title: string;
  body: string;
  type: string;
  deepLink?: string | null;
  relatedId?: string | null;
  readAt?: string | null;
  createdAt?: string;
};

export default function InboxScreen() {
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
      setItems(payload.items);
      setUnread(payload.unreadCount);
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
    <Screen title={`Notifications${unread ? ` · ${unread} unread` : ''}`} onBack>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {(['all', 'unread'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: tab === t ? '#1e3a8a' : '#e8eef7',
            }}
          >
            <Text style={{ color: tab === t ? '#fff' : '#334155', fontWeight: '700' }}>
              {t === 'all' ? 'All' : 'Unread'}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <EmptyState title="Notifications unavailable" body={error} /> : null}
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
        {visible.map((item) => (
          <Card
            key={item.id}
            onPress={() => {
              void apiFetch(`/v1/school-mobile/inbox/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ read: true }),
              });
              void markNotificationOpened(item.relatedId);
              router.push(
                notificationPath({
                  deepLink: item.deepLink,
                  type: item.type,
                  relatedId: item.relatedId,
                }) as never,
              );
            }}
          >
            <Text style={{ fontWeight: item.readAt ? '600' : '800' }}>
              {item.readAt ? '○ ' : '● '}
              {item.title}
            </Text>
            <Text style={{ color: '#5b6573' }}>{item.body}</Text>
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}
