import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BirthdaysTodayCard } from '@/components/notifications/birthdays-today-card';
import { STAFF_QUICK_ACTIONS } from '@/components/faculty-portal/drawer-menu';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { COLLEGE_NAME } from '@/constants/release';
import { formatInr } from '@/utils/currency';
import { downloadAndSharePayslipPdf, fetchStaffPayslips } from '@/services/faculty-payroll';
import { fetchStaffBirthdaysWidget, type BirthdaysWidget } from '@/services/student-dashboard';

function greetingIcon(greeting?: string) {
  if (!greeting) return '👋';
  if (greeting.includes('Morning')) return '☀️';
  if (greeting.includes('Afternoon')) return '🌤️';
  return '🌙';
}

/** Dedicated home for Lab Assistants, Admin, and other non-teaching staff. */
export function NonTeachingStaffHomeScreen() {
  const router = useRouter();
  const { home, loading, refreshHome } = useFacultyPortal();
  const [birthdays, setBirthdays] = useState<BirthdaysWidget | null>(null);

  useEffect(() => {
    void refreshHome();
    void fetchStaffBirthdaysWidget()
      .then((data) => setBirthdays(data))
      .catch(() => setBirthdays(null));
  }, [refreshHome]);

  const profile = home?.profile;
  const greeting = profile?.greeting ?? 'Good Morning';
  const name = profile?.fullName ?? 'Staff';
  const firstName = name.split(' ')[0] || name;
  const academicYear = home?.academicContext?.session ?? '2026–27';
  const leave = home?.leaveBalance;
  const payroll = home?.payroll;
  const notifications = home?.notifications ?? [];
  const calendarEvents = home?.calendarEvents ?? [];
  const unread = home?.unreadNotificationCount ?? 0;
  const leaveTotal = (leave?.casual ?? 0) + (leave?.sick ?? 0) + (leave?.earned ?? 0);
  const profileCompletion = profile?.profileCompletion ?? 0;
  const payslipLabel = payroll?.payslipAvailable ? 'Ready' : (payroll?.status ?? 'Processing');

  async function onDownloadPayslip() {
    try {
      const payslips = await fetchStaffPayslips();
      const latest = payslips[0];
      if (!latest?.id) {
        Alert.alert('No payslip', 'No published payslip is available yet.');
        return;
      }
      const label = `Payslip_${latest.year}_${String(latest.month).padStart(2, '0')}`;
      await downloadAndSharePayslipPdf(latest.id, label);
    } catch (e) {
      Alert.alert('Download failed', e instanceof Error ? e.message : 'Try again');
    }
  }

  return (
    <FacultyScreenShell title="Staff Workspace" subtitle={COLLEGE_NAME}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              void refreshHome();
              void fetchStaffBirthdaysWidget()
                .then(setBirthdays)
                .catch(() => setBirthdays(null));
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={styles.greeting}>
                {greetingIcon(greeting)} {greeting}, {firstName}
              </Text>
              <Text style={styles.designation}>{profile?.designation ?? 'Staff'}</Text>
              <Text style={styles.department}>{profile?.department ?? 'Department'}</Text>
              <Text style={styles.metaLine}>
                AY {academicYear} · {profile?.employeeCode ?? '—'}
              </Text>
            </View>
            <StudentAvatar name={name} photoUrl={profile?.photoUrl} size={56} />
          </View>

          <View style={styles.summaryRow}>
            <SummaryChip label="Leave Balance" value={String(leaveTotal)} />
            <SummaryChip label="Unread Alerts" value={String(unread)} urgent={unread > 0} />
            <SummaryChip label="Payslip" value={payslipLabel} />
            <SummaryChip label="Profile" value={`${profileCompletion}%`} />
          </View>
        </View>

        <BirthdaysTodayCard
          data={birthdays}
          variant="staff"
          onPressNotifications={() => router.push('/(staff)/(tabs)/notifications' as never)}
        />

        <SectionTitle title="Quick Actions" />
        <View style={styles.quickGrid}>
          {STAFF_QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              style={styles.quickCard}
              onPress={() => router.push(action.href as never)}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: `${action.tone}18` }]}>
                <Text style={styles.quickIcon}>{action.icon}</Text>
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle
          title="Notifications"
          action={`${unread} unread`}
          onAction={() => router.push('/(staff)/(tabs)/notifications' as never)}
        />
        <View style={styles.notifCard}>
          {(notifications.length > 0
            ? notifications
            : [{ id: 'none', title: 'No new notifications', body: '' }]
          )
            .slice(0, 5)
            .map((n) => (
              <View key={n.id} style={styles.notifRow}>
                <Text style={styles.notifIcon}>📣</Text>
                <View style={styles.notifText}>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  {n.body ? (
                    <Text style={styles.notifBody} numberOfLines={2}>
                      {n.body}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
        </View>

        <View style={styles.dualRow}>
          <Pressable
            style={[styles.dualCard, styles.flex]}
            onPress={() => router.push('/(staff)/leave' as never)}
          >
            <Text style={styles.dualTitle}>Leave Balance</Text>
            <LeaveLine label="Casual Leave" value={leave?.casual ?? 0} />
            <LeaveLine label="Medical Leave" value={leave?.sick ?? 0} />
            <LeaveLine label="Earned Leave" value={leave?.earned ?? 0} />
            <Text style={styles.payLink}>Apply leave →</Text>
          </Pressable>
          <View style={[styles.dualCard, styles.flex]}>
            <Text style={styles.dualTitle}>Payroll</Text>
            <Text style={styles.payAmount}>{formatInr(payroll?.amount ?? 0)}</Text>
            <Text style={styles.payStatus}>Status: {payroll?.status ?? '—'}</Text>
            <Pressable onPress={() => void onDownloadPayslip()}>
              <Text style={styles.payLink}>Download Payslip →</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.dualRow}>
          <View style={[styles.dualCard, styles.flex]}>
            <Text style={styles.dualTitle}>Department</Text>
            <Text style={styles.deptName}>{profile?.department ?? '—'}</Text>
            <Text style={styles.deptMeta}>{profile?.designation ?? 'Staff'}</Text>
            <Text style={styles.deptMeta}>Code: {profile?.employeeCode ?? '—'}</Text>
          </View>
          <Pressable
            style={[styles.dualCard, styles.flex]}
            onPress={() => router.push('/(staff)/calendar' as never)}
          >
            <Text style={styles.dualTitle}>Calendar</Text>
            {calendarEvents.slice(0, 3).map((ev) => (
              <Text key={ev.id} style={styles.calLine} numberOfLines={1}>
                {ev.date.slice(8, 10)} · {ev.title}
              </Text>
            ))}
            {calendarEvents.length === 0 ? (
              <Text style={styles.deptMeta}>No upcoming events</Text>
            ) : null}
            <Text style={styles.payLink}>Open calendar →</Text>
          </Pressable>
        </View>

        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Staff services</Text>
          <Text style={styles.helpBody}>
            Use Leave and Payslips for HR requests. College notices and notifications keep you
            updated on office circulars.
          </Text>
        </View>
      </ScrollView>
    </FacultyScreenShell>
  );
}

function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : action ? (
        <Text style={styles.sectionAction}>{action}</Text>
      ) : null}
    </View>
  );
}

function SummaryChip({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <View style={[styles.summaryChip, urgent && styles.summaryChipUrgent]}>
      <Text style={[styles.summaryValue, urgent && styles.summaryValueUrgent]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function LeaveLine({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.leaveRow}>
      <Text style={styles.leaveLabel}>{label}</Text>
      <Text style={styles.leaveValue}>{value} Remaining</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 28 },
  heroCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    shadowColor: '#111827',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  heroText: { flex: 1, gap: 3 },
  greeting: { fontSize: 17, fontWeight: '800', color: facultyTheme.text, lineHeight: 22 },
  designation: { fontSize: 14, fontWeight: '700', color: facultyTheme.primaryLight },
  department: { fontSize: 13, color: facultyTheme.textMuted, fontWeight: '600' },
  metaLine: { fontSize: 11, color: facultyTheme.textSubtle, marginTop: 2 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  summaryChipUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  summaryValue: { fontSize: 18, fontWeight: '800', color: facultyTheme.text },
  summaryValueUrgent: { color: facultyTheme.urgent },
  summaryLabel: { fontSize: 10, color: facultyTheme.textMuted, fontWeight: '600', marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: facultyTheme.text },
  sectionAction: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '30%',
    flexGrow: 1,
    minWidth: 96,
    alignItems: 'center',
    gap: 6,
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon: { fontSize: 20 },
  quickLabel: { fontSize: 11, fontWeight: '700', color: facultyTheme.text, textAlign: 'center' },
  notifCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  notifRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  notifIcon: { fontSize: 16, marginTop: 2 },
  notifText: { flex: 1, gap: 2 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: facultyTheme.text },
  notifBody: { fontSize: 12, color: facultyTheme.textMuted, lineHeight: 17 },
  dualRow: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  dualCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  dualTitle: { fontSize: 13, fontWeight: '800', color: facultyTheme.text, marginBottom: 2 },
  leaveRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  leaveLabel: { fontSize: 11, color: facultyTheme.textMuted },
  leaveValue: { fontSize: 11, fontWeight: '700', color: facultyTheme.text },
  payAmount: { fontSize: 18, fontWeight: '800', color: facultyTheme.text },
  payStatus: { fontSize: 11, color: facultyTheme.textMuted },
  payLink: { fontSize: 11, fontWeight: '700', color: facultyTheme.primaryLight, marginTop: 4 },
  deptName: { fontSize: 14, fontWeight: '800', color: facultyTheme.text },
  deptMeta: { fontSize: 11, color: facultyTheme.textMuted },
  calLine: { fontSize: 11, color: facultyTheme.textMuted, lineHeight: 16 },
  helpCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  helpTitle: { fontSize: 13, fontWeight: '800', color: facultyTheme.primaryDark },
  helpBody: { fontSize: 12, color: facultyTheme.textMuted, lineHeight: 18 },
});
