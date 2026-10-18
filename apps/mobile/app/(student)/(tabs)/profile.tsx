import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DeviceSessionsPanel } from '@/components/auth/device-sessions-panel';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';
import { logout } from '@/auth/logout';
import { formatInr } from '@/utils/currency';

const MENU = [
  {
    id: 'profile',
    icon: '👤',
    tint: '#DBEAFE',
    title: 'Complete / Update Profile',
    body: 'Add or update your personal, contact and academic information',
    href: '/(student)/complete-profile',
  },
  {
    id: 'documents',
    icon: '📄',
    tint: '#D1FAE5',
    title: 'My Documents',
    body: 'View and manage your uploaded documents',
    href: '/(student)/complete-profile',
  },
  {
    id: 'certificates',
    icon: '🏅',
    tint: '#EDE9FE',
    title: 'Certificates',
    body: 'Download your academic certificates (Bonafide, Conduct, Transfer Certificate, etc.)',
    href: '/(student)/certificates',
  },
  {
    id: 'feedback',
    icon: '💬',
    tint: '#FCE7F3',
    title: 'Feedback',
    body: 'Share your feedback and suggestions',
    href: '/(student)/feedback',
  },
  {
    id: 'support',
    icon: '🎧',
    tint: '#DBEAFE',
    title: 'Support Centre',
    body: 'Get help and raise a support request',
    href: '/(student)/support',
  },
  {
    id: 'alerts',
    icon: '🔔',
    tint: '#FFEDD5',
    title: 'Notification Preferences',
    body: 'Manage your notification settings',
    href: '/(student)/notification-preferences',
  },
  {
    id: 'about',
    icon: 'ℹ️',
    tint: '#F3F4F6',
    title: 'About App',
    body: 'Version, privacy policy and other information',
    href: '/(student)/about',
  },
] as const;

export default function StudentProfileScreen() {
  const router = useRouter();
  const { home, refreshHome } = useStudentPortal();

  useEffect(() => {
    void refreshHome();
  }, [refreshHome]);

  const studentName = home?.profile?.displayFullName?.trim() || 'Student';
  const program = home?.profile?.programName ?? home?.profile?.programLabel ?? 'Programme';
  const semester =
    home?.profile?.semesterLabel ??
    (home?.profile?.semesterSequence != null
      ? `Semester ${home.profile.semesterSequence}`
      : 'Semester');
  const roll = home?.profile?.rollNumber ?? '—';
  const feeDue = home?.fees?.due ?? 0;
  const unread = home?.unreadNotificationCount ?? 0;
  const enrollment = enrollmentStatus(home?.profile?.status);

  async function onLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <StudentScreenShell title="My Profile" subtitle="Account & documents">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.identity}>
          <StudentAvatar name={studentName} photoUrl={home?.profile?.photoUrl} size={72} />
          <View style={styles.identityText}>
            <Text style={styles.name}>{studentName}</Text>
            <Text style={styles.meta}>
              🎓 {program} • {semester}
            </Text>
            <Text style={styles.meta}>Roll No: {roll}</Text>
            <View style={styles.identityActions}>
              <View style={[styles.statusPill, { backgroundColor: enrollment.pill }]}>
                <Text style={[styles.statusPillText, { color: enrollment.color }]}>
                  {enrollment.pillLabel}
                </Text>
              </View>
              <Pressable
                style={styles.editBtn}
                onPress={() => router.push('/(student)/complete-profile' as never)}
              >
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpi, { backgroundColor: '#EFF6FF' }]}>
            <Text style={styles.kpiLabel}>Status</Text>
            <Text style={[styles.kpiValue, { color: enrollment.color }]}>{enrollment.value}</Text>
            <Text style={styles.kpiHint}>{enrollment.hint}</Text>
          </View>
          <Pressable
            style={[styles.kpi, { backgroundColor: '#FEF9C3' }]}
            onPress={() => router.push('/(student)/(tabs)/fees' as never)}
          >
            <Text style={styles.kpiLabel}>Outstanding Fees</Text>
            <Text style={styles.kpiValue}>{formatInr(feeDue)}</Text>
            <Text style={styles.kpiHint}>{feeDue > 0 ? 'Pending fees' : 'No Pending Fees'}</Text>
          </Pressable>
          <Pressable
            style={[styles.kpi, { backgroundColor: unread > 0 ? '#FEE2E2' : '#F3F4F6' }]}
            onPress={() => router.push('/(student)/(tabs)/notifications' as never)}
          >
            <Text style={styles.kpiLabel}>Notifications</Text>
            <Text style={[styles.kpiValue, unread > 0 ? { color: '#DC2626' } : null]}>
              {unread} Unread
            </Text>
            <Text style={styles.kpiHint}>View Notifications</Text>
          </Pressable>
        </View>

        {MENU.map((item) => (
          <Pressable
            key={item.id}
            style={styles.menuRow}
            onPress={() => router.push(item.href as never)}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.tint }]}>
              <Text style={styles.menuIconText}>{item.icon}</Text>
            </View>
            <View style={styles.menuCopy}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuBody}>{item.body}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        <Pressable
          style={styles.menuRow}
          onPress={() => router.push('/(auth)/change-password' as never)}
        >
          <View style={[styles.menuIcon, { backgroundColor: '#E0E7FF' }]}>
            <Text style={styles.menuIconText}>🔒</Text>
          </View>
          <View style={styles.menuCopy}>
            <Text style={styles.menuTitle}>Change Password</Text>
            <Text style={styles.menuBody}>Update the password for this account</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <DeviceSessionsPanel
          surfaceColor={studentTheme.surface}
          borderColor={studentTheme.border}
          textColor={studentTheme.text}
          mutedColor={studentTheme.textMuted}
        />

        <Pressable style={styles.logout} onPress={() => void onLogout()}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(student)/account-deletion' as never)}>
          <Text style={styles.deleteText}>Delete account</Text>
        </Pressable>
      </ScrollView>
    </StudentScreenShell>
  );
}

function enrollmentStatus(status?: string | null) {
  const key = (status ?? 'ACTIVE').toUpperCase();
  if (key === 'ACTIVE' || key === 'ENROLLED') {
    return {
      value: 'ACTIVE',
      hint: 'Currently Enrolled',
      pillLabel: 'Active Student',
      color: '#059669',
      pill: '#D1FAE5',
    };
  }
  return {
    value: key,
    hint: 'Contact Office',
    pillLabel: key,
    color: '#B45309',
    pill: '#FEF3C7',
  };
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, paddingBottom: 32 },
  identity: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  identityText: { flex: 1, gap: 3 },
  name: { fontSize: 18, fontWeight: '800', color: studentTheme.text, lineHeight: 24 },
  meta: { fontSize: 12, color: studentTheme.textMuted, fontWeight: '600' },
  identityActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  editBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editBtnText: { color: '#1D4ED8', fontSize: 11, fontWeight: '800' },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, borderRadius: 16, padding: 10, minHeight: 96, gap: 2 },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  kpiValue: { fontSize: 14, fontWeight: '800', color: studentTheme.text },
  kpiHint: { fontSize: 10, fontWeight: '600', color: '#4B5563' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconText: { fontSize: 18 },
  menuCopy: { flex: 1, gap: 2 },
  menuTitle: { fontSize: 14, fontWeight: '800', color: studentTheme.text },
  menuBody: { fontSize: 12, color: studentTheme.textMuted, lineHeight: 16 },
  chevron: { fontSize: 22, color: '#9CA3AF', fontWeight: '600' },
  logout: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#DC2626', fontWeight: '800' },
  deleteText: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
});
