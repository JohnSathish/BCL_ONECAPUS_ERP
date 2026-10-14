import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  fetchStudentExamAdmitCard,
  fetchStudentIaSchedule,
  formatExamTimeRange,
  type IaExamScheduleItem,
  type StudentExamAdmitCard,
} from '@/services/student-exams';

type TabKey = 'ia' | 'semester';
type When = 'next' | 'today' | 'later' | 'done';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

type DateParts = {
  year: number;
  monthIndex: number;
  day: number;
  weekday: (typeof WEEKDAYS)[number];
  month: (typeof MONTHS)[number];
};

function dateParts(value?: string | null): DateParts | null {
  const match = String(value ?? '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year,
    monthIndex,
    day,
    weekday: WEEKDAYS[date.getDay()] ?? 'SUN',
    month: MONTHS[monthIndex] ?? 'JAN',
  };
}

function clockMinutes(value?: string | null): number | null {
  if (!value) return null;
  const text = String(value).trim();
  const iso = text.match(/T(\d{2}):(\d{2})/);
  const plain = iso ? null : text.match(/^(\d{1,2}):(\d{2})/);
  const hour = iso ? Number(iso[1]) : plain ? Number(plain[1]) : null;
  const minute = iso ? Number(iso[2]) : plain ? Number(plain[2]) : null;
  if (hour == null || minute == null) return null;
  return hour * 60 + minute;
}

function durationLabel(start?: string | null, end?: string | null) {
  const from = clockMinutes(start);
  const to = clockMinutes(end);
  if (from == null || to == null || to <= from) return null;
  const mins = to - from;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours && rest) return `${hours} hr ${rest} min`;
  if (hours) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${rest} min`;
}

function sittingEnd(parts: DateParts | null, start?: string | null, end?: string | null) {
  if (!parts) return null;
  const mins = clockMinutes(end) ?? clockMinutes(start);
  if (mins == null) {
    return new Date(parts.year, parts.monthIndex, parts.day, 23, 59).getTime();
  }
  return new Date(
    parts.year,
    parts.monthIndex,
    parts.day,
    Math.floor(mins / 60),
    mins % 60,
  ).getTime();
}

function sameDay(parts: DateParts, now: Date) {
  return (
    parts.year === now.getFullYear() &&
    parts.monthIndex === now.getMonth() &&
    parts.day === now.getDate()
  );
}

function whenLabel(when: When) {
  if (when === 'next') return 'Next';
  if (when === 'today') return 'Today';
  if (when === 'done') return 'Done';
  return 'Upcoming';
}

function shortDate(parts: DateParts) {
  return `${parts.day} ${parts.month.charAt(0)}${parts.month.slice(1).toLowerCase()}`;
}

function IaScheduleCard({ item, when }: { item: IaExamScheduleItem; when: When }) {
  const parts = dateParts(item.examDate);
  const duration = durationLabel(item.startTime, item.endTime);
  return (
    <View
      style={[
        styles.examCard,
        when === 'next' && styles.examCardNext,
        when === 'done' && styles.examCardDone,
      ]}
    >
      <View style={[styles.dateRail, when === 'done' && styles.dateRailDone]}>
        <Text style={styles.dateMonth}>{parts?.month ?? '—'}</Text>
        <Text style={styles.dateDay}>{parts ? String(parts.day).padStart(2, '0') : '—'}</Text>
        <Text style={styles.dateYear}>{parts?.year ?? ''}</Text>
        <Text style={styles.dateWeek}>{parts?.weekday ?? ''}</Text>
      </View>
      <View style={styles.examBody}>
        <View style={styles.examTop}>
          <Text style={styles.examCode}>{item.paperCode ?? 'Paper'}</Text>
          <Text
            style={[
              styles.whenPill,
              when === 'next' && styles.whenNext,
              when === 'today' && styles.whenToday,
              when === 'done' && styles.whenDone,
            ]}
          >
            {whenLabel(when)}
          </Text>
        </View>
        <Text style={styles.examTitle}>{item.paperName ?? 'Internal Assessment'}</Text>
        <Text style={styles.examTime}>{formatExamTimeRange(item.startTime, item.endTime)}</Text>
        {duration ? <Text style={styles.examDuration}>{duration}</Text> : null}
      </View>
    </View>
  );
}

export default function StudentExamScheduleScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('ia');
  const [loading, setLoading] = useState(true);
  const [iaSchedule, setIaSchedule] = useState<IaExamScheduleItem[]>([]);
  const [admit, setAdmit] = useState<StudentExamAdmitCard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ia, semester] = await Promise.all([
        fetchStudentIaSchedule().catch(() => ({ schedule: [] })),
        fetchStudentExamAdmitCard().catch(() => null),
      ]);
      setIaSchedule(ia.schedule ?? []);
      setAdmit(semester);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const iaRows = useMemo(() => {
    const now = new Date();
    let nextMarked = false;
    return iaSchedule.map((item) => {
      const parts = dateParts(item.examDate);
      const end = sittingEnd(parts, item.startTime, item.endTime);
      let when: When = 'later';
      if (end != null && end < now.getTime()) when = 'done';
      else if (parts && sameDay(parts, now)) when = 'today';
      else if (!nextMarked) {
        when = 'next';
        nextMarked = true;
      }
      if (when === 'today') nextMarked = true;
      return { item, when, parts };
    });
  }, [iaSchedule]);

  const sessionTitle = useMemo(() => {
    const names = [
      ...new Set(iaSchedule.map((item) => item.sessionName?.trim()).filter(Boolean)),
    ] as string[];
    if (names.length === 1) return names[0];
    if (names.length > 1) return 'Internal assessments';
    return 'Internal assessment';
  }, [iaSchedule]);

  const dateSpan = useMemo(() => {
    const parts = iaRows.map((row) => row.parts).filter((part): part is DateParts => Boolean(part));
    if (!parts.length) return null;
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (!first || !last) return null;
    if (
      first.day === last.day &&
      first.monthIndex === last.monthIndex &&
      first.year === last.year
    ) {
      return shortDate(first);
    }
    return `${shortDate(first)} – ${shortDate(last)}`;
  }, [iaRows]);

  const semesterRows = useMemo(() => {
    const papers = admit?.papers ?? [];
    const seats = admit?.seats ?? [];
    const rooms = admit?.rooms ?? [];
    return seats.map((seat) => ({
      seat,
      paper: papers.find((paper) => paper.id === seat.paperId),
      room: rooms.find((room) => room.id === seat.classroomId),
    }));
  }, [admit]);

  return (
    <StudentScreenShell title="Exam Schedule" subtitle="Internal and semester examinations">
      <View style={styles.tabs}>
        <TabButton label="Internal (IA)" active={tab === 'ia'} onPress={() => setTab('ia')} />
        <TabButton
          label="Semester Exams"
          active={tab === 'semester'}
          onPress={() => setTab('semester')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : tab === 'ia' ? (
          iaRows.length === 0 ? (
            <EmptyState
              title="No internal schedule yet"
              body="Papers appear here after the college publishes the internal assessment timetable."
            />
          ) : (
            <>
              <View style={styles.summary}>
                <Text style={styles.summaryEyebrow}>Your papers</Text>
                <Text style={styles.summaryTitle}>{sessionTitle}</Text>
                <Text style={styles.summaryMeta}>
                  {iaRows.length} paper{iaRows.length === 1 ? '' : 's'}
                  {dateSpan ? ` · ${dateSpan}` : ''}
                  {iaSchedule.some((item) => item.revised) ? ' · Revised routine' : ''}
                </Text>
              </View>
              {iaRows.map(({ item, when }) => (
                <IaScheduleCard key={item.id} item={item} when={when} />
              ))}
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Reach the hall 15 minutes early</Text>
                <Text style={styles.noteBody}>
                  Carry this schedule and your college identity card. Follow the instructions on the
                  admit card.
                </Text>
              </View>
            </>
          )
        ) : admit?.feeBlocked ? (
          <View style={styles.blockCard}>
            <Text style={styles.blockTitle}>Hall ticket blocked</Text>
            <Text style={styles.blockBody}>
              Clear outstanding fees before semester exam seating is released.
              {admit.outstandingAmount != null
                ? ` Outstanding: ₹${Number(admit.outstandingAmount).toLocaleString('en-IN')}`
                : ''}
            </Text>
            {(admit.feeBlockReasons ?? []).map((reason) => (
              <Text key={reason} style={styles.blockReason}>
                • {reason}
              </Text>
            ))}
            <Pressable
              style={styles.linkBtn}
              onPress={() => router.push('/(student)/(tabs)/fees' as never)}
            >
              <Text style={styles.linkBtnText}>Go to Fees</Text>
            </Pressable>
          </View>
        ) : semesterRows.length === 0 ? (
          <EmptyState
            title="No semester seating yet"
            body="Room and seat details appear here after the examination cell publishes them."
          />
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryEyebrow}>Semester examination</Text>
              <Text style={styles.summaryTitle}>{admit?.session?.name || 'Semester exams'}</Text>
              <Text style={styles.summaryMeta}>
                {semesterRows.length} paper{semesterRows.length === 1 ? '' : 's'}
              </Text>
            </View>
            {semesterRows.map(({ seat, paper, room }) => {
              const parts = dateParts(paper?.examDate);
              const roomLabel = room
                ? `${room.code ?? ''} ${room.name ?? ''}`.trim()
                : 'Room to be announced';
              return (
                <View key={seat.id} style={styles.examCard}>
                  <View style={styles.dateRail}>
                    <Text style={styles.dateMonth}>{parts?.month ?? '—'}</Text>
                    <Text style={styles.dateDay}>
                      {parts ? String(parts.day).padStart(2, '0') : '—'}
                    </Text>
                    <Text style={styles.dateYear}>{parts?.year ?? ''}</Text>
                    <Text style={styles.dateWeek}>{parts?.weekday ?? ''}</Text>
                  </View>
                  <View style={styles.examBody}>
                    <Text style={styles.examCode}>{paper?.paperCode ?? 'Paper'}</Text>
                    <Text style={styles.examTitle}>
                      {paper?.paperName ?? 'Semester examination'}
                    </Text>
                    <Text style={styles.examTime}>
                      {formatExamTimeRange(paper?.startTime, paper?.endTime)}
                    </Text>
                    <Text style={styles.seatLine}>
                      {roomLabel}
                      {seat.seatNumber ? ` · Seat ${seat.seatNumber}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
            {admit?.instructions ? (
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Instructions</Text>
                <Text style={styles.noteBody}>{admit.instructions}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tabBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: studentTheme.surface,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  tabBtnActive: {
    backgroundColor: studentTheme.primaryLight,
    borderColor: studentTheme.primaryLight,
  },
  tabText: { fontSize: 13, fontWeight: '700', color: studentTheme.textMuted },
  tabTextActive: { color: '#fff' },
  container: { padding: 16, gap: 12, paddingBottom: 32 },
  summary: {
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: studentTheme.primaryLight,
  },
  summaryTitle: { fontSize: 18, fontWeight: '800', color: studentTheme.text, lineHeight: 24 },
  summaryMeta: { fontSize: 13, fontWeight: '600', color: studentTheme.textMuted, marginTop: 2 },
  examCard: {
    flexDirection: 'row',
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: studentTheme.border,
    overflow: 'hidden',
  },
  examCardNext: { borderColor: '#93c5fd' },
  examCardDone: { opacity: 0.72 },
  dateRail: {
    width: 74,
    backgroundColor: studentTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 1,
  },
  dateRailDone: { backgroundColor: '#64748b' },
  dateMonth: { color: '#bfdbfe', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  dateDay: { color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 30 },
  dateYear: { color: '#dbeafe', fontSize: 11, fontWeight: '700' },
  dateWeek: { color: '#fff', fontSize: 11, fontWeight: '800', marginTop: 4, letterSpacing: 0.6 },
  examBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  examTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  examCode: { fontSize: 12, fontWeight: '800', color: studentTheme.primaryLight },
  whenPill: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
    color: studentTheme.primaryLight,
    backgroundColor: '#eff6ff',
  },
  whenNext: { backgroundColor: studentTheme.primaryLight, color: '#fff' },
  whenToday: { backgroundColor: '#fef3c7', color: '#92400e' },
  whenDone: { backgroundColor: '#f1f5f9', color: '#64748b' },
  examTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text, lineHeight: 21 },
  examTime: { fontSize: 13, fontWeight: '700', color: studentTheme.text, marginTop: 2 },
  examDuration: { fontSize: 12, fontWeight: '600', color: studentTheme.textMuted },
  seatLine: { fontSize: 12, fontWeight: '700', color: studentTheme.textMuted, marginTop: 2 },
  noteCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 4,
  },
  noteTitle: { fontSize: 13, fontWeight: '800', color: '#92400e' },
  noteBody: { fontSize: 12, color: '#a16207', lineHeight: 18 },
  emptyCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  emptyBody: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 19 },
  blockCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 6,
  },
  blockTitle: { fontSize: 15, fontWeight: '800', color: '#991b1b' },
  blockBody: { fontSize: 13, color: '#b91c1c', lineHeight: 19 },
  blockReason: { fontSize: 12, color: '#b91c1c' },
  linkBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  linkBtnText: { color: studentTheme.primaryLight, fontWeight: '700', fontSize: 13 },
});
