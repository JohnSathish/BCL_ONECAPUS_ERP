import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SchoolCard, SchoolShell } from '@/components/school-sis/school-shell';
import { hideStaffAdminModules } from '@/features/school/permissions';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolAcademicsScreen() {
  const router = useRouter();
  const persona = useSchoolSession((s) => s.persona);
  const features = useSchoolSession((s) => s.features);
  const studentLinks = [
    { label: 'Attendance calendar', href: '/(school)/attendance' },
    { label: 'Timetable', href: '/(school)/timetable' },
    { label: 'Examinations', href: '/(school)/exams' },
    { label: 'Homework', href: '/(school)/homework' },
    { label: 'Academic calendar', href: '/(school)/calendar' },
    ...(features.library !== false ? [{ label: 'Library', href: '/(school)/library' }] : []),
    ...(features.transport !== false ? [{ label: 'Transport', href: '/(school)/transport' }] : []),
    { label: 'ID card', href: '/(school)/id-card' },
  ];
  const teacherLinks = [
    { label: 'Take attendance', href: '/(school)/take-attendance' },
    { label: 'Timetable', href: '/(school)/timetable' },
    { label: 'Homework', href: '/(school)/homework' },
    { label: 'Leave', href: '/(school)/leave' },
    ...(features.hr !== false ? [{ label: 'My HR', href: '/(school)/hr' }] : []),
  ];
  const adminLinks = [
    { label: 'Take attendance', href: '/(school)/take-attendance' },
    { label: 'Reports', href: '/(school)/reports' },
    { label: 'Notices', href: '/(school)/notices' },
    { label: 'Calendar', href: '/(school)/calendar' },
  ];
  const links =
    persona === 'teacher'
      ? teacherLinks
      : persona === 'admin' || persona === 'accountant'
        ? adminLinks
        : persona === 'librarian'
          ? [{ label: 'Library', href: '/(school)/library' }]
          : persona === 'transport'
            ? [{ label: 'Transport', href: '/(school)/transport' }]
            : studentLinks;

  return (
    <SchoolShell title={persona === 'parent' ? 'Children & academics' : 'Academics'}>
      <View style={{ gap: 10 }}>
        {links.map((item) => (
          <SchoolCard key={item.href} onPress={() => router.push(item.href as never)}>
            <Text style={styles.label}>{item.label}</Text>
          </SchoolCard>
        ))}
        {hideStaffAdminModules(persona) ? null : (
          <Pressable onPress={() => router.push('/(school)/settings' as never)}>
            <Text style={styles.more}>Settings</Text>
          </Pressable>
        )}
      </View>
    </SchoolShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: '700', color: schoolUi.colors.text },
  more: { color: schoolUi.colors.primary, fontWeight: '700', textAlign: 'center', marginTop: 8 },
});
