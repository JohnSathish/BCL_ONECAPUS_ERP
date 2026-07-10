import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { QUICK_ACTIONS } from '@/components/student-portal/drawer-menu';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';
import { DeviceSessionsPanel } from '@/components/auth/device-sessions-panel';
import { isMvpStudentCard } from '@/constants/release';
import { useMobileConfig } from '@/hooks/useMobileConfig';
import { ProfileCompletionCard } from '@/components/student-portal/profile-completion-card';
import {
  fetchStudentHomeWidgets,
  type StudentDashboardWidgets,
} from '@/services/student-dashboard';
import { formatInr } from '@/utils/currency';

export default function StudentHomeScreen() {
  const router = useRouter();
  const { cards } = useMobileConfig();
  const { home, refreshHome } = useStudentPortal();
  const [widgets, setWidgets] = useState<StudentDashboardWidgets | null>(null);

  useEffect(() => {
    void refreshHome();
    void fetchStudentHomeWidgets()
      .then(setWidgets)
      .catch(() => setWidgets(null));
  }, [refreshHome]);

  const studentName = home?.profile?.displayFullName ?? 'Student';
  const program =
    home?.profile?.programName ??
    home?.profile?.programLabel ??
    home?.profile?.department ??
    'Programme';
  const semester =
    home?.profile?.semesterLabel ??
    (home?.profile?.semesterSequence != null
      ? `Semester ${home?.profile.semesterSequence}`
      : 'Semester');
  const roll = home?.profile?.rollNumber ?? '—';
  const feeDue = home?.fees?.due ?? 0;
  const feePaid = home?.fees?.paid ?? 0;
  const feeTotal = feePaid + feeDue;
  const attendancePercent = home?.attendance?.percentage ?? null;
  const attendanceLabel = attendancePercent != null ? `${Math.round(attendancePercent)}%` : '—';
  const unread = home?.unreadNotificationCount ?? 0;
  const academicChips = home?.academicChips ?? [];
  const greeting = getGreeting();
  const feeProgressPercent =
    feeTotal > 0 ? Math.min(Math.round((feePaid / feeTotal) * 100), 100) : feeDue > 0 ? 8 : 100;
  const feeStatus = home?.fees?.status ?? (feeDue > 0 ? 'PENDING' : 'PAID');
  const timetableSlots = widgets?.timetable ?? [];
  const pendingAssignments = widgets?.lms?.pendingAssignments ?? 0;
  const issuedBooks = widgets?.library?.issuedBooks ?? 0;
  const examCgpa = widgets?.examinations?.cgpa;
  const noticePreview = widgets?.notifications?.notifications?.slice(0, 3) ?? [];
  const enabledCards = Object.entries(cards).filter(([key, on]) => on && isMvpStudentCard(key));

  function serviceRoute(key: string) {
    switch (key) {
      case 'attendance':
        return '/(student)/attendance';
      case 'fees':
        return '/(student)/(tabs)/fees';
      case 'timetable':
        return '/(student)/timetable';
      case 'lms':
        return '/(student)/assignments';
      case 'library':
        return '/(student)/library';
      case 'examinations':
        return '/(student)/exam-schedule';
      default:
        return '/(student)/(tabs)/notifications';
    }
  }

  return (
    <StudentScreenShell title={greeting} subtitle="Don Bosco College Student Portal">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.heroName}>{studentName}</Text>
              <Text style={styles.heroMeta}>
                {program} • {semester}
              </Text>
              <Text style={styles.heroMeta}>Roll No: {roll}</Text>
            </View>
            <StudentAvatar name={studentName} photoUrl={home?.profile?.photoUrl} size={52} />
          </View>
          <View style={styles.badgeRow}>
            <Badge label="Attendance" value={attendanceLabel} />
            <Badge label="Fees Due" value={formatInr(feeDue)} />
            <Badge label="Status" value={feeStatus} />
          </View>
        </View>

        <ProfileCompletionCard />

        {academicChips.length > 0 ? (
          <Pressable
            style={styles.snapshotCard}
            onPress={() => router.push('/(student)/(tabs)/academics' as never)}
          >
            <Text style={styles.sectionTitle}>📚 Academic Snapshot</Text>
            {academicChips.map((chip) => (
              <View key={`${chip.category}-${chip.courseTitle}`} style={styles.snapshotRow}>
                <Text style={styles.snapshotLabel}>{chip.label}</Text>
                <Text style={styles.snapshotValue}>{chip.courseTitle}</Text>
              </View>
            ))}
            <Text style={styles.actionText}>View Full Academic Profile →</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.snapshotCard}
            onPress={() => router.push('/(student)/(tabs)/academics' as never)}
          >
            <Text style={styles.sectionTitle}>📚 My Academics</Text>
            <Text style={styles.widgetLine}>
              View your Major, MDC, AEC, SEC, and VTC registration details.
            </Text>
            <Text style={styles.actionText}>Open My Academics →</Text>
          </Pressable>
        )}

        <Text style={styles.sectionHeading}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              style={styles.quickAction}
              onPress={() => router.push(action.href as never)}
            >
              <Text style={styles.quickIcon}>{action.icon}</Text>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.feeCard}
          onPress={() => router.push('/(student)/(tabs)/fees' as never)}
        >
          <Text style={styles.sectionTitle}>💰 Outstanding Fees</Text>
          <Text style={styles.feeValue}>{formatInr(feeDue)}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${feeProgressPercent}%` }]} />
          </View>
          <Text style={styles.actionText}>Pay now →</Text>
        </Pressable>

        <View style={styles.statsGrid}>
          <Stat label="Attendance" value={attendanceLabel} tone={studentTheme.success} />
          <Stat
            label="Subjects"
            value={`${academicChips.length || '—'}`}
            tone={studentTheme.primaryMuted}
          />
          <Stat label="Library" value={`${issuedBooks} Books`} tone={studentTheme.primaryMuted} />
          <Stat label="Alerts" value={`${unread} New`} tone="#7c3aed" />
        </View>

        <View style={styles.widgetCard}>
          <Text style={styles.sectionTitle}>📅 Today's Classes</Text>
          {timetableSlots.length > 0 ? (
            timetableSlots.slice(0, 4).map((slot, index) => (
              <Text key={`${slot.startTime}-${index}`} style={styles.widgetLine}>
                {slot.startTime ?? '—'}
                {slot.endTime ? ` – ${slot.endTime}` : ''} ·{' '}
                {slot.course?.title ?? slot.course?.code ?? 'Class'}
                {slot.isCurrent ? ' · Now' : ''}
              </Text>
            ))
          ) : (
            <Text style={styles.widgetLine}>No classes scheduled for today.</Text>
          )}
          <Pressable onPress={() => router.push('/(student)/timetable' as never)}>
            <Text style={styles.actionText}>View Full Timetable →</Text>
          </Pressable>
        </View>

        <View style={styles.widgetCard}>
          <Text style={styles.sectionTitle}>📝 Assignments</Text>
          {pendingAssignments > 0 ? (
            <Text style={styles.widgetLine}>
              • {pendingAssignments} assignment(s) pending submission
            </Text>
          ) : (
            <Text style={styles.widgetLine}>No pending assignments right now.</Text>
          )}
          <Pressable onPress={() => router.push('/(student)/assignments' as never)}>
            <Text style={styles.actionText}>View all assignments →</Text>
          </Pressable>
        </View>

        <View style={styles.widgetCard}>
          <Text style={styles.sectionTitle}>🎓 Examinations</Text>
          {examCgpa != null ? (
            <Text style={styles.examCount}>CGPA {examCgpa}</Text>
          ) : (
            <Text style={styles.widgetLine}>Examination details will appear when published.</Text>
          )}
          {widgets?.examinations?.hasAdmitCard ? (
            <Text style={styles.widgetLine}>• Admit card available</Text>
          ) : null}
          {widgets?.examinations?.hasResults ? (
            <Text style={styles.widgetLine}>• Results published</Text>
          ) : null}
          <Pressable onPress={() => router.push('/(student)/exam-schedule' as never)}>
            <Text style={styles.actionText}>Open exam schedule →</Text>
          </Pressable>
          {widgets?.examinations?.hasResults ? (
            <Pressable onPress={() => router.push('/(student)/results' as never)}>
              <Text style={styles.actionText}>View results →</Text>
            </Pressable>
          ) : null}
        </View>

        {unread > 0 || noticePreview.length > 0 ? (
          <Pressable
            style={styles.widgetCard}
            onPress={() => router.push('/(student)/(tabs)/notifications' as never)}
          >
            <Text style={styles.sectionTitle}>📢 Latest Notices</Text>
            {unread > 0 ? (
              <Text style={styles.widgetLine}>• {unread} unread notifications</Text>
            ) : null}
            {noticePreview.map((n) => (
              <Text key={n.id} style={styles.widgetLine}>
                • {n.title}
              </Text>
            ))}
            <Text style={styles.actionText}>Open notification center →</Text>
          </Pressable>
        ) : null}

        <View style={styles.widgetCard}>
          <Text style={styles.sectionTitle}>📚 Library</Text>
          <Text style={styles.widgetLine}>
            {issuedBooks > 0
              ? `${issuedBooks} book(s) currently issued`
              : 'No books issued currently'}
          </Text>
          {(widgets?.library?.finesDue ?? 0) > 0 ? (
            <Text style={styles.widgetLine}>
              Fine due: {formatInr(widgets?.library?.finesDue ?? 0)}
            </Text>
          ) : null}
          <Pressable onPress={() => router.push('/(student)/library' as never)}>
            <Text style={styles.actionText}>Open library →</Text>
          </Pressable>
        </View>

        <View style={styles.widgetCard}>
          <Text style={styles.sectionTitle}>✅ Academic Progress</Text>
          <Text style={styles.widgetLine}>
            {academicChips.length > 0
              ? `${academicChips.length} registered NEP subjects this semester`
              : 'Open My Academics to view your registration'}
          </Text>
          <Pressable onPress={() => router.push('/(student)/(tabs)/academics' as never)}>
            <Text style={styles.actionText}>View My Academics →</Text>
          </Pressable>
        </View>

        {enabledCards.length > 0 ? (
          <>
            <Text style={styles.sectionHeading}>Live Services</Text>
            <View style={styles.servicesRow}>
              {enabledCards.map(([key]) => {
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                return (
                  <Pressable
                    key={key}
                    style={styles.serviceChip}
                    onPress={() => router.push(serviceRoute(key) as never)}
                  >
                    <Text style={styles.serviceChipText}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </StudentScreenShell>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.badgePill}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeValue}>{value}</Text>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 24 },
  heroCard: {
    backgroundColor: studentTheme.primary,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerText: { flex: 1 },
  heroName: { color: '#fff', fontSize: 22, fontWeight: '700' },
  heroMeta: { color: '#dbeafe', fontSize: 13, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  badgePill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  badgeLabel: { color: '#bfdbfe', fontSize: 10, textTransform: 'uppercase' },
  badgeValue: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 },
  snapshotCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 6,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  snapshotLabel: { fontSize: 13, color: studentTheme.textMuted, fontWeight: '600' },
  snapshotValue: {
    flex: 1,
    fontSize: 13,
    color: studentTheme.text,
    fontWeight: '600',
    textAlign: 'right',
  },
  sectionHeading: { fontSize: 16, fontWeight: '700', color: studentTheme.text, marginTop: 4 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAction: {
    width: '23%',
    minWidth: 74,
    flexGrow: 1,
    backgroundColor: studentTheme.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  quickIcon: { fontSize: 20 },
  quickLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    color: studentTheme.text,
    textAlign: 'center',
  },
  feeCard: {
    borderWidth: 1,
    borderColor: '#facc15',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#fffbeb',
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: studentTheme.text },
  feeValue: { fontSize: 28, fontWeight: '700', color: '#854d0e', marginTop: 6 },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: studentTheme.primaryMuted },
  actionText: { color: studentTheme.primaryLight, fontWeight: '700', marginTop: 8, fontSize: 13 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '48%',
    borderRadius: 14,
    backgroundColor: studentTheme.surface,
    padding: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  statLabel: { fontSize: 12, color: studentTheme.textMuted },
  statValue: { marginTop: 4, fontSize: 18, fontWeight: '700' },
  widgetCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  widgetLine: { color: '#334155', marginTop: 5, fontSize: 13 },
  examCount: { fontSize: 28, fontWeight: '700', color: studentTheme.primary, marginTop: 4 },
  servicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: {
    backgroundColor: studentTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  serviceChipText: { color: studentTheme.text, fontSize: 13, fontWeight: '600' },
});
