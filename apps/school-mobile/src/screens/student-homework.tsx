import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { apiFetch } from '@/api/client';
import { getActiveChild } from '@/auth/session';
import {
  formatHomeworkDay,
  openHomeworkAttachment,
  stripHtml,
  type HomeworkItem,
} from '@/homework/api';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';
import { registerSchoolPush } from '@/services/push';

type FilterKey = 'all' | 'active' | 'pending' | 'completed';

function statusOf(row: HomeworkItem): FilterKey {
  const s = row.listStatus;
  if (s === 'pending' || s === 'completed' || s === 'active') return s;
  return 'active';
}

function badgeFor(status: FilterKey) {
  switch (status) {
    case 'pending':
      return { bg: '#ffedd5', ink: '#c2410c', label: 'Due soon' };
    case 'completed':
      return { bg: '#e2e8f0', ink: '#475569', label: 'Completed' };
    default:
      return { bg: '#dcfce7', ink: '#15803d', label: 'Active' };
  }
}

export function StudentHomeworkScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const openId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [items, setItems] = useState<HomeworkItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<HomeworkItem | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      void registerSchoolPush();
      const childId = await getActiveChild();
      const q = childId ? `?childId=${encodeURIComponent(childId)}` : '';
      const data = await apiFetch<{ items?: HomeworkItem[] }>(
        `/v1/school-mobile/homework/mine${q}`,
      );
      const rows = Array.isArray(data.items) ? data.items : [];
      setItems(rows);
      if (openId) {
        const match = rows.find((row) => row.id === openId);
        if (match) setSelected(match);
      }
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Could not load homework.');
    }
  }, [openId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const counts = useMemo(() => {
    const rows = items ?? [];
    return {
      all: rows.length,
      active: rows.filter((r) => statusOf(r) === 'active').length,
      pending: rows.filter((r) => statusOf(r) === 'pending').length,
      completed: rows.filter((r) => statusOf(r) === 'completed').length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((row) => {
      if (filter !== 'all' && statusOf(row) !== filter) return false;
      if (!q) return true;
      const hay =
        `${row.title} ${row.subjectName} ${row.classLabel ?? ''} ${stripHtml(row.body)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, query]);

  const openFile = async (row: HomeworkItem, fileId: string) => {
    const file = row.files?.find((f) => f.id === fileId);
    if (!file) return;
    setOpeningId(file.id);
    try {
      const childId = await getActiveChild();
      await openHomeworkAttachment(row.id, file, childId);
    } catch (err) {
      Alert.alert(
        'Attachment',
        err instanceof Error ? err.message : 'Could not open the attachment.',
      );
    } finally {
      setOpeningId(null);
    }
  };

  if (items == null) {
    return (
      <Screen title="Homework" onBack>
        <Loader />
      </Screen>
    );
  }

  const pills: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <Screen
      title="Homework"
      onBack
      action={
        <Pressable onPress={() => setShowFilters((v) => !v)} hitSlop={10} style={styles.filterHit}>
          <Text style={styles.filterIcon}>▾</Text>
        </Pressable>
      }
    >
      <View style={styles.pillsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}
        >
          {pills.map((pill) => {
            const on = filter === pill.key;
            return (
              <Pressable
                key={pill.key}
                onPress={() => setFilter(pill.key)}
                style={[styles.pill, on && styles.pillOn]}
              >
                <Text style={[styles.pillTxt, on && styles.pillTxtOn]}>
                  {pill.label} ({pill.count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search homework..."
          placeholderTextColor="#94a3b8"
          style={styles.search}
        />
      </View>

      {showFilters ? (
        <View style={styles.filterHint}>
          <Text style={styles.filterHintTxt}>
            Showing {filter === 'all' ? 'all' : filter} homework
            {query.trim() ? ` matching “${query.trim()}”` : ''}
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.pad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            tintColor={colors.navy}
          />
        }
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!filtered.length ? (
          <EmptyState
            title="No homework right now"
            body="When teachers assign homework for your class, it will show here with any attached files."
          />
        ) : (
          filtered.map((row) => {
            const status = statusOf(row);
            const tone = badgeFor(status);
            return (
              <Pressable key={row.id} style={styles.card} onPress={() => setSelected(row)}>
                <View style={styles.cardTop}>
                  <View style={styles.bookIcon}>
                    <Text style={{ fontSize: 18 }}>📖</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subject}>{row.subjectName}</Text>
                    <Text style={styles.classLabel}>{row.classLabel || 'Class'}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.badgeDot, { color: tone.ink }]}>●</Text>
                    <Text style={[styles.badgeTxt, { color: tone.ink }]}>{tone.label}</Text>
                  </View>
                </View>

                <Text style={styles.title}>{row.title}</Text>
                {row.body ? (
                  <Text style={styles.preview} numberOfLines={2}>
                    {stripHtml(row.body)}
                  </Text>
                ) : null}

                <View style={styles.strip}>
                  <View style={styles.calIcon}>
                    <Text>📅</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stripLabel}>Due Date</Text>
                    <Text style={styles.stripValue}>{formatHomeworkDay(row.dueDate)}</Text>
                  </View>
                  <Text style={styles.chev}>›</Text>
                </View>

                <View style={styles.strip}>
                  <View style={[styles.calIcon, styles.docIcon]}>
                    <Text>📄</Text>
                  </View>
                  <Text style={styles.readTxt}>
                    {row.files?.length
                      ? `Tap to read · ${row.files.length} file${row.files.length === 1 ? '' : 's'}`
                      : 'Tap to read full homework'}
                  </Text>
                  <Text style={styles.chev}>›</Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={Boolean(selected)}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <Screen
          title="Homework"
          light
          action={
            <Pressable onPress={() => setSelected(null)} hitSlop={8}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          }
        >
          {selected ? (
            <ScrollView contentContainerStyle={styles.detailPad}>
              <View style={styles.cardTop}>
                <View style={styles.bookIcon}>
                  <Text style={{ fontSize: 18 }}>📖</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subject}>{selected.subjectName}</Text>
                  <Text style={styles.classLabel}>{selected.classLabel || 'Class'}</Text>
                </View>
              </View>
              <Text style={styles.detailTitle}>{selected.title}</Text>
              <View style={styles.strip}>
                <View style={styles.calIcon}>
                  <Text>📅</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stripLabel}>Due Date</Text>
                  <Text style={styles.stripValue}>{formatHomeworkDay(selected.dueDate)}</Text>
                </View>
              </View>
              {selected.assignDate ? (
                <Text style={styles.assigned}>
                  Assigned {formatHomeworkDay(selected.assignDate)}
                </Text>
              ) : null}
              <Text style={styles.sectionLabel}>Instructions</Text>
              <Text style={styles.detailBody}>
                {stripHtml(selected.body) || 'No extra instructions were added.'}
              </Text>
              <Text style={styles.sectionLabel}>Attachments</Text>
              {selected.files?.length ? (
                selected.files.map((file) => (
                  <Pressable
                    key={file.id}
                    style={styles.fileChip}
                    onPress={() => void openFile(selected, file.id)}
                    disabled={openingId === file.id}
                  >
                    <Text style={styles.fileText} numberOfLines={2}>
                      {openingId === file.id ? 'Opening…' : `📎 ${file.fileName}`}
                    </Text>
                    <Text style={styles.openLink}>Open</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.classLabel}>No files attached.</Text>
              )}
            </ScrollView>
          ) : null}
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pillsWrap: { paddingLeft: space.md, marginBottom: 8 },
  pills: { gap: 8, paddingRight: space.md },
  pill: {
    backgroundColor: '#e8eefc',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillOn: { backgroundColor: '#2563eb' },
  pillTxt: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  pillTxtOn: { color: '#fff' },
  searchWrap: {
    marginHorizontal: space.md,
    marginBottom: 8,
    backgroundColor: '#eef2ff',
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  searchIcon: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  search: { flex: 1, paddingVertical: 12, color: colors.ink, fontWeight: '600' },
  filterHit: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  filterIcon: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  filterHint: { paddingHorizontal: space.md, marginBottom: 4 },
  filterHintTxt: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  pad: { padding: space.md, gap: 12, paddingBottom: space.xl },
  detailPad: { padding: space.md, gap: 10, paddingBottom: space.xl },
  error: { color: colors.danger },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8eef8',
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subject: { color: colors.navy, fontWeight: '800', fontSize: 15 },
  classLabel: { color: colors.muted, fontWeight: '600', fontSize: 12, marginTop: 1 },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeDot: { fontSize: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink },
  preview: { color: colors.muted, lineHeight: 19 },
  strip: {
    backgroundColor: '#eff4ff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ffe4e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIcon: { backgroundColor: '#dbeafe' },
  stripLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  stripValue: { color: colors.navy, fontWeight: '800', fontSize: 14 },
  readTxt: { flex: 1, color: colors.navy, fontWeight: '700', fontSize: 13 },
  chev: { color: colors.navy, fontSize: 22, fontWeight: '300' },
  close: { color: colors.navy, fontWeight: '800' },
  detailTitle: { fontSize: 24, fontWeight: '800', color: colors.ink },
  assigned: { color: colors.muted, fontWeight: '600' },
  sectionLabel: {
    marginTop: 8,
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  detailBody: { color: colors.ink, lineHeight: 22, fontSize: 15 },
  fileChip: {
    backgroundColor: '#eef2ff',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileText: { color: colors.navy, fontWeight: '700', fontSize: 14, flex: 1 },
  openLink: { color: colors.navy, fontWeight: '800' },
});
