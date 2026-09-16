import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchTeacherToday } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { hideStaffAdminModules } from '@/features/school/permissions';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

export default function TakeAttendanceIndex() {
  const router = useRouter();
  const persona = useSchoolSession((s) => s.persona);
  const q = useQuery({
    queryKey: ['teacher-today'],
    queryFn: () => fetchTeacherToday(),
    enabled: !hideStaffAdminModules(persona),
  });
  if (hideStaffAdminModules(persona)) {
    return (
      <SchoolShell title="Take attendance">
        <SchoolEmpty title="Not permitted" body="Only teaching staff can mark class attendance." />
      </SchoolShell>
    );
  }
  const classes = Array.isArray(q.data?.classes)
    ? (q.data!.classes as Record<string, unknown>[])
    : [];
  const periods = Array.isArray(q.data?.periods)
    ? (q.data!.periods as Record<string, unknown>[])
    : [];
  const list = classes.length ? classes : periods;

  return (
    <SchoolShell title="Take attendance" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      {list.length === 0 ? (
        <SchoolEmpty title="No class assigned today" body="Assigned sections appear here." />
      ) : (
        list.map((row, i) => (
          <SchoolCard
            key={i}
            onPress={() =>
              router.push({
                pathname: '/(school)/take-attendance/[sectionId]',
                params: { sectionId: String(row.sectionId) },
              } as never)
            }
          >
            <Text style={styles.title}>{String(row.label ?? 'Class')}</Text>
            <Text style={styles.meta}>
              {String(row.subject ?? '')} {String(row.status ?? row.submitted ?? '')}
            </Text>
          </SchoolCard>
        ))
      )}
      <Pressable onPress={() => router.push('/(school)/attendance' as never)}>
        <Text style={styles.link}>View my attendance calendar</Text>
      </Pressable>
    </SchoolShell>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', fontSize: 16, color: schoolUi.colors.text },
  meta: { color: schoolUi.colors.muted, marginTop: 4 },
  link: { color: schoolUi.colors.primary, fontWeight: '700', textAlign: 'center', marginTop: 12 },
});
