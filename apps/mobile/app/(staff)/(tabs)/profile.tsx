import { useState } from 'react';
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
import { STAFF_PORTAL_SALARY_VISIBLE } from '@/config/staff-salary-visible';

function serviceExperience(joiningDate?: string | null, storedYears?: number | null) {
  if (joiningDate) {
    const start = new Date(joiningDate);
    const now = new Date();
    if (!Number.isNaN(start.getTime()) && start <= now) {
      let years = now.getFullYear() - start.getFullYear();
      let months = now.getMonth() - start.getMonth();
      if (now.getDate() < start.getDate()) months -= 1;
      if (months < 0) {
        years -= 1;
        months += 12;
      }
      if (years > 0 && months > 0) {
        return `${years} year${years === 1 ? '' : 's'} ${months} month${months === 1 ? '' : 's'}`;
      }
      if (years > 0) return `${years} year${years === 1 ? '' : 's'}`;
      if (months > 0) return `${months} month${months === 1 ? '' : 's'}`;
      return 'Less than a month';
    }
  }
  if (storedYears != null && storedYears > 0) return `${storedYears} years`;
  return null;
}

function formatJoinDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export default function FacultyProfileScreen() {
  const router = useRouter();
  const { home } = useFacultyPortal();
  const profile = home?.profile;
  const payroll = home?.payroll;
  const leave = home?.leaveBalance;
  const [showDevices, setShowDevices] = useState(false);
  const completion = profile?.profileCompletion ?? 0;
  const experience = serviceExperience(profile?.joiningDate, profile?.experienceYears);
  const completionHint =
    completion >= 100
      ? null
      : experience
        ? 'Add the remaining details and documents to complete your profile.'
        : 'Add your experience and documents to complete your profile.';

  return (
    <FacultyScreenShell title="My Profile" subtitle="Account & Security" showMenu={false}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.identity}>
            <View style={styles.avatarWrap}>
              <StudentAvatar
                name={profile?.fullName ?? 'Faculty'}
                photoUrl={profile?.photoUrl}
                size={72}
              />
              {profile?.online ? <View style={styles.onlineDot} /> : null}
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{profile?.fullName ?? 'Faculty'}</Text>
              <Text style={styles.designation}>{profile?.designation ?? 'Staff'}</Text>
              <Text style={styles.metaLine}>{profile?.department ?? 'Department'}</Text>
              <Text style={styles.metaLine}>Employee ID: {profile?.employeeCode ?? '—'}</Text>
              {(profile?.additionalRoles?.length ?? 0) > 0 ? (
                <View style={styles.rolesRow}>
                  {profile?.isHod ? (
                    <View style={[styles.roleChip, styles.roleChipHod]}>
                      <Text style={[styles.roleChipText, styles.roleChipTextHod]}>HoD</Text>
                    </View>
                  ) : null}
                  {profile?.additionalRoles?.map((role) => (
                    <View key={role.code} style={styles.roleChip}>
                      <Text style={styles.roleChipText}>{role.label}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            <Pressable
              style={styles.editBtn}
              onPress={() => router.push('/(staff)/edit-profile' as never)}
            >
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.completionRow}>
            <Text style={styles.completionLabel}>Profile Completion</Text>
            <Text style={styles.completionPct}>{completion}%</Text>
          </View>
          <View style={styles.completionTrack}>
            <View style={[styles.completionFill, { width: `${Math.min(completion, 100)}%` }]} />
          </View>
          {completionHint ? <Text style={styles.completionHint}>{completionHint}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Basic Information</Text>
          <View style={styles.infoGrid}>
            <InfoCell icon="✉️" tint="#DBEAFE" label="Email" value={profile?.email ?? '—'} />
            <InfoCell
              icon="📅"
              tint="#DCFCE7"
              label="Joining Date"
              value={formatJoinDate(profile?.joiningDate)}
            />
            <InfoCell
              icon="🪪"
              tint="#EDE9FE"
              label="Employee ID"
              value={profile?.employeeCode ?? '—'}
            />
            <InfoCell
              icon="💼"
              tint="#FFEDD5"
              label="Experience"
              value={experience ?? 'Not added'}
              muted={!experience}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Leave Balance</Text>
          <View style={styles.leaveRow}>
            <LeaveCard
              tint="#ECFDF5"
              valueColor="#047857"
              label="Casual Leave"
              value={`${leave?.casual ?? 0} days`}
              onPress={() => router.push('/(staff)/leave' as never)}
            />
            <LeaveCard
              tint="#FEF2F2"
              valueColor="#BE123C"
              label="Medical Leave"
              value={`${leave?.sick ?? 0} days`}
              onPress={() => router.push('/(staff)/leave' as never)}
            />
            <LeaveCard
              tint="#EFF6FF"
              valueColor="#1D4ED8"
              label="Earned Leave"
              value={`${leave?.earned ?? 0} days`}
              onPress={() => router.push('/(staff)/leave' as never)}
            />
          </View>
        </View>

        {STAFF_PORTAL_SALARY_VISIBLE ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payroll</Text>
            <Text style={styles.payrollValue}>{formatInr(payroll?.amount ?? 0)}</Text>
            <Text style={styles.payrollStatus}>{payroll?.status ?? '—'}</Text>
            <Pressable
              style={styles.textLink}
              onPress={() => router.push('/(staff)/payroll' as never)}
            >
              <Text style={styles.textLinkLabel}>View payslips</Text>
            </Pressable>
            <Pressable
              style={styles.textLink}
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
              <Text style={styles.textLinkLabel}>Download latest payslip</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account & Security</Text>
          <ActionRow
            icon="🔧"
            tint="#DBEAFE"
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => router.push('/(staff)/security' as never)}
          />
          <ActionRow
            icon="💻"
            tint="#EDE9FE"
            title="Login & Devices"
            subtitle="Manage your active sessions"
            onPress={() => setShowDevices((open) => !open)}
          />
          {showDevices ? (
            <DeviceSessionsPanel
              surfaceColor="#F8FAFC"
              borderColor={facultyTheme.border}
              textColor={facultyTheme.text}
              mutedColor={facultyTheme.textMuted}
            />
          ) : null}
          <ActionRow
            icon="🔒"
            tint="#FEF3C7"
            title="Privacy Settings"
            subtitle="Manage your privacy preferences"
            onPress={() => router.push('/(staff)/notification-preferences' as never)}
          />
          <ActionRow
            icon="📄"
            tint="#E0F2FE"
            title="Privacy Policy"
            subtitle="How the campus app uses your data"
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          />
          <ActionRow
            icon="📘"
            tint="#E0E7FF"
            title="Terms & Conditions"
            subtitle="Read the app terms"
            onPress={() => void Linking.openURL(TERMS_URL)}
          />
          <ActionRow
            icon="ℹ️"
            tint="#F1F5F9"
            title="About App"
            subtitle="Version and support"
            onPress={() => router.push('/(staff)/about' as never)}
          />
          <ActionRow
            icon="🗑️"
            tint="#FEE2E2"
            title="Delete Account"
            subtitle="Request account deletion"
            onPress={() => router.push('/(staff)/account-deletion' as never)}
          />
        </View>

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

function InfoCell({
  icon,
  tint,
  label,
  value,
  muted,
}: {
  icon: string;
  tint: string;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.infoCell}>
      <View style={[styles.iconBubble, { backgroundColor: tint }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, muted && styles.infoMuted]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function LeaveCard({
  tint,
  valueColor,
  label,
  value,
  onPress,
}: {
  tint: string;
  valueColor: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.leaveCard, { backgroundColor: tint }]} onPress={onPress}>
      <Text style={[styles.leaveValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.leaveLabel}>{label}</Text>
    </Pressable>
  );
}

function ActionRow({
  icon,
  tint,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  tint: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <View style={[styles.iconBubble, { backgroundColor: tint }]}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 36 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EEF5',
    gap: 10,
  },
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarWrap: { position: 'relative' },
  identityText: { flex: 1, gap: 2, paddingTop: 2 },
  onlineDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: { fontSize: 16, fontWeight: '800', color: facultyTheme.text },
  designation: { fontSize: 12, color: facultyTheme.textMuted, fontWeight: '600' },
  metaLine: { fontSize: 12, color: '#374151', fontWeight: '600' },
  editBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  roleChip: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  roleChipHod: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  roleChipText: { fontSize: 10, fontWeight: '700', color: facultyTheme.primaryLight },
  roleChipTextHod: { color: '#92400E' },
  completionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  completionLabel: { fontSize: 13, fontWeight: '700', color: facultyTheme.text },
  completionPct: { fontSize: 13, fontWeight: '800', color: '#2563EB' },
  completionTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 99,
    overflow: 'hidden',
  },
  completionFill: { height: 8, borderRadius: 99, backgroundColor: '#2563EB' },
  completionHint: { fontSize: 12, color: facultyTheme.textMuted },
  cardTitle: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoCell: { width: '47%', flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  infoCopy: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 11, color: facultyTheme.textMuted, fontWeight: '600' },
  infoValue: { fontSize: 12, fontWeight: '800', color: facultyTheme.text },
  infoMuted: { color: '#9CA3AF', fontWeight: '700' },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 14 },
  leaveRow: { flexDirection: 'row', gap: 8 },
  leaveCard: { flex: 1, borderRadius: 14, padding: 10, gap: 4, minHeight: 78 },
  leaveValue: { fontSize: 16, fontWeight: '800' },
  leaveLabel: { fontSize: 11, color: '#4B5563', fontWeight: '600' },
  payrollValue: { fontSize: 18, fontWeight: '800', color: facultyTheme.text },
  payrollStatus: { fontSize: 12, color: facultyTheme.textMuted, fontWeight: '600' },
  textLink: { paddingVertical: 4 },
  textLinkLabel: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  actionCopy: { flex: 1, gap: 1 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  actionSubtitle: { fontSize: 11, color: facultyTheme.textMuted },
  chevron: { fontSize: 22, color: '#9CA3AF', fontWeight: '400' },
  logout: {
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#DC2626', fontWeight: '700' },
});
