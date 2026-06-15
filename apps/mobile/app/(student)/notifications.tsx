import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications';
import type { UserNotification } from '@/types/notifications';

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function StudentNotificationsScreen() {
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([fetchNotifications(), fetchUnreadCount()]);
      setItems(list);
      setUnread(count.count);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onOpen = async (item: UserNotification) => {
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id);
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
        );
        setUnread((c) => Math.max(0, c - 1));
      } catch {
        // keep UI responsive even if mark-read fails
      }
    }
  };

  const onMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not mark all as read');
    }
  };

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading notifications…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {unread > 0 ? `${unread} unread` : 'You are all caught up'}
          </Text>
        </View>
        {unread > 0 ? (
          <Pressable style={styles.markAllBtn} onPress={() => void onMarkAll()}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : null}
      </View>

      {message ? <Text style={styles.error}>{message}</Text> : null}

      {items.length === 0 ? (
        <Text style={styles.muted}>No notifications yet.</Text>
      ) : (
        items.map((item) => {
          const isUnread = !item.readAt;
          return (
            <Pressable
              key={item.id}
              style={[styles.card, isUnread && styles.cardUnread]}
              onPress={() => void onOpen(item)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {isUnread ? <View style={styles.dot} /> : null}
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardMeta}>{formatWhen(item.createdAt)}</Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  section: { fontWeight: '600' },
  muted: { fontSize: 13, color: '#6b7280' },
  error: { color: '#dc2626', fontSize: 14 },
  markAllBtn: {
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eff6ff',
  },
  markAllText: { color: '#1d4ed8', fontWeight: '600', fontSize: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#fff',
    gap: 6,
  },
  cardUnread: { borderColor: '#93c5fd', backgroundColor: '#f8fafc' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  cardBody: { fontSize: 14, color: '#374151' },
  cardMeta: { fontSize: 12, color: '#9ca3af' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' },
});
