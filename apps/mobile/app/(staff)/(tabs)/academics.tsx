import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';

function openRoster(
  router: ReturnType<typeof useRouter>,
  cls: { offeringSectionId?: string | null; courseTitle: string },
) {
  if (!cls.offeringSectionId) return;
  router.push({
    pathname: '/(staff)/class-roster/[sectionId]',
    params: { sectionId: cls.offeringSectionId, title: cls.courseTitle },
  } as never);
}

export default function FacultyAcademicsScreen() {
  const router = useRouter();
  const { home } = useFacultyPortal();
  const classes = home?.myClasses ?? [];

  return (
    <FacultyScreenShell title="My Academics" subtitle="Classes & teaching load">
      <ScrollView contentContainerStyle={styles.container}>
        {classes.length === 0 ? (
          <Text style={styles.empty}>No assigned classes found for this account.</Text>
        ) : (
          classes.map((cls) => (
            <Pressable
              key={cls.id}
              style={styles.card}
              onPress={() => openRoster(router, cls)}
              disabled={!cls.offeringSectionId}
            >
              <Text style={styles.sem}>Semester {cls.semesterNo ?? '—'}</Text>
              <Text style={styles.title}>{cls.courseTitle}</Text>
              <Text style={styles.meta}>
                {cls.sectionCode ?? '—'} · {cls.studentCount ?? 0} students · {cls.weeklyHours ?? 0}{' '}
                hrs/week
              </Text>
              <View style={styles.actions}>
                {cls.offeringSectionId ? <Text style={styles.link}>View roster →</Text> : null}
                {cls.canEnterInternalMarks ? (
                  <Pressable onPress={() => router.push('/(staff)/marks' as never)}>
                    <Text style={styles.link}>Enter marks →</Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  empty: { color: facultyTheme.textMuted, fontSize: 14 },
  card: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  sem: { fontSize: 11, fontWeight: '700', color: facultyTheme.primaryLight },
  title: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  meta: { fontSize: 12, color: facultyTheme.textMuted },
  actions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  link: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight },
});
