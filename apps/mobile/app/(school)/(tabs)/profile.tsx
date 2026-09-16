import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { logout } from '@/auth/logout';
import { SchoolCard, SchoolShell } from '@/components/school-sis/school-shell';
import { t } from '@/i18n';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

export default function SchoolProfileScreen() {
  const router = useRouter();
  const displayName = useSchoolSession((s) => s.displayName);
  const persona = useSchoolSession((s) => s.persona);
  const schoolName = useSchoolSession((s) => s.schoolName);
  const reset = useSchoolSession((s) => s.reset);

  return (
    <SchoolShell title="My profile">
      <SchoolCard>
        <Text style={styles.name}>{displayName || 'School user'}</Text>
        <Text style={styles.meta}>{persona}</Text>
        <Text style={styles.meta}>{schoolName}</Text>
      </SchoolCard>
      <SchoolCard onPress={() => router.push('/(school)/id-card' as never)}>
        <Text style={styles.link}>Digital ID card</Text>
      </SchoolCard>
      <SchoolCard onPress={() => router.push('/(school)/documents' as never)}>
        <Text style={styles.link}>Documents</Text>
      </SchoolCard>
      <SchoolCard onPress={() => router.push('/(school)/settings' as never)}>
        <Text style={styles.link}>Settings</Text>
      </SchoolCard>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          Alert.alert('Log out', 'End this session on this device?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: t('logout'),
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  reset();
                  await logout();
                  router.replace('/(auth)/login');
                })();
              },
            },
          ]);
        }}
      >
        <Text style={styles.logout}>{t('logout')}</Text>
      </Pressable>
    </SchoolShell>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: '800', color: schoolUi.colors.text },
  meta: { color: schoolUi.colors.muted, marginTop: 4, textTransform: 'capitalize' },
  link: { fontWeight: '700', color: schoolUi.colors.primary },
  logout: { color: schoolUi.colors.danger, fontWeight: '800', textAlign: 'center', marginTop: 16 },
});
