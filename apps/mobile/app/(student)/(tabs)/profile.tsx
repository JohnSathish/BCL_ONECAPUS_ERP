import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DeviceSessionsPanel } from '@/components/auth/device-sessions-panel';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, WHATSAPP_SUPPORT_URL } from '@/constants/release';
import { logout } from '@/auth/logout';
import { formatInr } from '@/utils/currency';

export default function StudentProfileScreen() {
  const router = useRouter();
  const { home } = useStudentPortal();
  const studentName = home?.profile?.displayFullName ?? 'Student';
  const program = home?.profile?.programName ?? 'Program';
  const semester = home?.profile?.semesterLabel ?? 'Semester';
  const roll = home?.profile?.rollNumber ?? '—';
  const feeDue = home?.fees?.due ?? 0;

  async function onLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <StudentScreenShell title="My Profile" subtitle="Account & documents">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <StudentAvatar name={studentName} photoUrl={home?.profile?.photoUrl} size={64} />
          <Text style={styles.name}>{studentName}</Text>
          <Text style={styles.meta}>
            {program} • {semester}
          </Text>
          <Text style={styles.meta}>Roll No: {roll}</Text>
        </View>

        <View style={styles.card}>
          <Row label="Status" value={home?.profile?.status ?? 'ACTIVE'} />
          <Row label="Outstanding fees" value={formatInr(feeDue)} />
          <Row label="Notifications" value={`${home?.unreadNotificationCount ?? 0} unread`} />
        </View>

        <View style={styles.links}>
          <LinkRow
            label="Change password"
            onPress={() => router.push('/(auth)/change-password' as never)}
          />
          <LinkRow
            label="Email support"
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
          <LinkRow
            label="WhatsApp support"
            onPress={() => void Linking.openURL(WHATSAPP_SUPPORT_URL)}
          />
          <LinkRow
            label="Privacy policy"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          />
        </View>

        <DeviceSessionsPanel
          surfaceColor={studentTheme.surface}
          borderColor={studentTheme.border}
          textColor={studentTheme.text}
          mutedColor={studentTheme.textMuted}
        />

        <Pressable style={styles.logout} onPress={() => void onLogout()}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </StudentScreenShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.linkRow} onPress={onPress}>
      <Text style={styles.linkText}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 28 },
  hero: {
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: studentTheme.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  name: { marginTop: 10, fontSize: 20, fontWeight: '700', color: studentTheme.text },
  meta: { marginTop: 4, fontSize: 13, color: studentTheme.textMuted },
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: studentTheme.textMuted, fontSize: 13 },
  rowValue: { color: studentTheme.text, fontWeight: '600', fontSize: 13 },
  links: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: studentTheme.border,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  linkText: { fontSize: 14, color: studentTheme.text, fontWeight: '500' },
  chevron: { fontSize: 20, color: studentTheme.textSubtle },
  logout: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: studentTheme.danger, fontWeight: '700' },
});
