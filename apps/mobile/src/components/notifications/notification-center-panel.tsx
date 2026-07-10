import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  archiveNotification,
  dismissNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationFilter,
} from '@/services/notifications';
import {
  resolveMobileDeepLink,
  fallbackNotificationCenter,
} from '@/services/notification-deep-link';
import { trackPushOpened } from '@/services/push-notifications';
import type { UserNotification } from '@/types/notifications';

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

type ThemeColors = {
  primary: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle?: string;
  urgent?: string;
};

const FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'archived', label: 'Archived' },
];

export function NotificationCenterPanel({
  role,
  theme,
  onChanged,
}: {
  role: 'student' | 'staff';
  theme: ThemeColors;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, count] = await Promise.all([fetchNotifications(60, filter), fetchUnreadCount()]);
      setItems(list);
      setUnread(count.count);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.body ?? '').toLowerCase().includes(q) ||
        (n.type ?? '').toLowerCase().includes(q),
    );
  }, [items, query]);

  async function onOpen(item: UserNotification) {
    if (!item.readAt && filter !== 'archived') {
      try {
        await markNotificationRead(item.id);
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
        );
        setUnread((c) => Math.max(0, c - 1));
        onChanged?.();
      } catch {
        // keep UI responsive
      }
    }
    void trackPushOpened(item.link ?? undefined);
    const href = resolveMobileDeepLink(item.link);
    if (href) router.push(href as never);
  }

  async function onMarkAll() {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnread(0);
      onChanged?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not mark all as read');
    }
  }

  async function onArchive(id: string) {
    try {
      await archiveNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      onChanged?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not archive');
    }
  }

  async function onDismiss(id: string) {
    try {
      await dismissNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      onChanged?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not delete');
    }
  }

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.muted, { color: theme.textMuted }]}>Loading notifications…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              style={[
                styles.chip,
                {
                  borderColor: theme.border,
                  backgroundColor: active ? `${theme.primary}18` : theme.surface,
                },
              ]}
              onPress={() => setFilter(f.id)}
            >
              <Text
                style={{
                  color: active ? theme.primary : theme.textMuted,
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {f.label}
                {f.id === 'unread' && unread > 0 ? ` (${unread})` : ''}
              </Text>
            </Pressable>
          );
        })}
        {unread > 0 && filter !== 'archived' ? (
          <Pressable onPress={() => void onMarkAll()} style={styles.markAll}>
            <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>Mark all</Text>
          </Pressable>
        ) : null}
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search notifications…"
        placeholderTextColor={theme.textSubtle ?? theme.textMuted}
        style={[
          styles.search,
          { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text },
        ]}
      />

      {message ? (
        <Text style={{ color: theme.urgent ?? '#DC2626', fontSize: 13 }}>{message}</Text>
      ) : null}

      {visible.length === 0 ? (
        <Text style={[styles.muted, { color: theme.textMuted }]}>No notifications found.</Text>
      ) : (
        visible.map((item) => {
          const isUnread = !item.readAt;
          const category =
            item.metadata && typeof item.metadata === 'object'
              ? String((item.metadata as Record<string, unknown>).category ?? '')
              : '';
          return (
            <View
              key={item.id}
              style={[
                styles.card,
                {
                  borderColor: isUnread ? '#BFDBFE' : theme.border,
                  backgroundColor: isUnread ? '#F8FBFF' : theme.surface,
                },
              ]}
            >
              <Pressable onPress={() => void onOpen(item)}>
                <View style={styles.cardTop}>
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {isUnread ? (
                    <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                  ) : null}
                </View>
                {item.body ? (
                  <Text style={[styles.body, { color: theme.textMuted }]} numberOfLines={3}>
                    {item.body}
                  </Text>
                ) : null}
                <Text style={[styles.when, { color: theme.textSubtle ?? theme.textMuted }]}>
                  {formatWhen(item.createdAt)}
                  {category ? ` · ${category}` : ''}
                  {item.type ? ` · ${item.type}` : ''}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                {filter !== 'archived' ? (
                  <Pressable onPress={() => void onArchive(item.id)}>
                    <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>
                      Archive
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => void onDismiss(item.id)}>
                  <Text
                    style={{ color: theme.urgent ?? '#DC2626', fontWeight: '700', fontSize: 12 }}
                  >
                    Delete
                  </Text>
                </Pressable>
                {item.link ? (
                  <Pressable
                    onPress={() => {
                      const href =
                        resolveMobileDeepLink(item.link) ?? fallbackNotificationCenter(role);
                      router.push(href as never);
                    }}
                  >
                    <Text style={{ color: theme.textMuted, fontWeight: '700', fontSize: 12 }}>
                      Open
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  container: { padding: 16, gap: 10, paddingBottom: 32 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAll: { marginLeft: 'auto', paddingHorizontal: 4 },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 18 },
  when: { fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 2 },
  muted: { fontSize: 13 },
});
