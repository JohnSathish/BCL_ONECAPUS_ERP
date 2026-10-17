import { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import {
  FACULTY_QUICK_ACTIONS,
  isTeachingStaffProfile,
} from '@/components/faculty-portal/drawer-menu';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { NonTeachingStaffHomeScreen } from '@/components/faculty-portal/non-teaching-staff-home';
import { facultyTheme } from '@/components/faculty-portal/theme';
import type { FacultyTodayClass } from '@/types/faculty-home';
import { COLLEGE_NAME } from '@/constants/release';

const HOME_ACTIONS = [
  'attendance',
  'marks',
  'timetable',
  'exam-duties',
  'notifications',
  'leave',
  'students',
  'calendar',
] as const;

const KPI_TONES = [
  { key: 'classes', label: "Today's Classes", bg: '#1D4ED8', fg: '#FFFFFF', soft: false },
  { key: 'attendance', label: 'Attendance Pending', bg: '#FEE2E2', fg: '#B91C1C', soft: true },
  { key: 'marks', label: 'Marks Pending', bg: '#FFEDD5', fg: '#C2410C', soft: true },
  { key: 'assignments', label: 'Assignments', bg: '#EDE9FE', fg: '#6D28D9', soft: true },
] as const;

function departmentLine(department?: string | null) {
  const text = department?.trim();
  if (!text) return 'Department';
  return /^department\b/i.test(text) ? text : `Department of ${text}`;
}

function yearLabel(session?: string | null) {
  const text = session?.trim();
  if (!text) return null;
  return /^ay\b/i.test(text) ? text : `AY ${text}`;
}

function splitClassDate(cls: FacultyTodayClass) {
  if (!cls.classDate) return { day: '—', month: cls.classDateLabel ?? '' };
  const date = new Date(`${cls.classDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { day: '—', month: cls.classDate ?? '' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
  };
}

export default function FacultyHomeScreen() {
  const router = useRouter();
  const { home, loading, refreshHome, openDrawer } = useFacultyPortal();

  useEffect(() => {
    void refreshHome();
  }, [refreshHome]);

  if (loading && !home) {
    return (
      <FacultyScreenShell title="Workspace" subtitle={COLLEGE_NAME}>
        <View style={styles.bootWrap}>
          <Text style={styles.bootText}>Loading your workspace…</Text>
        </View>
      </FacultyScreenShell>
    );
  }

  if (!isTeachingStaffProfile(home?.profile?.isTeaching)) {
    return <NonTeachingStaffHomeScreen />;
  }

  const profile = home?.profile;
  const workload = home?.workloadSummary;
  const greeting = profile?.greeting ?? 'Good Morning';
  const name = profile?.fullName?.trim() || 'Faculty';
  const todayClasses = home?.todayClasses ?? [];
  const unread = home?.unreadNotificationCount ?? 0;
  const academicYear = yearLabel(home?.academicContext?.session);
  const actions = HOME_ACTIONS.map((id) =>
    FACULTY_QUICK_ACTIONS.find((action) => action.id === id),
  ).filter((action): action is (typeof FACULTY_QUICK_ACTIONS)[number] => Boolean(action));
  const kpiValues: Record<(typeof KPI_TONES)[number]['key'], string> = {
    classes: String(
      workload?.classesToday ?? todayClasses.filter((cls) => cls.isToday !== false).length,
    ),
    attendance: String(workload?.attendancePending ?? 0),
    marks: String(workload?.marksPending ?? 0),
    assignments: String(workload?.assignmentsPending ?? 0),
  };

  function openKpi(key: (typeof KPI_TONES)[number]['key']) {
    if (key === 'classes') router.push('/(staff)/timetable' as never);
    else if (key === 'attendance') router.push('/(staff)/(tabs)/attendance' as never);
    else if (key === 'marks' || key === 'assignments') router.push('/(staff)/marks' as never);
  }

  function openClass(cls: FacultyTodayClass) {
    const sessionId = cls.attendanceSessionId || null;
    if (sessionId) {
      router.push({
        pathname: '/(staff)/mark-attendance/[sessionId]',
        params: {
          sessionId,
          date: cls.classDate ?? '',
          semester: cls.semesterNo != null ? String(cls.semesterNo) : '',
          subject: cls.subject,
          section: cls.sectionCode ?? '',
        },
      } as never);
      return;
    }
    router.push({
      pathname: '/(staff)/(tabs)/attendance',
      params: { date: cls.classDate ?? '', subject: cls.subject },
    } as never);
  }

  function openStudents(cls: FacultyTodayClass) {
    if (cls.offeringSectionId) {
      router.push({
        pathname: '/(staff)/class-roster/[sectionId]',
        params: { sectionId: cls.offeringSectionId, title: cls.subject },
      } as never);
      return;
    }
    router.push('/(staff)/(tabs)/students' as never);
  }

  return (
    <FacultyScreenShell
      title="Faculty Workspace"
      subtitle={COLLEGE_NAME}
      tone="brand"
      rightSlot={
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerIcon}
            onPress={() => router.push('/(staff)/(tabs)/notifications' as never)}
          >
            <Text style={styles.headerIconText}>🔔</Text>
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            style={styles.headerIconSolid}
            onPress={() => router.push('/(staff)/calendar' as never)}
          >
            <Text style={styles.headerIconText}>📅</Text>
          </Pressable>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void refreshHome()} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroText}>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.designation}>{profile?.designation ?? 'Faculty'}</Text>
              <Text style={styles.department}>{departmentLine(profile?.department)}</Text>
            </View>
            <View style={styles.avatarWrap}>
              <StudentAvatar name={name} photoUrl={profile?.photoUrl} size={64} />
              {profile?.online ? <View style={styles.onlineDot} /> : null}
            </View>
          </View>
          <View style={styles.heroFooter}>
            <Text style={styles.metaLine} numberOfLines={1}>
              {academicYear ? `🎓 ${academicYear}` : '🎓 Academic year'}
              {'   |   '}
              {profile?.employeeCode ?? '—'}
            </Text>
            <Pressable
              style={styles.profileBtn}
              onPress={() => router.push('/(staff)/(tabs)/profile' as never)}
            >
              <Text style={styles.profileBtnText}>View Profile →</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.kpiRow}>
          {KPI_TONES.map((kpi) => (
            <Pressable
              key={kpi.key}
              style={[styles.kpiCard, { backgroundColor: kpi.bg }]}
              onPress={() => openKpi(kpi.key)}
            >
              <Text style={[styles.kpiValue, { color: kpi.fg }]}>{kpiValues[kpi.key]}</Text>
              <Text
                style={[
                  styles.kpiLabel,
                  { color: kpi.soft ? '#374151' : 'rgba(255,255,255,0.92)' },
                ]}
              >
                {kpi.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Pressable onPress={openDrawer}>
            <Text style={styles.sectionAction}>View All →</Text>
          </Pressable>
        </View>
        <View style={styles.quickGrid}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              style={styles.quickCard}
              onPress={() => router.push(action.href as never)}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: `${action.tone}18` }]}>
                <Text style={styles.quickIcon}>{action.icon}</Text>
                {action.id === 'notifications' && unread > 0 ? (
                  <View style={styles.quickDot} />
                ) : null}
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Classes & Pending Attendance</Text>
          <Pressable onPress={() => router.push('/(staff)/timetable' as never)}>
            <Text style={styles.sectionAction}>Full Timetable →</Text>
          </Pressable>
        </View>
        {todayClasses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No classes scheduled today</Text>
            <Text style={styles.emptySub}>
              Published classes that still need attendance appear here.
            </Text>
          </View>
        ) : (
          todayClasses.map((cls) => {
            const date = splitClassDate(cls);
            const pending =
              Boolean(cls.attendancePending) || String(cls.status ?? '').toUpperCase() === 'OPEN';
            return (
              <View key={cls.id} style={styles.classCard}>
                <View style={[styles.dateCol, pending && styles.dateColPending]}>
                  <Text style={[styles.dateDay, pending && styles.dateDayPending]}>{date.day}</Text>
                  <Text style={styles.dateMonth}>{date.month}</Text>
                  {pending ? (
                    <View style={styles.pendingPill}>
                      <Text style={styles.pendingPillText}>Pending</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.classBody}>
                  <View style={styles.classTop}>
                    <Text style={styles.classTime}>
                      {cls.startTime} – {cls.endTime}
                    </Text>
                    {pending ? (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Attendance Pending</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.classSubject}>{cls.subject}</Text>
                  <Text style={styles.classMeta}>
                    {cls.semesterNo != null ? `Semester ${cls.semesterNo}` : 'Semester'}
                    {cls.sectionCode ? `   ·   Section ${cls.sectionCode}` : ''}
                  </Text>
                  <View style={styles.classButtons}>
                    <Pressable style={styles.markBtn} onPress={() => openClass(cls)}>
                      <Text style={styles.markBtnText}>Mark Attendance</Text>
                    </Pressable>
                    <Pressable style={styles.studentsBtn} onPress={() => openStudents(cls)}>
                      <Text style={styles.studentsBtnText}>View Students</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  bootWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  bootText: { fontSize: 14, color: facultyTheme.textMuted, fontWeight: '600' },
  container: { padding: 16, gap: 12, paddingBottom: 28 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconSolid: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: { fontSize: 16 },
  badge: {
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
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    gap: 14,
    marginTop: -8,
    borderWidth: 1,
    borderColor: '#E8EEF7',
  },
  heroTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  heroText: { flex: 1, gap: 2 },
  greeting: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  name: { fontSize: 22, fontWeight: '800', color: '#111827', lineHeight: 28 },
  designation: { fontSize: 14, fontWeight: '700', color: '#1D4ED8', marginTop: 2 },
  department: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  avatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaLine: { flex: 1, fontSize: 12, fontWeight: '700', color: '#4B5563' },
  profileBtn: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  profileBtnText: { color: '#1D4ED8', fontSize: 12, fontWeight: '800' },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: 16,
    padding: 10,
    justifyContent: 'space-between',
  },
  kpiValue: { fontSize: 26, fontWeight: '800' },
  kpiLabel: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: facultyTheme.text },
  sectionAction: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '22%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  quickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIcon: { fontSize: 18 },
  quickDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  quickLabel: { fontSize: 11, fontWeight: '700', color: facultyTheme.text, textAlign: 'center' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  emptySub: { fontSize: 12, color: facultyTheme.textMuted, marginTop: 4, lineHeight: 18 },
  classCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  dateCol: {
    width: 72,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  dateColPending: { backgroundColor: '#FEF2F2' },
  dateDay: { fontSize: 22, fontWeight: '800', color: '#111827' },
  dateDayPending: { color: '#B91C1C' },
  dateMonth: { fontSize: 11, fontWeight: '700', color: '#6B7280', textAlign: 'center' },
  pendingPill: {
    marginTop: 4,
    backgroundColor: '#FECACA',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingPillText: { fontSize: 9, fontWeight: '800', color: '#B91C1C' },
  classBody: { flex: 1, gap: 6 },
  classTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  classTime: { flex: 1, fontSize: 12, fontWeight: '700', color: '#4B5563' },
  pendingBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingBadgeText: { fontSize: 10, fontWeight: '800', color: '#B91C1C' },
  classSubject: { fontSize: 15, fontWeight: '800', color: '#111827', lineHeight: 20 },
  classMeta: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  classButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
  markBtn: {
    flex: 1,
    backgroundColor: '#123A7A',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  markBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  studentsBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 10,
    alignItems: 'center',
  },
  studentsBtnText: { color: '#1F2937', fontSize: 12, fontWeight: '800' },
});
