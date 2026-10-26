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
import { Ionicons } from '@expo/vector-icons';
import { fetchMyAttendance } from '@/services/attendance';
import type {
  AttendanceMark,
  AttendanceMarkStatus,
  AttendanceSubject,
  StudentAttendanceSummary,
} from '@/types/attendance';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PRESENT = '#16a34a';
const ABSENT = '#dc2626';
const LEAVE = '#d97706';
const MUTED_DOT = '#cbd5e1';

function subjectLabel(subject: AttendanceSubject) {
  const meta = subject.metadata ?? {};
  const title = meta.courseTitle ?? meta.courseCode ?? meta.title ?? subject.label;
  if (typeof title === 'string' && title) return title;
  return 'Subject';
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function dateKey(date: Date) {
  return (
    monthKey(date.getFullYear(), date.getMonth()) + `-${String(date.getDate()).padStart(2, '0')}`
  );
}

function monthTitle(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function parseMonthKey(key: string) {
  const [year, month] = key.split('-').map(Number);
  return { year, month: month - 1 };
}

function initialCursor(marks: AttendanceMark[]) {
  const now = new Date();
  const current = monthKey(now.getFullYear(), now.getMonth());
  if (marks.some((mark) => mark.date.startsWith(current))) {
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  const latest = [...marks].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;
  if (!latest) return { year: now.getFullYear(), month: now.getMonth() };
  return parseMonthKey(latest.slice(0, 7));
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ key: string; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < lead; i += 1) {
    const date = new Date(year, month, 1 - (lead - i));
    cells.push({ key: dateKey(date), day: date.getDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: dateKey(new Date(year, month, day)), day, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const [y, m, d] = cells[cells.length - 1].key.split('-').map(Number);
    const date = new Date(y, m - 1, d + 1);
    cells.push({ key: dateKey(date), day: date.getDate(), inMonth: false });
  }
  return cells;
}

function tone(percentage: number | null) {
  if (percentage == null) return studentTheme.text;
  if (percentage >= 75) return PRESENT;
  if (percentage >= 65) return LEAVE;
  return ABSENT;
}

function canonicalDate(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? value;
}

function normalizeMarkStatus(status: string): AttendanceMarkStatus | null {
  const value = status.trim().toLowerCase();
  if (value === 'present' || value === 'p' || value === 'l' || value === 'od') return 'present';
  if (value === 'absent' || value === 'a') return 'absent';
  if (value === 'leave' || value === 'ml') return 'leave';
  return null;
}

function dayStatus(marks: AttendanceMark[]): AttendanceMarkStatus | 'none' | 'empty' {
  const statuses = marks
    .map((mark) => normalizeMarkStatus(mark.status))
    .filter((status): status is AttendanceMarkStatus => Boolean(status));
  if (!statuses.length) return marks.length ? 'none' : 'empty';
  if (statuses.some((status) => status === 'absent')) return 'absent';
  if (statuses.some((status) => status === 'present')) return 'present';
  if (statuses.some((status) => status === 'leave')) return 'leave';
  return 'none';
}

function statusLabel(status: AttendanceMarkStatus) {
  if (status === 'absent') return 'Absent';
  if (status === 'leave') return 'Leave';
  return 'Present';
}

function statusColor(status: AttendanceMarkStatus | 'none' | 'empty') {
  if (status === 'absent') return ABSENT;
  if (status === 'leave') return LEAVE;
  if (status === 'present') return PRESENT;
  return MUTED_DOT;
}

function dayPaint(status: AttendanceMarkStatus | 'none' | 'empty', showGray: boolean) {
  if (status === 'present') return { backgroundColor: PRESENT, color: '#ffffff' };
  if (status === 'absent') return { backgroundColor: ABSENT, color: '#ffffff' };
  if (status === 'leave') return { backgroundColor: LEAVE, color: '#ffffff' };
  if (showGray || status === 'none') return { backgroundColor: '#cbd5e1', color: '#334155' };
  return { backgroundColor: 'transparent', color: studentTheme.text };
}

export default function StudentAttendanceScreen() {
  const [data, setData] = useState<StudentAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const summary = await fetchMyAttendance();
      setData(summary);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data || cursor) return;
    setCursor(initialCursor(data.marks ?? []));
  }, [data, cursor]);

  const marks = data?.marks ?? [];
  const subjects = data?.subjects ?? [];
  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  );

  const bounds = useMemo(() => {
    const keys = [...new Set(marks.map((mark) => mark.date.slice(0, 7)))].sort();
    const now = new Date();
    const todayIndex = now.getFullYear() * 12 + now.getMonth();
    const earliest = keys[0] ? parseMonthKey(keys[0]) : null;
    const latest = keys.at(-1) ? parseMonthKey(keys.at(-1) as string) : null;
    const min = earliest ? earliest.year * 12 + earliest.month : todayIndex;
    const max = Math.max(todayIndex, latest ? latest.year * 12 + latest.month : todayIndex);
    return { min, max };
  }, [marks]);

  const view = cursor ?? initialCursor(marks);
  const viewIndex = view.year * 12 + view.month;
  const key = monthKey(view.year, view.month);
  const todayKey = dateKey(new Date());

  const monthMarks = useMemo(() => marks.filter((mark) => mark.date.startsWith(key)), [marks, key]);

  const hasDaily = marks.length > 0;
  const presentCount = monthMarks.filter((mark) => mark.status === 'present').length;
  const absentCount = monthMarks.filter((mark) => mark.status === 'absent').length;
  const leaveCount = monthMarks.filter((mark) => mark.status === 'leave').length;
  const countedClasses = presentCount + absentCount + leaveCount;
  const monthPercentage = countedClasses
    ? Math.round((presentCount / countedClasses) * 1000) / 10
    : null;
  const semesterPresent = subjects.reduce(
    (sum, subject) => sum + Number(subject.presentCount ?? 0),
    0,
  );
  const semesterAbsent = subjects.reduce(
    (sum, subject) => sum + Number(subject.absentCount ?? 0),
    0,
  );
  const shownPresent = hasDaily ? presentCount : semesterPresent;
  const shownAbsent = hasDaily ? absentCount : semesterAbsent;
  const percentage = hasDaily
    ? monthPercentage
    : data?.overall == null
      ? null
      : Number(data.overall);

  const monthSubjects = useMemo(() => {
    const buckets = new Map<string, { present: number; absent: number; leave: number }>();
    for (const mark of monthMarks) {
      const bucket = buckets.get(mark.subjectId) ?? { present: 0, absent: 0, leave: 0 };
      bucket[mark.status] += 1;
      buckets.set(mark.subjectId, bucket);
    }
    return [...buckets.entries()]
      .map(([id, counts]) => {
        const total = counts.present + counts.absent + counts.leave;
        const pct = total ? Math.round((counts.present / total) * 1000) / 10 : 0;
        const subject = subjectById.get(id);
        return {
          id,
          label: subject ? subjectLabel(subject) : 'Subject',
          ...counts,
          total,
          percentage: pct,
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [monthMarks, subjectById]);

  const marksByDate = useMemo(() => {
    const map = new Map<string, AttendanceMark[]>();
    for (const mark of monthMarks) {
      const date = canonicalDate(mark.date);
      const list = map.get(date) ?? [];
      list.push(mark);
      map.set(date, list);
    }
    return map;
  }, [monthMarks]);

  const cells = monthCells(view.year, view.month);
  const selectedMarks = selectedDate ? (marksByDate.get(selectedDate) ?? []) : [];

  function shiftMonth(delta: number) {
    const next = viewIndex + delta;
    if (next < bounds.min || next > bounds.max) return;
    const year = Math.floor(next / 12);
    const month = next % 12;
    setCursor({ year, month });
    setSelectedDate(null);
  }

  if (loading && !data) {
    return (
      <StudentScreenShell title="Attendance" subtitle="Monthly attendance overview">
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={studentTheme.primary} />
          <Text style={styles.muted}>Loading attendance…</Text>
        </View>
      </StudentScreenShell>
    );
  }

  const pctText = percentage == null ? '—' : `${percentage.toFixed(1)}%`;
  const pctColor = tone(percentage);

  return (
    <StudentScreenShell title="Attendance" subtitle="Monthly attendance overview">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {message ? <Text style={styles.error}>{message}</Text> : null}

        <View style={styles.monthBar}>
          <Pressable
            style={[styles.monthBtn, viewIndex <= bounds.min && styles.monthBtnOff]}
            disabled={viewIndex <= bounds.min}
            onPress={() => shiftMonth(-1)}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={studentTheme.text} />
          </Pressable>
          <Text style={styles.monthTitle}>{monthTitle(view.year, view.month)}</Text>
          <Pressable
            style={[styles.monthBtn, viewIndex >= bounds.max && styles.monthBtnOff]}
            disabled={viewIndex >= bounds.max}
            onPress={() => shiftMonth(1)}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={18} color={studentTheme.text} />
          </Pressable>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpi, styles.kpiGood]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="stats-chart" size={16} color={PRESENT} />
            </View>
            <Text style={styles.kpiLabel}>Attendance</Text>
            <Text style={[styles.kpiValue, { color: pctColor }]}>{pctText}</Text>
          </View>
          <View style={[styles.kpi, styles.kpiGood]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="people" size={16} color={PRESENT} />
            </View>
            <Text style={styles.kpiLabel}>Present</Text>
            <Text style={styles.kpiValue}>{shownPresent}</Text>
          </View>
          <View style={[styles.kpi, styles.kpiBad]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="person-remove" size={16} color={ABSENT} />
            </View>
            <Text style={styles.kpiLabel}>Absent</Text>
            <Text style={[styles.kpiValue, { color: ABSENT }]}>{shownAbsent}</Text>
          </View>
        </View>

        <Text style={styles.section}>Subject-wise attendance</Text>
        {!hasDaily && subjects.length > 0 ? (
          subjects.map((subject) => {
            const value = Number(subject.percentage ?? 0);
            const total = Number(subject.totalSessions ?? 0);
            const present = Number(subject.presentCount ?? 0);
            const absent = Number(subject.absentCount ?? 0);
            return (
              <View key={subject.id} style={styles.subjectCard}>
                <View style={styles.subjectHeader}>
                  <Text style={styles.subjectTitle}>{subjectLabel(subject)}</Text>
                  <View style={[styles.badge, { borderColor: tone(value) }]}>
                    <Text style={[styles.badgeText, { color: tone(value) }]}>
                      {value.toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.subjectMeta}>
                  Present {present} / {total} classes{absent ? `  ·  Absent ${absent}` : ''}
                </Text>
                <View style={styles.barTrack}>
                  {present > 0 ? (
                    <View style={[styles.barFill, { flex: present, backgroundColor: PRESENT }]} />
                  ) : null}
                  {absent > 0 ? (
                    <View
                      style={[
                        styles.barFill,
                        { flex: Math.max(absent, 0), backgroundColor: ABSENT },
                      ]}
                    />
                  ) : null}
                </View>
              </View>
            );
          })
        ) : monthSubjects.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No classes marked this month</Text>
            <Text style={styles.muted}>
              Attendance appears here after your teachers save the class roll.
            </Text>
          </View>
        ) : (
          monthSubjects.map((subject) => {
            const presentFlex = subject.present;
            const absentFlex = subject.absent;
            const leaveFlex = subject.leave;
            return (
              <View key={subject.id} style={styles.subjectCard}>
                <View style={styles.subjectHeader}>
                  <Text style={styles.subjectTitle}>{subject.label}</Text>
                  <View style={[styles.badge, { borderColor: tone(subject.percentage) }]}>
                    <Text style={[styles.badgeText, { color: tone(subject.percentage) }]}>
                      {subject.percentage.toFixed(1)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.subjectMeta}>
                  Present {subject.present} / {subject.total} classes
                  {subject.absent ? `  ·  Absent ${subject.absent}` : ''}
                  {subject.leave ? `  ·  Leave ${subject.leave}` : ''}
                </Text>
                <View style={styles.barTrack}>
                  {presentFlex > 0 ? (
                    <View
                      style={[styles.barFill, { flex: presentFlex, backgroundColor: PRESENT }]}
                    />
                  ) : null}
                  {absentFlex > 0 ? (
                    <View style={[styles.barFill, { flex: absentFlex, backgroundColor: ABSENT }]} />
                  ) : null}
                  {leaveFlex > 0 ? (
                    <View style={[styles.barFill, { flex: leaveFlex, backgroundColor: LEAVE }]} />
                  ) : null}
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.section}>Attendance calendar</Text>
        <View style={styles.calendarCard}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((cell) => {
              const dayMarks = cell.inMonth ? (marksByDate.get(cell.key) ?? []) : [];
              const status = cell.inMonth ? dayStatus(dayMarks) : 'empty';
              const showGray =
                hasDaily && cell.inMonth && status === 'empty' && cell.key <= todayKey;
              const paint = cell.inMonth
                ? dayPaint(status, showGray)
                : { backgroundColor: 'transparent', color: '#d1d5db' };
              const selected = selectedDate === cell.key;
              return (
                <Pressable
                  key={cell.key}
                  style={styles.cell}
                  disabled={!cell.inMonth}
                  onPress={() =>
                    setSelectedDate((current) => (current === cell.key ? null : cell.key))
                  }
                >
                  <View
                    style={[
                      styles.dayCircle,
                      { backgroundColor: paint.backgroundColor },
                      selected && styles.dayCircleSelected,
                    ]}
                  >
                    <Text style={[styles.dayNum, { color: paint.color }]}>{cell.day}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {selectedDate ? (
            <View style={styles.dayDetail}>
              <Text style={styles.dayDetailTitle}>
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </Text>
              {selectedMarks.length === 0 ? (
                <Text style={styles.muted}>No class marked on this day.</Text>
              ) : (
                selectedMarks.map((mark, index) => (
                  <View key={`${mark.subjectId}-${index}`} style={styles.dayLine}>
                    <View style={[styles.dot, { backgroundColor: statusColor(mark.status) }]} />
                    <Text style={styles.dayLineText} numberOfLines={1}>
                      {subjectById.get(mark.subjectId)
                        ? subjectLabel(subjectById.get(mark.subjectId) as AttendanceSubject)
                        : 'Subject'}
                    </Text>
                    <Text style={[styles.dayLineStatus, { color: statusColor(mark.status) }]}>
                      {statusLabel(mark.status)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          <View style={styles.legend}>
            <LegendDot color={PRESENT} label="Present" />
            <LegendDot color={ABSENT} label="Absent" />
            <LegendDot color={MUTED_DOT} label="Holiday / No class" />
          </View>
        </View>
      </ScrollView>
    </StudentScreenShell>
  );
}

const cardShadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 36 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  muted: { fontSize: 13, color: studentTheme.textMuted, lineHeight: 18 },
  error: { color: ABSENT, fontSize: 14 },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    ...cardShadow,
  },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnOff: { opacity: 0.3 },
  monthTitle: { fontSize: 17, fontWeight: '700', color: studentTheme.text },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 92,
  },
  kpiGood: { backgroundColor: '#e8f8ef' },
  kpiBad: { backgroundColor: '#fdecec' },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  kpiValue: { marginTop: 2, fontSize: 18, fontWeight: '800', color: studentTheme.text },
  section: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '800',
    color: studentTheme.text,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 4,
    ...cardShadow,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: studentTheme.text },
  subjectCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    ...cardShadow,
  },
  subjectHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  subjectTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: studentTheme.text,
    lineHeight: 20,
  },
  badge: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  subjectMeta: { fontSize: 12, color: studentTheme.textMuted },
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
    flexDirection: 'row',
  },
  barFill: { height: '100%' },
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    gap: 8,
    ...cardShadow,
  },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    paddingVertical: 6,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.285%', alignItems: 'center', paddingVertical: 3 },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: { borderWidth: 2, borderColor: '#0f172a' },
  dayNum: { fontSize: 13, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendSwatch: { width: 12, height: 12, borderRadius: 6 },
  dayDetail: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    gap: 8,
  },
  dayDetailTitle: { fontSize: 14, fontWeight: '700', color: studentTheme.text },
  dayLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayLineText: { flex: 1, fontSize: 13, color: studentTheme.text },
  dayLineStatus: { fontSize: 12, fontWeight: '700' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 6,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: studentTheme.textMuted },
});
