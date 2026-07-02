import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';

export default function FacultyStudentsScreen() {
  const router = useRouter();
  const { home } = useFacultyPortal();
  const classes = home?.myClasses ?? [];

  return (
    <FacultyScreenShell title="Students" subtitle="Class rosters & progress">
      <ScrollView contentContainerStyle={styles.container}>
        {classes.map((cls) => (
          <Pressable
            key={cls.id}
            style={styles.card}
            onPress={() => {
              if (!cls.offeringSectionId) return;
              router.push({
                pathname: '/(staff)/class-roster/[sectionId]',
                params: { sectionId: cls.offeringSectionId, title: cls.courseTitle },
              } as never);
            }}
            disabled={!cls.offeringSectionId}
          >
            <Text style={styles.title}>{cls.courseTitle}</Text>
            <Text style={styles.meta}>
              Sem {cls.semesterNo ?? '—'} · Section {cls.sectionCode ?? '—'}
            </Text>
            <Text style={styles.count}>{cls.studentCount ?? 0} students</Text>
            {cls.offeringSectionId ? (
              <Text style={styles.action}>Open roster →</Text>
            ) : (
              <Text style={styles.unavailable}>Roster unavailable for this class</Text>
            )}
          </Pressable>
        ))}
        {classes.length === 0 ? (
          <Text style={styles.empty}>No student groups assigned yet.</Text>
        ) : null}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  card: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  title: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  meta: { fontSize: 12, color: facultyTheme.textMuted },
  count: { fontSize: 13, fontWeight: '700', color: facultyTheme.primaryLight, marginTop: 4 },
  action: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight, marginTop: 6 },
  unavailable: { fontSize: 11, color: facultyTheme.textSubtle, marginTop: 6 },
  empty: { fontSize: 13, color: facultyTheme.textMuted },
});
