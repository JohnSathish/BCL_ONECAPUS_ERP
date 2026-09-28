import { useCallback, useEffect, useState } from 'react';
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
  openQuestionPaper,
  type QuestionPaper,
} from '@/services/question-papers';

const PAGE_SIZE = 30;
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export default function StudentQuestionPapersScreen() {
  const [items, setItems] = useState<QuestionPaper[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [semester, setSemester] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyQuestionPapers({
        q: query,
        semesterNo: semester,
        page: 1,
        limit: PAGE_SIZE,
      });
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
      setPage(1);
    } catch (e) {
      Alert.alert(
        'Could not load question papers',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [query, semester]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setItems((prev) => [...prev, ...(res.items ?? [])]);
      setTotal(res.total ?? 0);
      setPage(next);
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
    } catch (e) {
      Alert.alert('Unable to open', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <StudentScreenShell title="Question Papers" subtitle="Previous papers for your programme">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void load()} />}
      >
        <TextInput
          style={styles.search}
          placeholder="Search by paper code or name"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            <Chip
              label="All semesters"
              active={semester == null}
              onPress={() => setSemester(null)}
            />
            {SEMESTERS.map((s) => (
              <Chip
                key={s}
                label={`Sem ${s}`}
                active={semester === s}
                onPress={() => setSemester(s)}
              />
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={studentTheme.primary} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No question papers found</Text>
            <Text style={styles.emptyBody}>
              {query || semester
                ? 'Try a different search or semester.'
                : 'Question papers published by your department for your registered papers will appear here automatically.'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.count}>
              {total} paper{total === 1 ? '' : 's'}
            </Text>
            {items.map((paper) => {
              const exam = [
                paper.examMonth ? MONTHS[paper.examMonth - 1] : null,
                paper.examYear ?? null,
              ]
                .filter(Boolean)
                .join(' ');
              const meta = [
                paper.semesterNo != null ? `Sem ${paper.semesterNo}` : null,
                exam || null,
                humanize(paper.examinationType),
                humanize(paper.subjectCategory),
              ].filter(Boolean);
              const busy = busyId === paper.id;
              return (
                <View key={paper.id} style={styles.card}>
                  <Text style={styles.code}>{paper.paperCode}</Text>
                  <Text style={styles.title}>{paper.paperName}</Text>
                  {meta.length ? <Text style={styles.meta}>{meta.join(' · ')}</Text> : null}
                  {paper.programmeName || paper.departmentName ? (
                    <Text style={styles.sub}>
                      {[paper.programmeName, paper.departmentName].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                  <View style={styles.row}>
                    <Pressable
                      style={[styles.openBtn, busy && styles.openBtnBusy]}
                      disabled={busy}
                      onPress={() => void onOpen(paper)}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.openText}>Open PDF</Text>
                      )}
                    </Pressable>
                    {formatBytes(paper.fileSizeBytes) ? (
                      <Text style={styles.size}>{formatBytes(paper.fileSizeBytes)}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
            {items.length < total ? (
              <Pressable style={styles.moreBtn} onPress={() => void loadMore()}>
                <Text style={styles.moreText}>{loadingMore ? 'Loading…' : 'Load more'}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: studentTheme.primary, borderColor: studentTheme.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  chipTextActive: { color: '#fff' },
  count: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  empty: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  emptyBody: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
  },
  code: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 12, color: '#475569' },
  sub: { fontSize: 12, color: '#94a3b8' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  openBtn: {
    backgroundColor: studentTheme.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 96,
    alignItems: 'center',
  },
  openBtnBusy: { opacity: 0.7 },
  openText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  size: { fontSize: 12, color: '#94a3b8' },
  moreBtn: {
    alignSelf: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  moreText: { color: studentTheme.primary, fontWeight: '600', fontSize: 13 },
});
