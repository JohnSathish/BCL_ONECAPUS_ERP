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

  const withPapers = subjects.filter((s) => s.papers.length > 0);

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
                        title: subject.courseName,
                        paperCode: paper.paperCode,
                      },
                    } as never)
                  }
                >
                  <Text style={styles.paperTitle}>{paper.paperName || paper.paperCode}</Text>
                  <Text style={styles.paperMeta}>
                    {paper.paperCode}
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
