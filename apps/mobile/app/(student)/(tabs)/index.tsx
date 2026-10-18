import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';
import { COLLEGE_MOTTO, COLLEGE_NAME, isMvpStudentCard } from '@/constants/release';
import { useMobileConfig } from '@/hooks/useMobileConfig';
import { ProfileCompletionCard } from '@/components/student-portal/profile-completion-card';
import { AcademicCalendarCard } from '@/components/student-portal/academic-calendar-card';
import { AcademicSnapshotCard } from '@/components/student-portal/academic-snapshot-card';
import { BirthdaysTodayCard } from '@/components/notifications/birthdays-today-card';
import {
  fetchStudentHomeWidgets,
  type StudentDashboardWidgets,
} from '@/services/student-dashboard';
import { formatInr } from '@/utils/currency';

export default function StudentHomeScreen() {
  const router = useRouter();
  const { cards } = useMobileConfig();
  const { home, refreshHome, openDrawer } = useStudentPortal();
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
  const accountStatus = statusCard(feeStatus);
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
    <StudentScreenShell
      title={`${greeting} ${greetingIcon(greeting)}`}
      subtitle={COLLEGE_NAME}
      motto={COLLEGE_MOTTO}
      rightSlot={
        <Pressable
          style={styles.bell}
          onPress={() => router.push('/(student)/(tabs)/notifications' as never)}
        >
          <Text style={styles.bellIcon}>🔔</Text>
          {unread > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              void refreshHome();
              void fetchStudentHomeWidgets()
                .then(setWidgets)
                .catch(() => setWidgets(null));
            }}
          />
        }
      >
        <View style={styles.identityCard}>
          <View style={styles.identityText}>
            <Text style={styles.heroName}>{studentName}</Text>
            <Text style={styles.heroMeta}>
              🎓 {program} • {semester}
            </Text>
            <Text style={styles.heroMeta}>Roll No: {roll}</Text>
            <Pressable
              style={styles.profileBtn}
              onPress={() => router.push('/(student)/(tabs)/profile' as never)}
            >
              <Text style={styles.profileBtnText}>View Profile →</Text>
            </Pressable>
          </View>
          <StudentAvatar name={studentName} photoUrl={home?.profile?.photoUrl} size={64} />
        </View>

        <View style={styles.kpiRow}>
          <KpiCard
            tint="#ECFDF5"
            value={attendanceLabel}
            label="Attendance"
            hint="Overall"
            onPress={() => router.push('/(student)/attendance' as never)}
          />
          <KpiCard
            tint="#FEF9C3"
            value={formatInr(feeDue)}
            label="Fees Due"
            hint={feeDue > 0 ? 'Pending' : 'No Pending Fees'}
            onPress={() => router.push('/(student)/(tabs)/fees' as never)}
          />
          <KpiCard
            tint={accountStatus.tint}
            value={accountStatus.value}
            label="Status"
            hint={accountStatus.hint}
            valueColor={accountStatus.color}
            onPress={() => router.push('/(student)/(tabs)/fees' as never)}
          />
        </View>

        <View style={styles.quickCard}>
          {HOME_ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              style={styles.quickAction}
              onPress={() => {
                if (action.id === 'more') {
                  openDrawer();
                  return;
                }
                router.push(action.href as never);
              }}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: action.tint }]}>
                <Text style={styles.quickIcon}>{action.icon}</Text>
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <ProfileCompletionCard />

        <BirthdaysTodayCard
          data={widgets?.birthdays}
          variant="student"
          onPressNotifications={() => router.push('/(student)/(tabs)/notifications' as never)}
        />

        <AcademicCalendarCard
          events={home?.calendarEvents ?? []}
          onViewAll={() => router.push('/(student)/calendar' as never)}
        />

        <AcademicSnapshotCard
          chips={academicChips}
          onOpen={() => router.push('/(student)/(tabs)/academics' as never)}
        />

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

const HOME_ACTIONS = [
  {
    id: 'academics',
    label: 'My Academics',
    icon: '📘',
    tint: '#DBEAFE',
    href: '/(student)/(tabs)/academics',
  },
  {
    id: 'exams',
    label: 'Examination',
    icon: '📋',
    tint: '#EDE9FE',
    href: '/(student)/exam-schedule',
  },
  {
    id: 'fees',
    label: 'Fees & Payments',
    icon: '₹',
    tint: '#D1FAE5',
    href: '/(student)/(tabs)/fees',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: '📊',
    tint: '#FFEDD5',
    href: '/(student)/attendance',
  },
  { id: 'more', label: 'More', icon: '▦', tint: '#F3F4F6', href: '' },
] as const;

function statusCard(status: string) {
  const key = status.toUpperCase();
  if (key === 'LOCKED')
    return { value: 'LOCKED', hint: 'Contact Office', tint: '#FEE2E2', color: '#DC2626' };
  if (key === 'PENDING')
    return { value: 'DUE', hint: 'Fees pending', tint: '#FFEDD5', color: '#C2410C' };
  return { value: 'CLEAR', hint: 'No hold', tint: '#ECFDF5', color: '#059669' };
}

function greetingIcon(greeting: string) {
  if (greeting.includes('Morning')) return '☀️';
  if (greeting.includes('Afternoon')) return '🌤️';
  return '🌙';
}

function KpiCard({
  tint,
  value,
  label,
  hint,
  valueColor,
  onPress,
}: {
  tint: string;
  value: string;
  label: string;
  hint: string;
  valueColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.kpiCard, { backgroundColor: tint }]} onPress={onPress}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.kpiHint} numberOfLines={2}>
        {hint}
      </Text>
    </Pressable>
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
  bell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 16 },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginTop: -6,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  identityText: { flex: 1, gap: 3 },
  heroName: { color: studentTheme.text, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  heroMeta: { color: studentTheme.textMuted, fontSize: 13, fontWeight: '600' },
  profileBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  profileBtnText: { color: '#1D4ED8', fontSize: 12, fontWeight: '800' },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiCard: { flex: 1, borderRadius: 16, padding: 10, minHeight: 96, gap: 2 },
  kpiLabel: { fontSize: 10, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase' },
  kpiValue: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  kpiHint: { fontSize: 11, fontWeight: '600', color: '#4B5563' },
  quickCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  quickAction: { flex: 1, alignItems: 'center', gap: 6 },
  quickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon: { fontSize: 18 },
  quickLabel: {
    fontSize: 10,
    fontWeight: '700',
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
