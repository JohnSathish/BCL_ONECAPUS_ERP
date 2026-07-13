import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import { fetchStudentAcademics } from '@/services/academics';
import type { AcademicSubjectCard, StudentAcademicsPayload } from '@/types/academics';

const CATEGORY_COLORS: Record<string, string> = {
  MAJOR: '#1d4ed8',
  MINOR: '#7c3aed',
  MDC: '#0d9488',
  AEC: '#d97706',
  SEC: '#be185d',
  VAC: '#64748b',
  VTC: '#2563eb',
};

export default function StudentAcademicsScreen() {
  const router = useRouter();
  const [data, setData] = useState<StudentAcademicsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedJourney, setExpandedJourney] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchStudentAcademics();
      setData(payload);
    } catch (e) {
      Alert.alert('Could not load academics', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <StudentScreenShell title="My Academics" subtitle="Your complete academic profile">
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={studentTheme.primary} />
          <Text style={styles.muted}>Loading your academic profile…</Text>
        </View>
      </StudentScreenShell>
    );
  }

  const header = data?.header;
  const subjects = data?.subjects ?? [];
  const grouped = groupSubjects(subjects);

  return (
    <StudentScreenShell title="My Academics" subtitle="NEP 2020 curriculum profile">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <View style={styles.headerCard}>
          <InfoRow label="Academic Year" value={header?.academicYear ?? '—'} />
          <InfoRow label="Programme" value={header?.programme ?? '—'} />
          <InfoRow label="Semester" value={header?.semesterLabel ?? '—'} />
          <InfoRow label="Shift" value={header?.shift ?? '—'} />
          <InfoRow label="Department" value={header?.department ?? '—'} />
          <InfoRow
            label="Registration"
            value={
              header?.registrationComplete ? 'Complete' : formatStatus(header?.registrationStatus)
            }
            tone={header?.registrationComplete ? studentTheme.success : studentTheme.warning}
          />
          <InfoRow label="Status" value={header?.status ?? 'ACTIVE'} tone={studentTheme.success} />
          {header?.curriculumVersion ? (
            <InfoRow label="Curriculum" value={header.curriculumVersion} />
          ) : null}
        </View>

        <SectionTitle>Semester Progress</SectionTitle>
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{header?.semesterLabel ?? 'Current Semester'}</Text>
            <Text style={styles.progressCredits}>
              {header?.totalCredits ?? 0} / {header?.targetCredits ?? 20} Credits
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, ((header?.totalCredits ?? 0) / (header?.targetCredits ?? 20)) * 100)}%`,
                },
              ]}
            />
          </View>
          <View style={styles.categoryChips}>
            {(data?.semesterProgress ?? []).map((item) => (
              <View
                key={item.category}
                style={[styles.categoryChip, item.registered && styles.categoryChipOn]}
              >
                <Text style={styles.categoryChipText}>
                  {item.registered ? '✓' : '○'} {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {Object.entries(grouped).map(([category, items]) => (
          <View key={category}>
            <SectionTitle>{sectionHeading(category, items[0]?.categoryLabel)}</SectionTitle>
            {items.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </View>
        ))}

        {subjects.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No registered subjects yet</Text>
            <Text style={styles.emptyBody}>
              Subject registration for this semester has not been completed. Contact the academic
              office if this looks incorrect.
            </Text>
          </View>
        ) : null}

        <SectionTitle>Faculty & Classroom</SectionTitle>
        <View style={styles.tableCard}>
          {subjects.map((subject) => (
            <View key={`faculty-${subject.id}`} style={styles.tableRow}>
              <View style={styles.tableMain}>
                <Text style={styles.tableTitle}>{subject.courseTitle}</Text>
                <Text style={styles.tableMeta}>
                  {subject.facultyName ? `Faculty: ${subject.facultyName}` : 'Faculty: TBA'}
                  {subject.room ? ` • Room ${subject.room}` : ''}
                </Text>
              </View>
              <Text style={styles.tableCredits}>{subject.credits} cr</Text>
            </View>
          ))}
        </View>

        <SectionTitle>Today's Classes</SectionTitle>
        <View style={styles.widgetCard}>
          {(data?.todayClasses ?? []).length === 0 ? (
            <Text style={styles.muted}>No classes scheduled for today.</Text>
          ) : (
            data?.todayClasses.map((slot) => (
              <View
                key={`${slot.time}-${slot.title}`}
                style={[styles.classRow, slot.isCurrent && styles.classRowCurrent]}
              >
                <Text style={styles.classTime}>{slot.time}</Text>
                <View style={styles.classBody}>
                  <Text style={styles.classTitle}>{slot.title}</Text>
                  {slot.room ? <Text style={styles.classMeta}>Room {slot.room}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>

        <SectionTitle>Weekly Timetable</SectionTitle>
        {(data?.weeklyTimetable ?? [])
          .filter((day) => day.slots.length > 0)
          .map((day) => (
            <View key={day.day} style={styles.widgetCard}>
              <Text style={styles.dayTitle}>{day.day}</Text>
              {day.slots.map((slot) => (
                <Text key={`${day.day}-${slot.time}-${slot.title}`} style={styles.widgetLine}>
                  {slot.time} — {slot.title}
                  {slot.room ? ` (${slot.room})` : ''}
                </Text>
              ))}
            </View>
          ))}

        <SectionTitle>Attendance by Subject</SectionTitle>
        <View style={styles.attendanceGrid}>
          {(data?.attendanceBySubject ?? []).map((row) => (
            <View key={row.label} style={styles.attendanceCard}>
              <Text style={styles.attendanceLabel}>{row.label}</Text>
              <Text
                style={[
                  styles.attendanceValue,
                  {
                    color:
                      row.percentage >= 75
                        ? studentTheme.success
                        : row.percentage >= 65
                          ? studentTheme.warning
                          : studentTheme.danger,
                  },
                ]}
              >
                {row.percentage.toFixed(0)}%
              </Text>
            </View>
          ))}
        </View>

        {(data?.internalMarks ?? []).length > 0 ? (
          <>
            <SectionTitle>Internal Marks</SectionTitle>
            <View style={styles.widgetCard}>
              {data?.internalMarks.map((mark) => (
                <View key={mark.label} style={styles.markRow}>
                  <Text style={styles.markLabel}>{mark.label}</Text>
                  <Text style={styles.markValue}>
                    {mark.obtained} / {mark.max}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {(data?.assignmentsDue ?? 0) > 0 ? (
          <>
            <SectionTitle>Assignments</SectionTitle>
            <Pressable
              style={styles.widgetCard}
              onPress={() => router.push('/(student)/assignments' as never)}
            >
              <Text style={styles.widgetLine}>{data?.assignmentsDue} assignment(s) due in LMS</Text>
              <Text style={styles.link}>Open assignments →</Text>
            </Pressable>
          </>
        ) : null}

        <SectionTitle>My Academic Journey</SectionTitle>
        <View style={styles.journeyCard}>
          {(data?.journey ?? []).map((sem) => {
            const expanded = expandedJourney === sem.semesterSequence;
            const icon = sem.status === 'completed' ? '✅' : sem.status === 'current' ? '🔵' : '⏳';
            return (
              <View key={sem.semesterSequence}>
                <Pressable
                  style={styles.journeyRow}
                  onPress={() => setExpandedJourney(expanded ? null : sem.semesterSequence)}
                >
                  <Text style={styles.journeyIcon}>{icon}</Text>
                  <View style={styles.journeyBody}>
                    <Text style={styles.journeyTitle}>{sem.label}</Text>
                    <Text style={styles.journeyMeta}>
                      {sem.status === 'current'
                        ? 'Current semester'
                        : sem.status === 'completed'
                          ? `${sem.subjectCount} subjects • ${sem.credits} credits`
                          : 'Upcoming'}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
                </Pressable>
                {expanded && sem.status !== 'upcoming' ? (
                  <View style={styles.journeyDetail}>
                    <Text style={styles.muted}>
                      Registration: {formatStatus(sem.registrationStatus)}
                    </Text>
                    <Text style={styles.muted}>
                      {sem.subjectCount} registered subjects • {sem.credits} credits
                    </Text>
                    {sem.status === 'current' ? (
                      <Pressable onPress={() => router.push('/(student)/attendance' as never)}>
                        <Text style={styles.link}>View attendance →</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <SectionTitle>Downloads</SectionTitle>
        <View style={styles.downloadRow}>
          <DownloadChip
            label="Subject List"
            available={data?.downloads.subjectListAvailable}
            onPress={() =>
              Alert.alert('Subject list', 'PDF export will be available in a future update.')
            }
          />
          <DownloadChip
            label="Syllabus"
            available={data?.downloads.syllabusAvailable}
            onPress={() => router.push('/(student)/syllabus' as never)}
          />
          <DownloadChip
            label="Curriculum"
            available={data?.downloads.curriculumAvailable}
            onPress={() =>
              Alert.alert(
                'Curriculum',
                header?.curriculumVersion
                  ? `Curriculum version: ${header.curriculumVersion}`
                  : 'Curriculum PDF will be available in a future update.',
              )
            }
          />
        </View>
      </ScrollView>
    </StudentScreenShell>
  );
}

function groupSubjects(subjects: AcademicSubjectCard[]) {
  const groups: Record<string, AcademicSubjectCard[]> = {};
  for (const subject of subjects) {
    const key = subject.category;
    if (!groups[key]) groups[key] = [];
    groups[key].push(subject);
  }
  return groups;
}

function sectionHeading(category: string, label?: string) {
  if (category === 'MAJOR') return 'Major Papers';
  return label ?? category;
}

function formatStatus(status?: string | null) {
  if (!status) return 'Not registered';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function InfoRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SubjectCard({ subject }: { subject: AcademicSubjectCard }) {
  const tone = CATEGORY_COLORS[subject.category] ?? studentTheme.primary;
  return (
    <View style={[styles.subjectCard, { borderLeftColor: tone }]}>
      <View style={styles.subjectHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: `${tone}18` }]}>
          <Text style={[styles.categoryBadgeText, { color: tone }]}>{subject.category}</Text>
        </View>
        <Text style={styles.subjectCredits}>{subject.credits} Credits</Text>
      </View>
      <Text style={styles.subjectCode}>{subject.courseCode}</Text>
      <Text style={styles.subjectTitle}>{subject.courseTitle}</Text>
      {subject.facultyName ? (
        <Text style={styles.subjectMeta}>Faculty: {subject.facultyName}</Text>
      ) : null}
      {subject.attendancePercent != null ? (
        <Text style={styles.subjectMeta}>Attendance: {subject.attendancePercent.toFixed(0)}%</Text>
      ) : null}
      {subject.internalMarks ? (
        <Text style={styles.subjectMeta}>
          Internal: {subject.internalMarks.obtained}/{subject.internalMarks.max}
        </Text>
      ) : null}
    </View>
  );
}

function DownloadChip({
  label,
  available,
  onPress,
}: {
  label: string;
  available?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.downloadChip, !available && styles.downloadChipDisabled]}
      onPress={onPress}
    >
      <Text style={styles.downloadChipText}>{label}</Text>
      <Text style={styles.downloadChipAction}>{available ? 'Download' : 'Soon'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  muted: { color: studentTheme.textMuted, fontSize: 13 },
  headerCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 8,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoLabel: { color: studentTheme.textMuted, fontSize: 13 },
  infoValue: {
    color: studentTheme.text,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'right',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: studentTheme.text,
    marginTop: 4,
  },
  progressCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 10,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: 15, fontWeight: '700', color: studentTheme.text },
  progressCredits: { fontSize: 13, color: studentTheme.primaryLight, fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: studentTheme.primaryMuted },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f1f5f9',
  },
  categoryChipOn: { backgroundColor: '#ecfdf5' },
  categoryChipText: { fontSize: 11, fontWeight: '600', color: studentTheme.text },
  subjectCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  subjectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  categoryBadgeText: { fontSize: 10, fontWeight: '800' },
  subjectCredits: { fontSize: 12, color: studentTheme.textMuted, fontWeight: '600' },
  subjectCode: { marginTop: 8, fontSize: 12, color: studentTheme.textMuted, fontWeight: '700' },
  subjectTitle: { marginTop: 2, fontSize: 16, fontWeight: '700', color: studentTheme.text },
  subjectMeta: { marginTop: 4, fontSize: 12, color: studentTheme.textMuted },
  emptyCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  emptyTitle: { fontWeight: '700', color: '#92400e' },
  emptyBody: { marginTop: 6, color: '#a16207', fontSize: 13, lineHeight: 19 },
  tableCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: studentTheme.border,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableMain: { flex: 1 },
  tableTitle: { fontSize: 14, fontWeight: '600', color: studentTheme.text },
  tableMeta: { marginTop: 2, fontSize: 12, color: studentTheme.textMuted },
  tableCredits: { fontSize: 12, fontWeight: '700', color: studentTheme.primaryLight },
  widgetCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 6,
  },
  widgetLine: { fontSize: 13, color: '#334155' },
  dayTitle: { fontSize: 14, fontWeight: '700', color: studentTheme.text, marginBottom: 4 },
  classRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  classRowCurrent: { backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 8 },
  classTime: { width: 52, fontSize: 12, fontWeight: '700', color: studentTheme.primaryLight },
  classBody: { flex: 1 },
  classTitle: { fontSize: 14, fontWeight: '600', color: studentTheme.text },
  classMeta: { fontSize: 12, color: studentTheme.textMuted, marginTop: 2 },
  attendanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attendanceCard: {
    width: '48%',
    backgroundColor: studentTheme.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  attendanceLabel: { fontSize: 12, color: studentTheme.textMuted },
  attendanceValue: { marginTop: 4, fontSize: 22, fontWeight: '700' },
  markRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  markLabel: { fontSize: 14, color: studentTheme.text },
  markValue: { fontSize: 14, fontWeight: '700', color: studentTheme.primary },
  journeyCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: studentTheme.border,
    overflow: 'hidden',
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  journeyIcon: { fontSize: 16 },
  journeyBody: { flex: 1 },
  journeyTitle: { fontSize: 14, fontWeight: '700', color: studentTheme.text },
  journeyMeta: { fontSize: 12, color: studentTheme.textMuted, marginTop: 2 },
  chevron: { fontSize: 11, color: studentTheme.textMuted },
  journeyDetail: { paddingHorizontal: 42, paddingBottom: 12, gap: 4 },
  downloadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  downloadChip: {
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: studentTheme.primary,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  downloadChipDisabled: { backgroundColor: '#94a3b8' },
  downloadChipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  downloadChipAction: { color: '#dbeafe', fontSize: 11, marginTop: 4 },
  link: { color: studentTheme.primaryLight, fontWeight: '700', marginTop: 6, fontSize: 13 },
});
