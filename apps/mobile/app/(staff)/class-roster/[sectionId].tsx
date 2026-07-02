import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { facultyTheme } from '@/components/faculty-portal/theme';
import { fetchSectionRoster, type SectionRosterStudent } from '@/services/faculty-roster';

export default function ClassRosterScreen() {
  const router = useRouter();
  const { sectionId, title } = useLocalSearchParams<{ sectionId: string; title?: string }>();
  const [loading, setLoading] = useState(true);
  const [sectionLabel, setSectionLabel] = useState(title ?? 'Class Roster');
  const [students, setStudents] = useState<SectionRosterStudent[]>([]);

  const load = useCallback(async () => {
    if (!sectionId) return;
    setLoading(true);
    try {
      const roster = await fetchSectionRoster(sectionId);
      const course = roster.section.course?.title ?? roster.section.course?.code ?? 'Class';
      const section = roster.section.sectionCode ?? '—';
      setSectionLabel(title ?? `${course} · Sec ${section}`);
      setStudents(roster.students);
    } catch (e) {
      Alert.alert('Could not load roster', e instanceof Error ? e.message : 'Try again');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router, sectionId, title]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <FacultyScreenShell title={sectionLabel} subtitle={`${students.length} students enrolled`}>
      {loading ? (
        <ActivityIndicator color={facultyTheme.primaryLight} style={{ marginTop: 32 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          {students.length === 0 ? (
            <Text style={styles.empty}>No students registered in this section yet.</Text>
          ) : (
            students.map((student, index) => (
              <View key={student.id} style={styles.row}>
                <Text style={styles.index}>{index + 1}</Text>
                <View style={styles.info}>
                  <Text style={styles.roll}>{student.rollNumber ?? '—'}</Text>
                  <Text style={styles.name}>{student.fullName}</Text>
                  {student.department?.name ? (
                    <Text style={styles.dept}>{student.department.name}</Text>
                  ) : null}
                </View>
                <Text style={styles.status}>{student.status ?? ''}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8, paddingBottom: 28 },
  empty: { fontSize: 13, color: facultyTheme.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: facultyTheme.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  index: { width: 24, fontSize: 12, fontWeight: '700', color: facultyTheme.textMuted },
  info: { flex: 1, gap: 2 },
  roll: { fontSize: 11, fontWeight: '700', color: facultyTheme.primaryLight },
  name: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  dept: { fontSize: 11, color: facultyTheme.textMuted },
  status: {
    fontSize: 10,
    fontWeight: '700',
    color: facultyTheme.textSubtle,
    textTransform: 'uppercase',
  },
});
