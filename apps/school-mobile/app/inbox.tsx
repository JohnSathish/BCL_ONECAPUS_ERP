import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { apiFetch } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { EmptyState, Feed, Screen } from '@/ui/kit';
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

const IMPORTANT_TYPES = new Set([
  'EMERGENCY',
  'FEE',
  'EXAMINATION',
  'RESULT',
  'ATTENDANCE',
  'URGENT',
  'IMPORTANT',
]);

function isPdf(url?: string | null) {
  return Boolean(url && /\.pdf($|\?)/i.test(url));
}

function isImportant(item: Item) {
  const type = (item.type || '').toUpperCase();
  return IMPORTANT_TYPES.has(type) || type.includes('EMERGENCY') || type.includes('URGENT');
}

function tone(type: string) {
  const t = type.toUpperCase();
  if (t.includes('ANNOUNCE') || t.includes('NOTICE') || t === 'GENERAL') {
    return { bg: '#ece8ff', fg: '#6d28d9', icon: '📢' };
  }
  if (t.includes('FEE') || t.includes('DOCUMENT') || t.includes('RESULT') || t.includes('EXAM')) {
    return { bg: '#fde8ef', fg: '#e11d48', icon: '📄' };
  }
  if (t.includes('MESSAGE') || t.includes('HOMEWORK') || t.includes('MEETING')) {
    return { bg: '#dcfce7', fg: '#16a34a', icon: '💬' };
  }
  if (t.includes('ATTEND') || t.includes('TRANSPORT') || t.includes('EMERGENCY')) {
    return { bg: '#fee2e2', fg: '#dc2626', icon: '⚠️' };
  }
  return { bg: '#dbeafe', fg: '#1d4ed8', icon: '🔔' };
}

function formatWhen(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function InboxList({ title }: { title: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'unread' | 'important'>('all');
  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);

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

  const counts = useMemo(
    () => ({
      all: items.length,
      unread: items.filter((i) => !i.readAt).length,
      important: items.filter(isImportant).length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (tab === 'unread' && item.readAt) return false;
      if (tab === 'important' && !isImportant(item)) return false;
      if (!q) return true;
      return `${item.title} ${item.body} ${item.type}`.toLowerCase().includes(q);
    });
  }, [items, tab, query]);

  const menuItem = items.find((row) => row.id === menuId) ?? null;

  const openDetails = (id: string) => {
    setMenuId(null);
    router.push(`/inbox/${id}`);
  };

  const shareItem = async (item: Item) => {
    setMenuId(null);
    await Share.share({
      title: item.title,
      message: `${item.title}\n\n${item.body}`.trim(),
    });
  };

  const deleteItem = (item: Item) => {
    setMenuId(null);
    Alert.alert('Delete notification?', 'This removes it from your inbox. It cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void apiFetch(`/v1/school-mobile/inbox/${item.id}`, { method: 'DELETE' })
            .then(load)
            .catch((err) =>
              Alert.alert('Could not delete', err instanceof Error ? err.message : 'Try again'),
            );
        },
      },
    ]);
  };

  return (
    <Screen navy>
      <LinearGradient colors={['#1a237e', '#283593']} style={styles.hero}>
        <View style={styles.heroRow}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.heroBtn}>
            <Text style={styles.heroBack}>‹</Text>
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSub}>
              {unread ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'You are up to date'}
            </Text>
          </View>
          <View style={styles.bellWrap}>
            <Text style={styles.bell}>🔔</Text>
            {unread ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </LinearGradient>

      <View style={styles.page}>
        <View style={styles.tabs}>
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'unread', label: `Unread (${counts.unread})`, dot: counts.unread > 0 },
              { id: 'important', label: `Important (${counts.important})` },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[styles.tab, tab === t.id && styles.tabOn]}
            >
              <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
              {'dot' in t && t.dot ? <View style={styles.tabDot} /> : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.search}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notifications..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
        </View>

        {items.length > 0 && unread > 0 ? (
          <Pressable
            style={styles.markAll}
            onPress={() => {
              void apiFetch('/v1/school-mobile/inbox/read-all', { method: 'POST' }).then(load);
            }}
          >
            <Text style={styles.markAllText}>✓ Mark all as read</Text>
          </Pressable>
        ) : null}

        {error ? <EmptyState title="Unavailable" body={error} /> : null}

        <Feed>
          {visible.map((item) => {
            const attach = item.imageUrl ? mediaUrl(item.imageUrl) : '';
            const pdf = isPdf(attach);
            const look = tone(item.type);
            return (
              <View key={item.id} style={styles.card}>
                <Pressable style={styles.cardBody} onPress={() => openDetails(item.id)}>
                  <View style={[styles.icon, { backgroundColor: look.bg }]}>
                    <Text style={{ fontSize: 18 }}>{look.icon}</Text>
                    {!item.readAt ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={[styles.cardTitle, !item.readAt && styles.cardTitleUnread]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text style={styles.cardBodyText} numberOfLines={2}>
                      {item.body}
                    </Text>
                    <Text style={styles.when}>🕒 {formatWhen(item.createdAt)}</Text>
                  </View>
                  {attach && !pdf ? <Image source={{ uri: attach }} style={styles.thumb} /> : null}
                </Pressable>
                <Pressable hitSlop={10} style={styles.more} onPress={() => setMenuId(item.id)}>
                  <Text style={styles.moreText}>⋮</Text>
                </Pressable>
              </View>
            );
          })}

          {!error && !visible.length ? (
            <EmptyState
              title={tab === 'unread' ? 'No unread messages' : 'You’re all caught up'}
              body="School alerts will appear here."
            />
          ) : null}

          {!error ? (
            <View style={styles.footerCard}>
              <View style={styles.footerIcon}>
                <Text style={{ fontSize: 18 }}>🔔</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.footerTitle}>That’s all</Text>
                <Text style={styles.footerBody}>
                  You’re up to date! New notifications will appear here.
                </Text>
              </View>
            </View>
          ) : null}
        </Feed>
      </View>

      <Modal
        visible={Boolean(menuItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuId(null)}
      >
        <Pressable style={styles.menuScrim} onPress={() => setMenuId(null)}>
          <View style={styles.menu}>
            <Pressable style={styles.menuRow} onPress={() => menuItem && openDetails(menuItem.id)}>
              <Text style={styles.menuIcon}>👁</Text>
              <Text style={styles.menuLabel}>View Details</Text>
            </Pressable>
            <Pressable style={styles.menuRow} onPress={() => menuItem && deleteItem(menuItem)}>
              <Text style={styles.menuIcon}>🗑</Text>
              <Text style={[styles.menuLabel, { color: colors.danger }]}>Delete Notification</Text>
            </Pressable>
            <Pressable style={styles.menuRow} onPress={() => menuItem && void shareItem(menuItem)}>
              <Text style={styles.menuIcon}>📤</Text>
              <Text style={styles.menuLabel}>Share</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  hero: { paddingHorizontal: 12, paddingBottom: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  heroBack: { color: '#fff', fontSize: 32, marginTop: -4 },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.78)', fontWeight: '600', marginTop: 2 },
  bellWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bell: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  page: { flex: 1, backgroundColor: '#eef3fb' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  tabOn: { backgroundColor: colors.navy },
  tabText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: '#fff' },
  tabDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  search: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15, paddingVertical: 0 },
  markAll: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  markAllText: { color: colors.navyDeep, fontWeight: '800' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#1a237e',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardBody: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cardTitle: { fontWeight: '700', color: colors.ink, fontSize: 16 },
  cardTitleUnread: { fontWeight: '800' },
  cardBodyText: { color: colors.muted, lineHeight: 20 },
  when: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#dbe4f5' },
  more: { paddingLeft: 6, paddingTop: 2 },
  moreText: { fontSize: 22, color: '#94a3b8', fontWeight: '800' },
  footerCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  footerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerTitle: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  footerBody: { color: colors.muted, marginTop: 2, lineHeight: 20 },
  menuScrim: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.18)',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuIcon: { fontSize: 16, width: 22 },
  menuLabel: { fontWeight: '700', color: colors.ink, fontSize: 15 },
});
