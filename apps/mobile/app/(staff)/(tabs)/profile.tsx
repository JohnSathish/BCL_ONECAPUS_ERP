import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { logout } from '@/auth/logout';
import { DeviceSessionsPanel } from '@/components/auth/device-sessions-panel';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';
import { formatInr } from '@/utils/currency';
import { downloadAndSharePayslipPdf, fetchStaffPayslips } from '@/services/faculty-payroll';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/constants/release';

export default function FacultyProfileScreen() {
  const router = useRouter();
  const { home } = useFacultyPortal();
  const profile = home?.profile;
  const payroll = home?.payroll;
  const leave = home?.leaveBalance;

  return (
    <FacultyScreenShell title="Profile" subtitle="Account & security" showMenu={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <StudentAvatar
            name={profile?.fullName ?? 'Faculty'}
            photoUrl={profile?.photoUrl}
            size={72}
          />
          <Text style={styles.name}>{profile?.fullName ?? 'Faculty'}</Text>
          <Text style={styles.meta}>{profile?.designation ?? '—'}</Text>
          <Text style={styles.meta}>{profile?.department ?? '—'}</Text>
        </View>

        <InfoRow label="Employee ID" value={profile?.employeeCode ?? '—'} />
        <InfoRow label="Email" value={profile?.email ?? '—'} />
        <InfoRow
          label="Experience"
          value={profile?.experienceYears != null ? `${profile.experienceYears} years` : '—'}
        />
        <InfoRow
          label="Joining Date"
          value={
            profile?.joiningDate ? new Date(profile.joiningDate).toLocaleDateString('en-IN') : '—'
          }
        />

        <Text style={styles.section}>Leave Balance</Text>
        <InfoRow label="Casual" value={`${leave?.casual ?? 0} days`} />
        <InfoRow label="Medical" value={`${leave?.sick ?? 0} days`} />
        <InfoRow label="Earned" value={`${leave?.earned ?? 0} days`} />
        <Pressable style={styles.linkBtn} onPress={() => router.push('/(staff)/leave' as never)}>
          <Text style={styles.linkBtnText}>Apply leave →</Text>
        </Pressable>

        <Text style={styles.section}>Payroll</Text>
        <InfoRow label="Latest Salary" value={formatInr(payroll?.amount ?? 0)} />
        <InfoRow label="Status" value={payroll?.status ?? '—'} />
        <Pressable style={styles.linkBtn} onPress={() => router.push('/(staff)/payroll' as never)}>
          <Text style={styles.linkBtnText}>View payslips →</Text>
        </Pressable>

        <Text style={styles.section}>Notifications & app</Text>
        <Pressable
          style={styles.row}
          onPress={() => router.push('/(staff)/notification-preferences' as never)}
        >
          <Text style={styles.rowLabel}>Notification preferences</Text>
          <Text style={styles.rowValue}>→</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push('/(staff)/about' as never)}>
          <Text style={styles.rowLabel}>About app</Text>
          <Text style={styles.rowValue}>→</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>
          <Text style={styles.rowLabel}>Privacy policy</Text>
          <Text style={styles.rowValue}>→</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => void Linking.openURL(TERMS_URL)}>
          <Text style={styles.rowLabel}>Terms & conditions</Text>
          <Text style={styles.rowValue}>→</Text>
        </Pressable>

        <Text style={styles.section}>Security</Text>
        <Pressable
          style={styles.row}
          onPress={() => router.push('/(auth)/change-password' as never)}
        >
          <Text style={styles.rowLabel}>Change password</Text>
          <Text style={styles.rowValue}>→</Text>
        </Pressable>

        <DeviceSessionsPanel
          surfaceColor={facultyTheme.surface}
          borderColor={facultyTheme.border}
          textColor={facultyTheme.text}
          mutedColor={facultyTheme.textMuted}
        />

        <Pressable
          style={styles.payslipBtn}
          onPress={() => {
            void (async () => {
              try {
                const payslips = await fetchStaffPayslips();
                const latest = payslips[0];
                if (!latest?.id) return;
                await downloadAndSharePayslipPdf(
                  latest.id,
                  `Payslip_${latest.year}_${latest.month}`,
                );
              } catch {
                // optional
              }
            })();
          }}
        >
          <Text style={styles.payslipBtnText}>Download latest payslip</Text>
        </Pressable>

        <Pressable
          style={styles.logout}
          onPress={() => {
            void (async () => {
              await logout();
              router.replace('/(auth)/login');
            })();
          }}
        >
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </FacultyScreenShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8, paddingBottom: 32 },
  hero: { alignItems: 'center', gap: 6, marginBottom: 8 },
  name: { fontSize: 18, fontWeight: '800', color: facultyTheme.text },
  meta: { fontSize: 13, color: facultyTheme.textMuted, fontWeight: '600' },
  section: {
    fontSize: 14,
    fontWeight: '800',
    color: facultyTheme.text,
    marginTop: 10,
    marginBottom: 4,
  },
  row: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  rowLabel: { fontSize: 12, color: facultyTheme.textMuted, fontWeight: '600' },
  rowValue: {
    fontSize: 12,
    fontWeight: '700',
    color: facultyTheme.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  payslipBtn: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    alignItems: 'center',
  },
  payslipBtnText: { color: facultyTheme.primaryLight, fontWeight: '700', fontSize: 13 },
  linkBtn: {
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkBtnText: { color: facultyTheme.primaryLight, fontWeight: '700', fontSize: 13 },
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
