import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { notificationPath } from '@/services/push';
import { Card, EmptyState, Feed, GoldButton, Screen } from '@/ui/kit';

type Item = {
  id: string;
  title: string;
  body: string;
  type: string;
  deepLink?: string | null;
  relatedId?: string | null;
  readAt?: string | null;
};

export default function InboxScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Screen title={`Notifications${unread ? ` · ${unread} unread` : ''}`}>
      {error ? <EmptyState title="Notifications unavailable" body={error} /> : null}
      {!error && !items.length ? (
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
        {items.map((item) => (
          <Card
            key={item.id}
            onPress={() => {
              void apiFetch(`/v1/school-mobile/inbox/${item.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ read: true }),
              });
              router.push(
                notificationPath({
                  deepLink: item.deepLink,
                  type: item.type,
                  relatedId: item.relatedId,
                }) as never,
              );
            }}
          >
            <Text style={{ fontWeight: item.readAt ? '600' : '800' }}>{item.title}</Text>
            <Text style={{ color: '#5b6573' }}>{item.body}</Text>
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}
