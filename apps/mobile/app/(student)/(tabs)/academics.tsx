import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StudentAvatar } from '@/components/student-portal/student-avatar';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';
import { categoryTone } from '@/components/student-portal/category-tones';
import {
  TodayClassesEmptyCard,
  WeeklyTimetablePanel,
} from '@/components/student-portal/weekly-timetable-panel';
import { fetchStudentAcademics } from '@/services/academics';
import type { AcademicSubjectCard, StudentAcademicsPayload } from '@/types/academics';

type AcademicsTab = 'subjects' | 'timetable' | 'results';

export default function StudentAcademicsScreen() {
  const router = useRouter();
  const { home } = useStudentPortal();
  const [data, setData] = useState<StudentAcademicsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedJourney, setExpandedJourney] = useState<number | null>(null);
  const [tab, setTab] = useState<AcademicsTab>('subjects');
  const [semesterOpen, setSemesterOpen] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<number | null>(null);

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
  const currentSemester = header?.semesterSequence ?? null;
  const viewingSemester = selectedSemester ?? currentSemester;
  const viewingCurrent = viewingSemester == null || viewingSemester === currentSemester;
  const subjects = viewingCurrent ? (data?.subjects ?? []) : [];
  const grouped = groupSubjects(subjects);
  const buckets = creditBuckets(subjects);
  const targetCredits = header?.targetCredits ?? 0;
  const completedCredits = 0;
  const progressPct = targetCredits > 0 ? Math.round((completedCredits / targetCredits) * 100) : 0;
  const studentName = home?.profile?.displayFullName || 'Student';
  const roll = home?.profile?.rollNumber;
  const programmeLine = joinProgramme(header?.programme, header?.department);
  const journeyPick = (data?.journey ?? []).find((sem) => sem.semesterSequence === viewingSemester);

  return (
    <StudentScreenShell title="My Academics" subtitle="NEP 2020 curriculum profile">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <View style={styles.identityCard}>
          <View style={styles.identityRow}>
            <StudentAvatar name={studentName} photoUrl={home?.profile?.photoUrl} size={64} />
            <View style={styles.identityText}>
              <Text style={styles.identityName}>{studentName}</Text>
              {roll ? <Text style={styles.identityRoll}>{roll}</Text> : null}
              <Text style={styles.identityProgramme}>{programmeLine}</Text>
            </View>
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>{header?.status ?? 'ACTIVE'}</Text>
            </View>
          </View>

          <View style={styles.tileGrid}>
            <InfoTile icon="📅" label="Academic Year" value={header?.academicYear ?? '—'} />
            <InfoTile icon="📘" label="Semester" value={header?.semesterLabel ?? '—'} />
            <InfoTile icon="🏛" label="Department" value={header?.department ?? '—'} />
            <InfoTile icon="🎓" label="Program" value={header?.programme ?? '—'} />
            <InfoTile icon="☀" label="Shift" value={header?.shift ?? '—'} />
            <InfoTile icon="📄" label="Curriculum" value={header?.curriculumVersion ?? '—'} />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.registrationCard}>
              <Text style={styles.registrationIcon}>
                {header?.registrationComplete ? '✅' : '⏳'}
              </Text>
              <View>
                <Text style={styles.tileLabel}>Registration</Text>
                <Text style={styles.registrationValue}>
                  {header?.registrationComplete
                    ? 'Complete'
                    : formatStatus(header?.registrationStatus)}
                </Text>
              </View>
            </View>
            <View style={styles.nepCard}>
              <Text style={styles.nepTitle}>NEP 2020</Text>
              <Text style={styles.nepBody}>
                Flexible, multidisciplinary learning for your future.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressHeading}>Semester Progress</Text>
            <Pressable style={styles.semesterPill} onPress={() => setSemesterOpen(true)}>
              <Text style={styles.semesterPillText}>
                {viewingSemester != null ? `Semester ${viewingSemester}` : 'Semester'}
              </Text>
              <Text style={styles.semesterCaret}>▾</Text>
            </Pressable>
          </View>
          <View style={styles.progressBody}>
            <View style={styles.progressCopy}>
              <Text style={styles.progressPercent}>{progressPct}%</Text>
              <Text style={styles.progressSemester}>
                {viewingSemester != null ? `Semester ${viewingSemester}` : 'Current semester'}
              </Text>
              <Text style={styles.progressCaption}>
                {completedCredits} of {targetCredits || journeyPick?.credits || 0} Credits Completed
              </Text>
            </View>
            <View style={styles.progressSide}>
              <Text style={styles.progressSideValue}>
                {completedCredits} / {targetCredits || journeyPick?.credits || 0}
              </Text>
              <Text style={styles.progressSideLabel}>Credits</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          {viewingCurrent ? (
            <View style={styles.bucketRow}>
              <BucketChip
                label="Major"
                done={0}
                total={buckets.major}
                tone="#059669"
                bg="#ECFDF5"
              />
              <BucketChip
                label="Minor"
                done={0}
                total={buckets.minor}
                tone="#2563EB"
                bg="#EFF6FF"
              />
              <BucketChip
                label="Others"
                done={0}
                total={buckets.others}
                tone="#7C3AED"
                bg="#F5F3FF"
              />
            </View>
          ) : (
            <Text style={styles.muted}>
              {journeyPick
                ? `${journeyPick.subjectCount} registered subjects • ${journeyPick.credits} credits`
                : 'No registration on this semester yet.'}
            </Text>
          )}
        </View>

        <View style={styles.tabRow}>
          {(
            [
              ['subjects', '📘', 'Subjects'],
              ['timetable', '📅', 'Timetable'],
              ['results', '📊', 'Results'],
            ] as const
          ).map(([key, icon, label]) => {
            const on = tab === key;
            return (
              <Pressable
                key={key}
                style={[styles.tabBtn, on && styles.tabBtnOn]}
                onPress={() => setTab(key)}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {icon} {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'subjects' ? (
          <>
            {Object.entries(grouped).map(([category, items]) => (
              <View key={category}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>
                    {sectionHeading(category, items[0]?.categoryLabel)}
                  </Text>
                  <Text style={styles.sectionCredits}>
                    {items.reduce((sum, item) => sum + item.credits, 0)} Credits
                  </Text>
                </View>
                {items.map((subject) => (
                  <SubjectCard key={subject.id} subject={subject} />
                ))}
              </View>
            ))}
            {subjects.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No registered subjects yet</Text>
                <Text style={styles.emptyBody}>
                  {viewingCurrent
                    ? 'Subject registration for this semester has not been completed. Contact the academic office if this looks incorrect.'
                    : 'Subject papers for this semester are kept with the registration record. Switch back to the current semester to see this term’s papers.'}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        {tab === 'timetable' ? (
          <>
            <Text style={styles.sectionTitle}>Today's Classes</Text>
            {(data?.todayClasses ?? []).length === 0 ? (
              <TodayClassesEmptyCard holidayTitle={data?.todayClosure?.title} />
            ) : (
              <View style={styles.widgetCard}>
                {data?.todayClasses.map((slot) => (
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
                ))}
              </View>
            )}
            <Text style={styles.sectionTitle}>Weekly Timetable</Text>
            <WeeklyTimetablePanel
              weeklyTimetable={data?.weeklyTimetable ?? []}
              todayClasses={data?.todayClasses}
            />
          </>
        ) : null}

        {tab === 'results' ? (
          (data?.internalMarks ?? []).length > 0 ? (
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
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Results are not published yet</Text>
              <Text style={styles.emptyBody}>
                Credit completion stays at 0 until the examination office publishes this semester’s
                results.
              </Text>
              <Pressable onPress={() => router.push('/(student)/results' as never)}>
                <Text style={styles.link}>Open results →</Text>
              </Pressable>
            </View>
          )
        ) : null}

        <Text style={styles.sectionTitle}>Attendance by Subject</Text>
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
                {row.totalSessions > 0 ? `${row.percentage.toFixed(0)}%` : '—'}
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
            label="Question Papers"
            available
            onPress={() => router.push('/(student)/question-papers' as never)}
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
      <Modal
        visible={semesterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSemesterOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSemesterOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select semester</Text>
            {(data?.journey ?? []).map((sem) => (
              <Pressable
                key={sem.semesterSequence}
                style={styles.modalRow}
                onPress={() => {
                  setSelectedSemester(sem.semesterSequence);
                  setSemesterOpen(false);
                }}
              >
                <Text style={styles.modalRowTitle}>{sem.label}</Text>
                <Text style={styles.muted}>
                  {sem.status === 'current' ? 'Current' : formatStatus(sem.status)} • {sem.credits}{' '}
                  credits
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  if (category === 'MINOR') return 'Minor Papers';
  if (category === 'INTERNSHIP') return 'Internship';
  return label ?? category;
}

function creditBuckets(subjects: AcademicSubjectCard[]) {
  return subjects.reduce(
    (totals, subject) => {
      if (subject.category === 'MAJOR') totals.major += subject.credits;
      else if (subject.category === 'MINOR') totals.minor += subject.credits;
      else totals.others += subject.credits;
      return totals;
    },
    { major: 0, minor: 0, others: 0 },
  );
}

function joinProgramme(programme?: string | null, department?: string | null) {
  const name = programme?.trim() || '';
  const dept = department?.trim() || '';
  if (!name) return dept || '—';
  if (!dept || name.toLowerCase().includes(dept.toLowerCase())) return name;
  return `${name} in ${dept}`;
}

function formatStatus(status?: string | null) {
  if (!status) return 'Not registered';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function InfoTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <View style={styles.tileCopy}>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={styles.tileValue}>{value}</Text>
      </View>
    </View>
  );
}

function BucketChip({
  label,
  done,
  total,
  tone,
  bg,
}: {
  label: string;
  done: number;
  total: number;
  tone: string;
  bg: string;
}) {
  return (
    <View style={[styles.bucket, { backgroundColor: bg }]}>
      <Text style={[styles.bucketText, { color: tone }]}>
        ✓ {label} {done}/{total}
      </Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function subjectIcon(category: string) {
  if (category === 'INTERNSHIP') return '💼';
  if (category === 'MINOR') return '📘';
  if (category === 'MAJOR') return '🌐';
  return '📄';
}

function SubjectCard({ subject }: { subject: AcademicSubjectCard }) {
  const tone = categoryTone(subject.category);
  return (
    <View style={styles.subjectCard}>
      <View style={[styles.subjectIcon, { backgroundColor: tone.bg }]}>
        <Text>{subjectIcon(subject.category)}</Text>
      </View>
      <View style={styles.subjectBody}>
        <View style={styles.subjectHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.categoryBadgeText, { color: tone.fg }]}>{subject.category}</Text>
          </View>
          <Text style={styles.subjectCredits}>{subject.credits} Credits</Text>
        </View>
        <Text style={styles.subjectCode}>{subject.courseCode}</Text>
        <Text style={styles.subjectTitle}>{subject.courseTitle}</Text>
        {subject.facultyName ? (
          <Text style={styles.subjectMeta}>Faculty: {subject.facultyName}</Text>
        ) : null}
        {subject.internalMarks ? (
          <Text style={styles.subjectMeta}>
            Internal: {subject.internalMarks.obtained}/{subject.internalMarks.max}
          </Text>
        ) : null}
      </View>
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
  identityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8EEF7',
    gap: 12,
  },
  identityRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  identityText: { flex: 1, gap: 2 },
  identityName: { fontSize: 18, fontWeight: '800', color: studentTheme.text },
  identityRoll: { fontSize: 13, color: studentTheme.textMuted, fontWeight: '700' },
  identityProgramme: { fontSize: 13, color: studentTheme.text, fontWeight: '600' },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: '#16A34A' },
  activeText: { color: '#15803D', fontSize: 10, fontWeight: '800' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    gap: 4,
  },
  tileIcon: { fontSize: 14 },
  tileCopy: { gap: 2 },
  tileLabel: { fontSize: 10, color: studentTheme.textMuted, fontWeight: '700' },
  tileValue: { fontSize: 12, fontWeight: '800', color: studentTheme.text },
  metaRow: { flexDirection: 'row', gap: 8 },
  registrationCard: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    padding: 10,
  },
  registrationIcon: { fontSize: 16 },
  registrationValue: { fontSize: 13, fontWeight: '800', color: '#15803D' },
  nepCard: { flex: 1.2, backgroundColor: '#EFF6FF', borderRadius: 14, padding: 10, gap: 2 },
  nepTitle: { fontSize: 13, fontWeight: '800', color: '#1D4ED8' },
  nepBody: { fontSize: 11, color: '#1E3A8A', lineHeight: 15 },
  progressHeading: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  semesterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  semesterPillText: { fontSize: 12, fontWeight: '700', color: studentTheme.text },
  semesterCaret: { fontSize: 10, color: studentTheme.textMuted },
  progressBody: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  progressCopy: { flex: 1, gap: 2 },
  progressPercent: { fontSize: 28, fontWeight: '800', color: studentTheme.text },
  progressSemester: { fontSize: 14, fontWeight: '800', color: studentTheme.text },
  progressCaption: { fontSize: 12, color: studentTheme.textMuted },
  progressSide: { alignItems: 'flex-end' },
  progressSideValue: { fontSize: 18, fontWeight: '800', color: '#2563EB' },
  progressSideLabel: { fontSize: 12, color: studentTheme.textMuted, fontWeight: '700' },
  bucketRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bucket: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  bucketText: { fontSize: 11, fontWeight: '800' },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabBtnOn: { backgroundColor: studentTheme.primary, borderColor: studentTheme.primary },
  tabText: { fontSize: 12, fontWeight: '800', color: studentTheme.text },
  tabTextOn: { color: '#fff' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionCredits: { fontSize: 12, fontWeight: '700', color: studentTheme.textMuted },
  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectBody: { flex: 1, gap: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    gap: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  modalRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalRowTitle: { fontSize: 14, fontWeight: '800', color: studentTheme.text },
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
    padding: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
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
    gap: 8,
    padding: 10,
  },
  featuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: studentTheme.border,
    borderLeftWidth: 4,
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
  tableTitle: { fontSize: 14, fontWeight: '700', color: studentTheme.text },
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
  classTime: { width: 72, fontSize: 12, fontWeight: '700', color: studentTheme.primaryLight },
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
