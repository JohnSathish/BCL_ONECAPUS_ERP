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
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import {
  fetchStudentExamResults,
  fetchStudentIaMarks,
  markValue,
  resultStatusColor,
  type ExamMarkEntry,
  type ExamResultSummary,
  type IaMarkComponent,
  type IaMarkSummary,
} from '@/services/student-exams';

type TabKey = 'semester' | 'internal';

export default function StudentResultsScreen() {
  const [tab, setTab] = useState<TabKey>('semester');
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<ExamResultSummary[]>([]);
  const [marks, setMarks] = useState<ExamMarkEntry[]>([]);
  const [papers, setPapers] = useState<{ id: string; paperCode?: string; paperName?: string }[]>(
    [],
  );
  const [iaComponents, setIaComponents] = useState<IaMarkComponent[]>([]);
  const [iaSummaries, setIaSummaries] = useState<IaMarkSummary[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [semester, ia] = await Promise.all([
        fetchStudentExamResults().catch(() => ({
          summaries: [],
          marks: [],
          papers: [],
        })),
        fetchStudentIaMarks().catch(() => ({
          components: [],
          summaries: [],
        })),
      ]);
      setSummaries(semester.summaries ?? []);
      setMarks(semester.marks ?? []);
      setPapers(semester.papers ?? []);
      setIaComponents(ia.components ?? []);
      setIaSummaries(ia.summaries ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <StudentScreenShell title="Results" subtitle="Published semester & internal marks">
      <View style={styles.tabs}>
        <TabButton
          label="Semester Results"
          active={tab === 'semester'}
          onPress={() => setTab('semester')}
        />
        <TabButton
          label="Internal Marks"
          active={tab === 'internal'}
          onPress={() => setTab('internal')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : tab === 'semester' ? (
          <>
            {summaries.map((summary) => (
              <SummaryCard key={summary.id} summary={summary} />
            ))}

            {marks.length === 0 ? (
              <Text style={styles.muted}>No published semester results yet.</Text>
            ) : (
              marks.map((mark) => {
                const paper = papers.find((item) => item.id === mark.paperId);
                const color = resultStatusColor(mark.resultStatus);
                return (
                  <View key={mark.id} style={styles.markCard}>
                    <Text style={styles.paperCode}>{paper?.paperCode ?? 'Paper'}</Text>
                    <Text style={styles.paperTitle}>{paper?.paperName ?? 'Subject'}</Text>
                    <View style={styles.markGrid}>
                      <MarkCell label="Internal" value={markValue(mark.internalMarks)} />
                      <MarkCell label="External" value={markValue(mark.externalMarks)} />
                      <MarkCell label="Practical" value={markValue(mark.practicalMarks)} />
                      <MarkCell
                        label="Total"
                        value={`${markValue(mark.totalMarks)} / ${markValue(mark.maxMarks)}`}
                      />
                      <MarkCell label="Grade" value={markValue(mark.grade)} />
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: `${color}18` }]}>
                      <Text style={[styles.statusText, { color }]}>
                        {mark.resultStatus ?? 'Pending'}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : iaComponents.length === 0 && iaSummaries.length === 0 ? (
          <Text style={styles.muted}>No published internal marks yet.</Text>
        ) : (
          <>
            {iaSummaries.map((summary, index) => (
              <View key={`ia-summary-${index}`} style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>IA Summary</Text>
                <Text style={styles.summaryValue}>
                  {summary.totalMarks ?? '—'} / {summary.maxMarks ?? '—'}
                </Text>
                <Text style={styles.summaryMeta}>
                  {summary.percentage != null ? `${summary.percentage}%` : '—'} ·{' '}
                  {summary.resultStatus ?? 'Pending'}
                </Text>
              </View>
            ))}

            {iaComponents.map((component, index) => (
              <View key={`${component.code ?? 'ia'}-${index}`} style={styles.markCard}>
                <Text style={styles.paperCode}>{component.code ?? 'Component'}</Text>
                <Text style={styles.paperTitle}>{component.label ?? 'Internal component'}</Text>
                <Text style={styles.markTotal}>
                  {component.isAbsent
                    ? 'Absent'
                    : `${component.marks ?? '—'} / ${component.maxMarks ?? '—'}`}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
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

function SummaryCard({ summary }: { summary: ExamResultSummary }) {
  const color = resultStatusColor(summary.resultStatus);
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>Overall Result</Text>
      <Text style={[styles.summaryValue, { color }]}>{summary.resultStatus ?? 'Pending'}</Text>
      <Text style={styles.summaryMeta}>
        {summary.percentage != null ? `${summary.percentage}%` : '—'}
        {summary.sgpa != null ? ` · SGPA ${summary.sgpa}` : ''}
        {summary.cgpa != null ? ` · CGPA ${summary.cgpa}` : ''}
      </Text>
      <Text style={styles.summaryMeta}>
        Total {markValue(summary.totalMarks)} / {markValue(summary.maxMarks)}
      </Text>
    </View>
  );
}

function MarkCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.markCell}>
      <Text style={styles.markCellLabel}>{label}</Text>
      <Text style={styles.markCellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: studentTheme.surface,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  tabBtnActive: { backgroundColor: '#eff6ff', borderColor: studentTheme.primaryLight },
  tabText: { fontSize: 12, fontWeight: '700', color: studentTheme.textMuted },
  tabTextActive: { color: studentTheme.primaryLight },
  container: { padding: 16, gap: 10, paddingBottom: 28 },
  muted: { fontSize: 13, color: studentTheme.textMuted },
  summaryCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: studentTheme.textMuted },
  summaryValue: { fontSize: 22, fontWeight: '800', color: studentTheme.text },
  summaryMeta: { fontSize: 12, color: studentTheme.textMuted },
  markCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 6,
  },
  paperCode: { fontSize: 11, fontWeight: '800', color: studentTheme.primaryLight },
  paperTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  markGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  markCell: {
    width: '30%',
    minWidth: 92,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  markCellLabel: { fontSize: 10, color: studentTheme.textMuted, fontWeight: '700' },
  markCellValue: { fontSize: 13, fontWeight: '800', color: studentTheme.text, marginTop: 2 },
  markTotal: { fontSize: 16, fontWeight: '800', color: studentTheme.primary },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
});
