import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  fetchMyQuestionPapers,
  fetchSavedQuestionPapers,
  isQuestionPaperOnDevice,
  openQuestionPaper,
  saveQuestionPaper,
  unsaveQuestionPaper,
  type QuestionPaper,
} from '@/services/question-papers';

const PAGE_SIZE = 30;
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Tab = 'all' | 'saved';

function humanize(value?: string | null) {
  if (!value) return null;
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatBytes(bytes?: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function examLabel(paper: QuestionPaper) {
  return [paper.examMonth ? MONTHS[paper.examMonth - 1] : null, paper.examYear ?? null]
    .filter(Boolean)
    .join(' ');
}

function groupBySemester(items: QuestionPaper[]) {
  const groups = new Map<string, QuestionPaper[]>();
  for (const paper of items) {
    const key = paper.semesterNo != null ? `Semester ${paper.semesterNo}` : 'Other papers';
    const list = groups.get(key) ?? [];
    list.push(paper);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === 'Other papers') return 1;
    if (b === 'Other papers') return -1;
    return Number(b.replace(/\D/g, '')) - Number(a.replace(/\D/g, ''));
  });
}

export default function StudentQuestionPapersScreen() {
  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<QuestionPaper[]>([]);
  const [saved, setSaved] = useState<QuestionPaper[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [onDevice, setOnDevice] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [semester, setSemester] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const savedIds = useMemo(() => new Set(saved.map((p) => p.id)), [saved]);

  const markOnDevice = useCallback(async (papers: QuestionPaper[]) => {
    const entries = await Promise.all(
      papers.map(async (p) => [p.id, await isQuestionPaperOnDevice(p).catch(() => false)] as const),
    );
    setOnDevice((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  const loadSaved = useCallback(async () => {
    try {
      const rows = await fetchSavedQuestionPapers();
      setSaved(Array.isArray(rows) ? rows : []);
      void markOnDevice(Array.isArray(rows) ? rows : []);
    } catch {
      setSaved([]);
    }
  }, [markOnDevice]);

  const load = useCallback(async () => {
    try {
      const res = await fetchMyQuestionPapers({
        q: query,
        semesterNo: semester,
        page: 1,
        limit: PAGE_SIZE,
      });
      const rows = res.items ?? [];
      setItems(rows);
      setTotal(res.total ?? 0);
      setPage(1);
      void markOnDevice(rows);
    } catch (e) {
      Alert.alert(
        'Could not load question papers',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  }, [query, semester, markOnDevice]);

  useEffect(() => {
    setLoading(true);
    void Promise.all([load(), loadSaved()]).finally(() => setLoading(false));
  }, [load, loadSaved]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), loadSaved()]);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetchMyQuestionPapers({
        q: query,
        semesterNo: semester,
        page: next,
        limit: PAGE_SIZE,
      });
      const rows = res.items ?? [];
      setItems((prev) => [...prev, ...rows]);
      setTotal(res.total ?? 0);
      setPage(next);
      void markOnDevice(rows);
    } catch (e) {
      Alert.alert('Could not load more', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const onOpen = async (paper: QuestionPaper) => {
    setBusyId(paper.id);
    try {
      await openQuestionPaper(paper);
      setOnDevice((prev) => ({ ...prev, [paper.id]: true }));
    } catch (e) {
      Alert.alert('Unable to open', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusyId(null);
    }
  };

  const onToggleSave = async (paper: QuestionPaper) => {
    const wasSaved = savedIds.has(paper.id);
    setSaved((prev) => (wasSaved ? prev.filter((p) => p.id !== paper.id) : [paper, ...prev]));
    try {
      if (wasSaved) await unsaveQuestionPaper(paper.id);
      else await saveQuestionPaper(paper.id);
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again');
      void loadSaved();
    }
  };

  const visibleSaved = useMemo(() => {
    const q = query.trim().toLowerCase();
    return saved.filter(
      (p) =>
        (!semester || p.semesterNo === semester) &&
        (!q || `${p.paperCode} ${p.paperName}`.toLowerCase().includes(q)),
    );
  }, [saved, query, semester]);

  const list = tab === 'all' ? items : visibleSaved;
  const groups = useMemo(() => groupBySemester(list), [list]);
  const filtered = Boolean(query.trim() || semester);

  return (
    <StudentScreenShell title="Question Papers" subtitle="Previous year papers">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={studentTheme.primary}
          />
        }
      >
        <LinearGradient
          colors={[studentTheme.primary, studentTheme.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>📝</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Previous Question Papers</Text>
            <Text style={styles.heroBody}>
              Practise with papers from your registered subjects. Open once and they stay on your
              phone.
            </Text>
          </View>
          <View style={styles.heroStats}>
            <Stat value={loading ? '–' : String(total)} label="Papers" />
            <View style={styles.heroDivider} />
            <Stat value={loading ? '–' : String(saved.length)} label="Saved" />
          </View>
        </LinearGradient>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by paper code or name"
            placeholderTextColor={studentTheme.textSubtle}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {search ? (
            <Pressable hitSlop={10} onPress={() => setSearch('')}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.segment}>
          <SegmentButton label="All papers" active={tab === 'all'} onPress={() => setTab('all')} />
          <SegmentButton
            label={`Saved${saved.length ? ` (${saved.length})` : ''}`}
            active={tab === 'saved'}
            onPress={() => setTab('saved')}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="All semesters" active={semester == null} onPress={() => setSemester(null)} />
          {SEMESTERS.map((s) => (
            <Chip
              key={s}
              label={`Sem ${s}`}
              active={semester === s}
              onPress={() => setSemester(s)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </View>
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{tab === 'saved' ? '⭐' : '📚'}</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'saved'
                ? 'No saved papers yet'
                : filtered
                  ? 'No papers match your filters'
                  : 'No question papers yet'}
            </Text>
            <Text style={styles.emptyBody}>
              {tab === 'saved'
                ? 'Tap the star on any paper to keep it here for quick revision.'
                : filtered
                  ? 'Try another search term or semester.'
                  : 'Papers published by your department for your subjects will appear here automatically.'}
            </Text>
            {filtered ? (
              <Pressable
                style={styles.resetBtn}
                onPress={() => {
                  setSearch('');
                  setSemester(null);
                }}
              >
                <Text style={styles.resetText}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.list}>
            {groups.map(([heading, papers]) => (
              <View key={heading} style={styles.group}>
                <View style={styles.groupHead}>
                  <Text style={styles.groupTitle}>{heading}</Text>
                  <Text style={styles.groupCount}>
                    {papers.length} paper{papers.length === 1 ? '' : 's'}
                  </Text>
                </View>
                {papers.map((paper) => (
                  <PaperCard
                    key={paper.id}
                    paper={paper}
                    busy={busyId === paper.id}
                    saved={savedIds.has(paper.id)}
                    onDevice={Boolean(onDevice[paper.id])}
                    onOpen={() => void onOpen(paper)}
                    onToggleSave={() => void onToggleSave(paper)}
                  />
                ))}
              </View>
            ))}
            {tab === 'all' && items.length < total ? (
              <Pressable
                style={styles.moreBtn}
                disabled={loadingMore}
                onPress={() => void loadMore()}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={studentTheme.primary} />
                ) : (
                  <Text style={styles.moreText}>Show more papers</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

function PaperCard({
  paper,
  busy,
  saved,
  onDevice,
  onOpen,
  onToggleSave,
}: {
  paper: QuestionPaper;
  busy: boolean;
  saved: boolean;
  onDevice: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const exam = examLabel(paper);
  const type = humanize(paper.examinationType);
  const category = humanize(paper.subjectCategory);
  const size = formatBytes(paper.fileSizeBytes);
  const context = [paper.programmeName, paper.departmentName].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onOpen}
      disabled={busy}
    >
      <View style={styles.cardTop}>
        <View style={styles.pdfTile}>
          <Text style={styles.pdfTileText}>PDF</Text>
          {exam ? <Text style={styles.pdfTileYear}>{paper.examYear ?? ''}</Text> : null}
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.code}>{paper.paperCode}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {paper.paperName}
          </Text>
          {context ? (
            <Text style={styles.context} numberOfLines={1}>
              {context}
            </Text>
          ) : null}
        </View>
        <Pressable
          hitSlop={12}
          onPress={onToggleSave}
          accessibilityLabel={saved ? 'Remove from saved' : 'Save paper'}
        >
          <Text style={[styles.star, saved && styles.starOn]}>{saved ? '★' : '☆'}</Text>
        </Pressable>
      </View>

      <View style={styles.badges}>
        {exam ? <Badge label={exam} tone="blue" /> : null}
        {type ? <Badge label={type} tone="teal" /> : null}
        {category ? <Badge label={category} tone="slate" /> : null}
      </View>

      <View style={styles.cardFoot}>
        <Text style={styles.footMeta}>
          {onDevice ? '✓ On this phone' : size ? `${size} download` : 'Tap to download'}
        </Text>
        <View style={[styles.openBtn, busy && styles.openBtnBusy]}>
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.openText}>Open PDF</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: 'blue' | 'teal' | 'slate' }) {
  const palette = {
    blue: { bg: '#eff6ff', fg: studentTheme.primaryLight },
    teal: { bg: '#f0fdfa', fg: studentTheme.accent },
    slate: { bg: '#f1f5f9', fg: '#475569' },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.segmentBtn, active && styles.segmentBtnActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.pdfTile, styles.skeleton]} />
        <View style={[styles.cardMain, { gap: 8 }]}>
          <View style={[styles.skeletonLine, { width: '30%' }]} />
          <View style={[styles.skeletonLine, { width: '85%' }]} />
          <View style={[styles.skeletonLine, { width: '55%' }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  hero: { borderRadius: 20, padding: 18, gap: 14 },
  heroIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 22 },
  heroText: { paddingRight: 56, gap: 6 },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroBody: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
  },
  heroDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.25)' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: studentTheme.surface,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: studentTheme.text },
  clear: { fontSize: 14, color: studentTheme.textSubtle, fontWeight: '700' },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 3,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segmentBtnActive: {
    backgroundColor: studentTheme.surface,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '600', color: studentTheme.textMuted },
  segmentTextActive: { color: studentTheme.primary },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    backgroundColor: studentTheme.surface,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: studentTheme.primary, borderColor: studentTheme.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#fff' },
  list: { gap: 18 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  groupTitle: { fontSize: 14, fontWeight: '800', color: studentTheme.text },
  groupCount: { fontSize: 12, color: studentTheme.textMuted },
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8edf5',
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardPressed: { opacity: 0.85 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pdfTile: {
    width: 46,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfTileText: { fontSize: 12, fontWeight: '800', color: studentTheme.danger },
  pdfTileYear: { fontSize: 10, fontWeight: '600', color: '#b91c1c', marginTop: 2 },
  cardMain: { flex: 1, gap: 2 },
  code: { fontSize: 11, fontWeight: '800', color: studentTheme.primaryLight, letterSpacing: 0.4 },
  title: { fontSize: 15, fontWeight: '700', color: studentTheme.text, lineHeight: 20 },
  context: { fontSize: 12, color: studentTheme.textSubtle },
  star: { fontSize: 22, color: '#cbd5e1' },
  starOn: { color: '#f59e0b' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  footMeta: { fontSize: 12, color: studentTheme.textMuted, fontWeight: '600' },
  openBtn: {
    backgroundColor: studentTheme.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  openBtnBusy: { opacity: 0.7 },
  openText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: {
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: { fontSize: 34, marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 19, textAlign: 'center' },
  resetBtn: {
    marginTop: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resetText: { color: studentTheme.primary, fontWeight: '700', fontSize: 13 },
  moreBtn: {
    alignSelf: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 160,
    alignItems: 'center',
  },
  moreText: { color: studentTheme.primary, fontWeight: '700', fontSize: 13 },
  skeleton: { backgroundColor: '#f1f5f9', borderColor: '#f1f5f9' },
  skeletonLine: { height: 10, borderRadius: 6, backgroundColor: '#f1f5f9' },
});
