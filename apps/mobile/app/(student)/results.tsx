import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  fetchStudentExamResults,
  fetchStudentIaMarks,
  type ExamMarkEntry,
  type IaResultPaper,
} from '@/services/student-exams';

type TabKey = 'internal' | 'semester';
type Outcome = 'PASS' | 'FAIL' | 'ABSENT';

type ResultRow = {
  id: string;
  code: string;
  title: string;
  sessionName?: string | null;
  secured: number | null;
  maxMarks: number;
  passMark: number;
  outcome: Outcome;
};

const TILES = ['#1d4ed8', '#7c3aed', '#d97706', '#059669', '#0f766e', '#be123c'] as const;

function formatMark(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 100) / 100);
}

function passMarkFor(maxMarks: number, explicit?: number | null) {
  if (explicit != null && !Number.isNaN(Number(explicit))) return Number(explicit);
  if (!maxMarks) return 0;
  return Math.ceil(maxMarks * 0.4);
}

function outcomeOf(status?: string | null, secured?: number | null, passMark?: number): Outcome {
  const text = String(status ?? '').toUpperCase();
  if (text.includes('ABSENT')) return 'ABSENT';
  if (text === 'PASS' || text === 'PASSED') return 'PASS';
  if (text === 'FAIL' || text === 'FAILED') return 'FAIL';
  if (secured == null) return 'FAIL';
  return secured >= (passMark ?? 0) ? 'PASS' : 'FAIL';
}

function ResultCard({ row, tint }: { row: ResultRow; tint: string }) {
  const passed = row.outcome === 'PASS';
  const absent = row.outcome === 'ABSENT';
  return (
    <View style={styles.card}>
      <View style={[styles.tile, { backgroundColor: tint }]}>
        <Text style={styles.tileText}>{row.code}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{row.title}</Text>
        <Text style={styles.cardMeta}>
          Maximum {formatMark(row.maxMarks)} · Pass mark {formatMark(row.passMark)}
        </Text>
      </View>
      <View style={styles.scoreCol}>
        <Text style={[styles.score, absent && styles.scoreAbsent]}>
          {absent ? 'AB' : formatMark(row.secured)}
        </Text>
        <Text style={styles.scoreMax}>/ {formatMark(row.maxMarks)}</Text>
        <Text
          style={[
            styles.outcome,
            passed && styles.outcomePass,
            row.outcome === 'FAIL' && styles.outcomeFail,
            absent && styles.outcomeAbsent,
          ]}
        >
          {absent ? 'Absent' : passed ? 'Pass' : 'Fail'}
        </Text>
      </View>
    </View>
  );
}

export default function StudentResultsScreen() {
  const [tab, setTab] = useState<TabKey>('internal');
  const [loading, setLoading] = useState(true);
  const [iaPapers, setIaPapers] = useState<IaResultPaper[]>([]);
  const [semesterRows, setSemesterRows] = useState<ResultRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [semester, ia] = await Promise.all([
        fetchStudentExamResults().catch(() => ({
          summaries: [],
          marks: [],
          papers: [],
        })),
        fetchStudentIaMarks().catch(() => ({ papers: [], components: [] })),
      ]);
      const publishedPapers = ia.papers ?? [];
      if (publishedPapers.length) {
        setIaPapers(publishedPapers);
      } else {
        setIaPapers(
          (ia.components ?? []).map((component) => {
            const maxMarks = Number(component.maxMarks ?? 0);
            const passMark = passMarkFor(maxMarks);
            const absent = Boolean(component.isAbsent);
            return {
              paperCode: component.code,
              paperName: component.label,
              marks: absent ? null : (component.marks ?? null),
              maxMarks,
              passMark,
              isAbsent: absent,
              outcome: absent ? 'ABSENT' : (component.marks ?? 0) >= passMark ? 'PASS' : 'FAIL',
            };
          }),
        );
      }
      const papers = semester.papers ?? [];
      setSemesterRows(
        (semester.marks ?? []).map((mark: ExamMarkEntry) => {
          const paper = papers.find((item) => item.id === mark.paperId);
          const maxMarks = Number(mark.maxMarks ?? 0);
          const passMark = passMarkFor(maxMarks);
          const secured = mark.totalMarks == null ? null : Number(mark.totalMarks);
          return {
            id: mark.id,
            code: paper?.paperCode ?? 'Paper',
            title: paper?.paperName ?? 'Semester paper',
            secured,
            maxMarks,
            passMark,
            outcome: outcomeOf(mark.resultStatus, secured, passMark),
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const internalRows = useMemo<ResultRow[]>(
    () =>
      iaPapers.map((paper, index) => ({
        id: paper.paperId ?? `${paper.paperCode ?? 'paper'}-${index}`,
        code: paper.paperCode || 'Paper',
        title: paper.paperName || 'Internal paper',
        sessionName: paper.sessionName,
        secured: paper.isAbsent ? null : (paper.marks ?? null),
        maxMarks: Number(paper.maxMarks ?? 0),
        passMark: passMarkFor(Number(paper.maxMarks ?? 0), paper.passMark),
        outcome: outcomeOf(paper.outcome, paper.marks, paper.passMark),
      })),
    [iaPapers],
  );

  const rows = tab === 'internal' ? internalRows : semesterRows;
  const sessionTitle = useMemo(() => {
    const names = [
      ...new Set(internalRows.map((row) => row.sessionName?.trim()).filter(Boolean)),
    ] as string[];
    if (tab === 'semester') return 'Semester examination';
    if (names.length === 1) return names[0];
    return 'Internal assessment';
  }, [internalRows, tab]);
  const passed = rows.filter((row) => row.outcome === 'PASS').length;
  const failed = rows.filter((row) => row.outcome === 'FAIL').length;
  const absent = rows.filter((row) => row.outcome === 'ABSENT').length;

  return (
    <StudentScreenShell title="Exam Results" subtitle="Marks secured against the pass mark">
      <View style={styles.tabs}>
        <TabButton
          label="Internal (IA)"
          active={tab === 'internal'}
          onPress={() => setTab('internal')}
        />
        <TabButton
          label="Semester Exams"
          active={tab === 'semester'}
          onPress={() => setTab('semester')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No published results yet</Text>
            <Text style={styles.emptyBody}>
              {tab === 'internal'
                ? 'Internal marks appear here after the college locks and publishes them.'
                : 'Semester results appear here after the examination cell publishes them.'}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryEyebrow}>Published result</Text>
              <Text style={styles.summaryTitle}>{sessionTitle}</Text>
            </View>
            <View style={styles.stats}>
              <Stat value={String(rows.length)} label="Appeared" />
              <Stat value={String(passed)} label="Passed" tone="pass" />
              <Stat value={String(failed + absent)} label="Not passed" tone="fail" />
            </View>
            {rows.map((row, index) => (
              <ResultCard key={row.id} row={row} tint={TILES[index % TILES.length] ?? TILES[0]} />
            ))}
            <View style={styles.footerCard}>
              <Text style={styles.footerTitle}>Result summary</Text>
              <View style={styles.footerRow}>
                <Stat value={String(rows.length)} label="Papers" compact />
                <Stat value={String(passed)} label="Pass" tone="pass" compact />
                <Stat value={String(failed)} label="Fail" tone="fail" compact />
                <Stat value={String(absent)} label="Absent" tone="absent" compact />
              </View>
            </View>
            {failed === 0 && absent === 0 ? (
              <View style={styles.bannerPass}>
                <Text style={styles.bannerTitle}>All papers are a pass</Text>
                <Text style={styles.bannerBody}>
                  Every published paper is on or above its pass mark.
                </Text>
              </View>
            ) : (
              <View style={styles.bannerFail}>
                <Text style={styles.bannerFailTitle}>
                  {failed + absent} paper{failed + absent === 1 ? '' : 's'} not passed
                </Text>
                <Text style={styles.bannerFailBody}>
                  A paper is a pass only when the mark secured reaches the pass mark. Absent is not
                  a pass.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

function Stat({
  value,
  label,
  tone,
  compact,
}: {
  value: string;
  label: string;
  tone?: 'pass' | 'fail' | 'absent';
  compact?: boolean;
}) {
  return (
    <View style={[styles.stat, compact && styles.statCompact]}>
      <Text
        style={[
          styles.statValue,
          tone === 'pass' && styles.statPass,
          tone === 'fail' && styles.statFail,
          tone === 'absent' && styles.statAbsent,
        ]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: studentTheme.surface,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  tabBtnActive: {
    backgroundColor: studentTheme.primaryLight,
    borderColor: studentTheme.primaryLight,
  },
  tabText: { fontSize: 13, fontWeight: '700', color: studentTheme.textMuted },
  tabTextActive: { color: '#fff' },
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  summary: {
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 4,
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: studentTheme.primaryLight,
  },
  summaryTitle: { fontSize: 18, fontWeight: '800', color: studentTheme.text, lineHeight: 24 },
  stats: {
    flexDirection: 'row',
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: studentTheme.border,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statCompact: { paddingVertical: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: studentTheme.text },
  statPass: { color: '#059669' },
  statFail: { color: '#dc2626' },
  statAbsent: { color: '#d97706' },
  statLabel: { fontSize: 11, fontWeight: '700', color: studentTheme.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  tile: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tileText: { color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text, lineHeight: 20 },
  cardMeta: { fontSize: 12, fontWeight: '600', color: studentTheme.textMuted, lineHeight: 17 },
  scoreCol: { alignItems: 'flex-end', minWidth: 72, gap: 2 },
  score: { fontSize: 22, fontWeight: '800', color: studentTheme.text },
  scoreAbsent: { fontSize: 18, color: '#d97706' },
  scoreMax: { fontSize: 11, fontWeight: '700', color: studentTheme.textMuted },
  outcome: {
    marginTop: 2,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: '#64748b',
  },
  outcomePass: { backgroundColor: '#059669' },
  outcomeFail: { backgroundColor: '#dc2626' },
  outcomeAbsent: { backgroundColor: '#d97706' },
  footerCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 10,
  },
  footerTitle: { fontSize: 14, fontWeight: '800', color: studentTheme.text },
  footerRow: { flexDirection: 'row' },
  bannerPass: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 4,
  },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: '#065f46' },
  bannerBody: { fontSize: 12, color: '#047857', lineHeight: 18 },
  bannerFail: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 4,
  },
  bannerFailTitle: { fontSize: 15, fontWeight: '800', color: '#991b1b' },
  bannerFailBody: { fontSize: 12, color: '#b91c1c', lineHeight: 18 },
  emptyCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  emptyBody: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 19 },
});
