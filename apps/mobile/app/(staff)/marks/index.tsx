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
import { useRouter } from 'expo-router';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import { fetchFacultyIaSubjects, type FacultyIaSubject } from '@/services/faculty-marks';

function paperKey(subject: FacultyIaSubject, paper: FacultyIaSubject['papers'][number]) {
  const category = (paper.category || '').trim().toUpperCase();
  const code = (paper.paperCode || '').trim().toUpperCase();
  if (!category || !code || category === 'INTERNSHIP') return paper.id;
  const semester = paper.semesterNo ?? subject.semesterNo ?? '';
  if (
    category === 'MINOR' ||
    category === 'MDC' ||
    category === 'AEC' ||
    category === 'SEC' ||
    category === 'VAC'
  ) {
    return [paper.sessionId, semester, category, code].join('|');
  }
  const courseId = paper.courseId || subject.courseId;
  if (!courseId) return paper.id;
  return [paper.sessionId, semester, courseId, category, code, paper.assessmentKey || ''].join('|');
}

function collapsePapers(subject: FacultyIaSubject, papers: FacultyIaSubject['papers']) {
  const result: FacultyIaSubject['papers'] = [];
  const indexByKey = new Map<string, number>();
  for (const paper of papers) {
    const key = paperKey(subject, paper);
    const index = indexByKey.get(key);
    if (index == null) {
      indexByKey.set(key, result.length);
      result.push({ ...paper });
      continue;
    }
    const existing = result[index];
    if (
      existing.programmeName &&
      paper.programmeName &&
      existing.programmeName !== paper.programmeName
    ) {
      result[index] = { ...existing, programmeName: null, programmeCode: null };
    }
  }
  return result;
}

function slotLabel(value?: string | null) {
  if (!value) return '';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function FacultyMarksIndexScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<FacultyIaSubject[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchFacultyIaSubjects();
      setSubjects(rows);
    } catch {
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = new Map<string, FacultyIaSubject>();
  for (const subject of subjects) {
    const key = `${subject.courseId}|${subject.semesterNo ?? ''}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...subject,
        papers: collapsePapers(subject, subject.papers),
      });
      continue;
    }
    existing.papers = collapsePapers(subject, [...existing.papers, ...subject.papers]);
    if (
      existing.programmeName &&
      subject.programmeName &&
      existing.programmeName !== subject.programmeName
    ) {
      existing.programmeName = null;
    }
  }
  const withPapers = [...grouped.values()].filter((s) => s.papers.length > 0);

  return (
    <FacultyScreenShell title="Internal Marks" subtitle="IA mark entry by subject">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading && withPapers.length === 0 ? (
          <ActivityIndicator color={facultyTheme.primaryLight} style={{ marginTop: 24 }} />
        ) : withPapers.length === 0 ? (
          <Text style={styles.empty}>No IA papers are linked to your assigned subjects yet.</Text>
        ) : (
          withPapers.map((subject) => (
            <View key={subject.assignmentId} style={styles.subjectBlock}>
              <Text style={styles.sem}>Semester {subject.semesterNo}</Text>
              <Text style={styles.subjectTitle}>{subject.courseName}</Text>
              <Text style={styles.subjectMeta}>
                {subject.sectionCode ?? '—'}
                {subject.programmeName ? ` · ${subject.programmeName}` : ''}
              </Text>
              {subject.papers.map((paper) => (
                <Pressable
                  key={paper.id}
                  style={styles.paperCard}
                  onPress={() =>
                    router.push({
                      pathname: '/(staff)/marks/[paperId]',
                      params: {
                        paperId: paper.id,
                        title: [
                          paper.paperName || subject.courseName,
                          slotLabel(paper.category),
                          paper.programmeName || paper.programmeCode,
                        ]
                          .filter(Boolean)
                          .join(' · '),
                        paperCode: paper.paperCode,
                      },
                    } as never)
                  }
                >
                  <Text style={styles.paperTitle}>{paper.paperName || paper.paperCode}</Text>
                  <Text style={styles.paperMeta}>
                    {paper.paperCode}
                    {paper.category ? ` · ${slotLabel(paper.category)}` : ''}
                    {paper.programmeName || paper.programmeCode
                      ? ` · ${paper.programmeName || paper.programmeCode}`
                      : ''}
                    {paper.examDate ? ` · ${paper.examDate.slice(0, 10)}` : ''}
                  </Text>
                  <Text style={styles.action}>Enter marks →</Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 28 },
  empty: { fontSize: 13, color: facultyTheme.textMuted },
  subjectBlock: { gap: 8 },
  sem: { fontSize: 11, fontWeight: '700', color: facultyTheme.primaryLight },
  subjectTitle: { fontSize: 16, fontWeight: '800', color: facultyTheme.text },
  subjectMeta: { fontSize: 12, color: facultyTheme.textMuted, marginBottom: 4 },
  paperCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  paperTitle: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  paperMeta: { fontSize: 12, color: facultyTheme.textMuted },
  action: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight, marginTop: 4 },
});
