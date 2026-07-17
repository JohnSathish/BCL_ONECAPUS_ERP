import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { BirthdaysTodayCard } from '@/components/notifications/birthdays-today-card';
import { FACULTY_QUICK_ACTIONS } from '@/components/faculty-portal/drawer-menu';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';
import type { FacultyPendingAction, FacultyTodayClass } from '@/types/faculty-home';
import { COLLEGE_NAME } from '@/constants/release';
import { formatInr } from '@/utils/currency';
import { downloadAndSharePayslipPdf, fetchStaffPayslips } from '@/services/faculty-payroll';
import { fetchStaffBirthdaysWidget, type BirthdaysWidget } from '@/services/student-dashboard';

const TONE_COLORS: Record<FacultyPendingAction['tone'], string> = {
  urgent: facultyTheme.urgent,
  warning: facultyTheme.warning,
  pending: facultyTheme.pending,
  info: facultyTheme.info,
  success: facultyTheme.accent,
};

const TONE_DOTS: Record<FacultyPendingAction['tone'], string> = {
  urgent: '🔴',
  warning: '🟠',
  pending: '🟡',
  info: '🔵',
  success: '🟢',
};

function greetingIcon(greeting?: string) {
  if (!greeting) return '👋';
  if (greeting.includes('Morning')) return '☀️';
  if (greeting.includes('Afternoon')) return '🌤️';
  return '🌙';
}

function formatSemester(n?: number | null) {
  if (n == null) return 'Semester';
  return `Semester ${n}`;
}

function formatTimeRange(cls: FacultyTodayClass) {
  return `${cls.startTime} – ${cls.endTime}`;
}

export default function FacultyHomeScreen() {
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
  const workload = home?.workloadSummary;
  const greeting = profile?.greeting ?? 'Good Morning';
  const name = profile?.fullName ?? 'Faculty';
  const honorific = name.startsWith('Prof') || name.startsWith('Dr') ? '' : 'Prof. ';
  const todayClasses = home?.todayClasses ?? [];
  const pendingActions = (home?.pendingActions ?? []).filter((action) =>
    ['attendance', 'marks', 'leave'].includes(action.id),
  );
  const myClasses = home?.myClasses ?? [];
  const notifications = home?.notifications ?? [];
  const leave = home?.leaveBalance;
  const payroll = home?.payroll;
  const analytics = home?.analytics;
  const performance = home?.performance;
  const calendarEvents = home?.calendarEvents ?? [];
  const teachingLoad = home?.teachingLoad;
  const academicYear = home?.academicContext?.session ?? '2026–27';

  const presentPercent =
    analytics?.attendanceSubmittedPercent ?? analytics?.staffAttendancePercent ?? 94;
  const absentPercent = Math.max(0, 100 - presentPercent);
  const assignmentCompletion = performance?.attendanceSubmittedPercent ?? 81;

  function onPendingAction(action: FacultyPendingAction) {
    if (action.id === 'attendance') router.push('/(staff)/(tabs)/attendance' as never);
    else if (action.id === 'marks') router.push('/(staff)/marks' as never);
    else if (action.id === 'leave') router.push('/(staff)/leave' as never);
  }

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
    <FacultyScreenShell title="Faculty Workspace" subtitle={COLLEGE_NAME}>
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
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={styles.greeting}>
                {greetingIcon(greeting)} {greeting}, {honorific}
                {name.split(' ')[0]}
              </Text>
              <Text style={styles.designation}>{profile?.designation ?? 'Faculty'}</Text>
              <Text style={styles.department}>{profile?.department ?? 'Department'}</Text>
              <Text style={styles.metaLine}>
                AY {academicYear} · {profile?.employeeCode ?? '—'}
              </Text>
            </View>
            <StudentAvatar name={name} photoUrl={profile?.photoUrl} size={56} />
          </View>

          <View style={styles.summaryRow}>
            <SummaryChip
              label="Today's Classes"
              value={String(workload?.classesToday ?? todayClasses.length)}
            />
            <SummaryChip
              label="Attendance Pending"
              value={String(workload?.attendancePending ?? 0)}
              urgent={(workload?.attendancePending ?? 0) > 0}
            />
            <SummaryChip label="Marks Pending" value={String(workload?.marksPending ?? 0)} />
            <SummaryChip label="Assignments" value={String(workload?.assignmentsPending ?? 0)} />
          </View>
        </View>

        <BirthdaysTodayCard
          data={birthdays}
          variant="staff"
          onPressNotifications={() => router.push('/(staff)/notifications' as never)}
        />

        {/* Today's schedule — top priority */}
        <SectionTitle
          title="Today's Classes"
          action="Full Timetable"
          onAction={() => router.push('/(staff)/timetable' as never)}
        />
        {todayClasses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No classes scheduled today</Text>
            <Text style={styles.emptySub}>
              Your unified Morning + Day shift timetable will appear here.
            </Text>
          </View>
        ) : (
          todayClasses.map((cls) => (
            <View key={cls.id} style={styles.classCard}>
              <View style={styles.classHeader}>
                <Text style={styles.classTime}>{formatTimeRange(cls)}</Text>
                {cls.shiftName ? (
                  <View style={styles.shiftBadge}>
                    <Text style={styles.shiftBadgeText}>{cls.shiftName}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.classSubject}>{cls.subject}</Text>
              <Text style={styles.classMeta}>
                {formatSemester(cls.semesterNo)}
                {cls.sectionCode ? ` · ${cls.sectionCode}` : ''}
                {cls.classroom ? ` · Room ${cls.classroom}` : ''}
              </Text>
              <Pressable
                style={styles.classAction}
                onPress={() => router.push('/(staff)/(tabs)/attendance' as never)}
              >
                <Text style={styles.classActionText}>
                  {cls.status === 'scheduled' ? 'Start Attendance' : 'View Class'}
                </Text>
              </Pressable>
            </View>
          ))
        )}

        {/* Pending actions */}
        {pendingActions.length > 0 ? (
          <>
            <SectionTitle title="Things Requiring Your Attention" />
            <View style={styles.pendingCard}>
              {pendingActions.map((action) => (
                <Pressable
                  key={action.id}
                  style={styles.pendingRow}
                  onPress={() => onPendingAction(action)}
                >
                  <Text style={styles.pendingDot}>{TONE_DOTS[action.tone]}</Text>
                  <Text style={[styles.pendingLabel, { color: TONE_COLORS[action.tone] }]}>
                    {action.label}
                  </Text>
                  <Text style={styles.pendingCount}>({action.count})</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* Quick actions */}
        <SectionTitle title="Quick Actions" />
        <View style={styles.quickGrid}>
          {FACULTY_QUICK_ACTIONS.map((action) => (
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

        {/* My classes */}
        {myClasses.length > 0 ? (
          <>
            <SectionTitle
              title="My Classes"
              action="View All"
              onAction={() => router.push('/(staff)/(tabs)/academics' as never)}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.classScroll}
            >
              {myClasses.map((cls) => (
                <View key={cls.id} style={styles.myClassCard}>
                  <Text style={styles.myClassSem}>{formatSemester(cls.semesterNo)}</Text>
                  <Text style={styles.myClassTitle} numberOfLines={2}>
                    {cls.courseTitle}
                  </Text>
                  <Text style={styles.myClassMeta}>{cls.studentCount ?? 0} Students</Text>
                  <Text style={styles.myClassMeta}>{cls.weeklyHours ?? 0} hrs/week</Text>
                  <Pressable
                    onPress={() => {
                      if (cls.offeringSectionId) {
                        router.push({
                          pathname: '/(staff)/class-roster/[sectionId]',
                          params: { sectionId: cls.offeringSectionId, title: cls.courseTitle },
                        } as never);
                      }
                    }}
                  >
                    <Text style={styles.myClassLink}>View roster →</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* Analytics */}
        <SectionTitle title="Academic Analytics" />
        <View style={styles.analyticsCard}>
          <AnalyticsBar
            label="Today's Attendance — Present"
            value={presentPercent}
            tone={facultyTheme.accent}
            suffix="%"
          />
          <AnalyticsBar
            label="Absent"
            value={absentPercent}
            tone={facultyTheme.urgent}
            suffix="%"
          />
          <AnalyticsBar
            label="Assignment Completion"
            value={assignmentCompletion}
            tone={facultyTheme.primaryLight}
            suffix="%"
          />
          <View style={styles.analyticsFooter}>
            <MiniStat
              label="Students Taught"
              value={String(analytics?.studentsTaught ?? performance?.studentsTaught ?? 0)}
            />
            <MiniStat
              label="Subjects"
              value={String(analytics?.assignedSubjects ?? performance?.assignedSubjects ?? 0)}
            />
          </View>
        </View>

        {/* Notifications */}
        <SectionTitle
          title="Notifications"
          action={`${home?.unreadNotificationCount ?? 0} unread`}
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

        {/* Leave + Payroll row */}
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

        {/* Performance */}
        <SectionTitle title="Faculty Performance" />
        <View style={styles.perfRow}>
          <PerfCard
            label="Attendance Submitted"
            value={`${performance?.attendanceSubmittedPercent ?? 98}%`}
            tone={facultyTheme.accent}
          />
        </View>

        {/* Department + Calendar */}
        <View style={styles.dualRow}>
          <View style={[styles.dualCard, styles.flex]}>
            <Text style={styles.dualTitle}>Department</Text>
            <Text style={styles.deptName}>{profile?.department ?? '—'}</Text>
            <Text style={styles.deptMeta}>Students: {analytics?.studentsTaught ?? '—'}</Text>
            <Text style={styles.deptMeta}>Courses: {teachingLoad?.assignedSubjects ?? '—'}</Text>
            <Text style={styles.deptMeta}>Sections: {teachingLoad?.sections ?? '—'}</Text>
          </View>
          <View style={[styles.dualCard, styles.flex]}>
            <Text style={styles.dualTitle}>Calendar</Text>
            {calendarEvents.slice(0, 3).map((ev) => (
              <Text key={ev.id} style={styles.calLine} numberOfLines={1}>
                {ev.date.slice(8, 10)} · {ev.title}
              </Text>
            ))}
            {calendarEvents.length === 0 ? (
              <Text style={styles.deptMeta}>No upcoming events</Text>
            ) : null}
          </View>
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
      ) : null}
    </View>
  );
}

function SummaryChip({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <View style={[styles.summaryChip, urgent && styles.summaryChipUrgent]}>
      <Text style={[styles.summaryValue, urgent && styles.summaryValueUrgent]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function AnalyticsBar({
  label,
  value,
  tone,
  suffix = '',
}: {
  label: string;
  value: number;
  tone: string;
  suffix?: string;
}) {
  return (
    <View style={styles.barWrap}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>
          {value}
          {suffix}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${Math.min(value, 100)}%`, backgroundColor: tone }]}
        />
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
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

function PerfCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.perfCard}>
      <Text style={[styles.perfValue, { color: tone }]}>{value}</Text>
      <Text style={styles.perfLabel}>{label}</Text>
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
  summaryValue: { fontSize: 20, fontWeight: '800', color: facultyTheme.text },
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
  emptyCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  emptySub: { fontSize: 12, color: facultyTheme.textMuted, marginTop: 4, lineHeight: 18 },
  classCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    borderLeftWidth: 4,
    borderLeftColor: facultyTheme.primaryLight,
  },
  classHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  classTime: { fontSize: 13, fontWeight: '800', color: facultyTheme.text },
  shiftBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  shiftBadgeText: { fontSize: 10, fontWeight: '700', color: facultyTheme.primaryLight },
  classSubject: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  classMeta: { fontSize: 12, color: facultyTheme.textMuted },
  classAction: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: facultyTheme.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  classActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pendingCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  pendingDot: { fontSize: 10 },
  pendingLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  pendingCount: { fontSize: 12, color: facultyTheme.textMuted, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '23%',
    flexGrow: 1,
    minWidth: 76,
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
  quickLabel: { fontSize: 10, fontWeight: '700', color: facultyTheme.text, textAlign: 'center' },
  classScroll: { gap: 10, paddingRight: 8 },
  myClassCard: {
    width: 180,
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  myClassSem: { fontSize: 11, fontWeight: '700', color: facultyTheme.primaryLight },
  myClassTitle: { fontSize: 14, fontWeight: '800', color: facultyTheme.text, minHeight: 36 },
  myClassMeta: { fontSize: 11, color: facultyTheme.textMuted },
  myClassLink: { fontSize: 12, fontWeight: '700', color: facultyTheme.primaryLight, marginTop: 4 },
  analyticsCard: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  barWrap: { gap: 6 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { fontSize: 12, color: facultyTheme.textMuted, fontWeight: '600' },
  barValue: { fontSize: 12, fontWeight: '800', color: facultyTheme.text },
  barTrack: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 999 },
  analyticsFooter: { flexDirection: 'row', gap: 10, marginTop: 4 },
  miniStat: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  miniStatValue: { fontSize: 16, fontWeight: '800', color: facultyTheme.text },
  miniStatLabel: { fontSize: 10, color: facultyTheme.textMuted, marginTop: 2, textAlign: 'center' },
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
  perfRow: { flexDirection: 'row', gap: 8 },
  perfCard: {
    flex: 1,
    backgroundColor: facultyTheme.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: facultyTheme.border,
  },
  perfValue: { fontSize: 15, fontWeight: '800' },
  perfLabel: { fontSize: 10, color: facultyTheme.textMuted, textAlign: 'center', marginTop: 4 },
  deptName: { fontSize: 14, fontWeight: '800', color: facultyTheme.text },
  deptMeta: { fontSize: 11, color: facultyTheme.textMuted },
  calLine: { fontSize: 11, color: facultyTheme.textMuted, lineHeight: 16 },
});
