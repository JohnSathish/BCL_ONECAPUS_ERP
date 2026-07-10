import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DeviceSessionsPanel } from '@/components/auth/device-sessions-panel';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';
import {
  PRIVACY_POLICY_URL,
  SUPPORT_EMAIL,
  TERMS_URL,
  WHATSAPP_SUPPORT_URL,
} from '@/constants/release';
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
            label="Complete / update profile"
            onPress={() => router.push('/(student)/complete-profile' as never)}
          />
          <LinkRow
            label="Notification preferences"
            onPress={() => router.push('/(student)/notification-preferences' as never)}
          />
          <LinkRow label="About app" onPress={() => router.push('/(student)/about' as never)} />
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
          <LinkRow label="Terms & conditions" onPress={() => void Linking.openURL(TERMS_URL)} />
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
  container: { padding: 16, gap: 8, paddingBottom: 32 },
  hero: { alignItems: 'center', gap: 6, marginBottom: 8 },
  name: { fontSize: 18, fontWeight: '800', color: studentTheme.text },
  meta: { fontSize: 13, color: studentTheme.textMuted, fontWeight: '600' },
  card: {
    backgroundColor: studentTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
    padding: 12,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 12, color: studentTheme.textMuted, fontWeight: '600' },
  rowValue: { fontSize: 12, fontWeight: '700', color: studentTheme.text, flexShrink: 1 },
  links: { gap: 8, marginTop: 4 },
  linkRow: {
    backgroundColor: studentTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: { fontSize: 14, fontWeight: '700', color: studentTheme.text },
  chevron: { fontSize: 18, color: studentTheme.textMuted },
  logout: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#DC2626', fontWeight: '700' },
});
