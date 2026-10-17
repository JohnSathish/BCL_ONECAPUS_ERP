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
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';
import {
  fetchFacultyWeekTimetable,
  formatTimetableTime,
  groupTimetableByDay,
  type FacultyTimetableSlot,
} from '@/services/faculty-timetable';

const BAR_COLORS = ['#16A34A', '#F59E0B', '#7C3AED', '#2563EB', '#DB2777'];

type DayGroup = ReturnType<typeof groupTimetableByDay>[number];

function colorFor(subject: string) {
  let hash = 0;
  for (const char of subject) hash = (hash + char.charCodeAt(0)) % BAR_COLORS.length;
  return BAR_COLORS[hash] ?? BAR_COLORS[0];
}

function minutesOf(value: string) {
  const match = formatTimetableTime(value).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return hour * 60 + Number(match[2]);
}

function dateForWeekday(dayOfWeek: number) {
  const now = new Date();
  const jsDay = now.getDay();
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + mondayOffset + dayOfWeek - 1,
  );
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortDay(label: string) {
  return label.replace(/\s*\(half day\)/i, '').slice(0, 3);
}

function academicYearLabel(session?: string | null) {
  const text = session?.trim();
  if (!text) return null;
  const years = text.match(/\d{4}\s*[-–]\s*\d{2,4}/);
  return `AY ${years ? years[0].replace(/\s/g, '') : text}`;
}

function parsePlanName(name?: string | null) {
  const parts = (name ?? '')
    .split('·')
    .map((part) => part.trim())
    .filter((part) => part && !/weekly routine/i.test(part));
  return {
    department: parts.find((part) => !/shift/i.test(part) && !/^(odd|even)$/i.test(part)) ?? null,
    shift: parts.find((part) => /shift/i.test(part)) ?? null,
    cycle: parts.find((part) => /^(odd|even)$/i.test(part)) ?? null,
  };
}

function unique(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
    ),
  ];
}

export default function FacultyTimetableScreen() {
  const { home } = useFacultyPortal();
  const [loading, setLoading] = useState(true);
  const [planName, setPlanName] = useState<string | null>(null);
  const [days, setDays] = useState<DayGroup[]>([]);
  const [department, setDepartment] = useState<string | null>(null);
  const [shift, setShift] = useState<string | null>(null);
  const [cycle, setCycle] = useState<string | null>(null);
  const [openFilter, setOpenFilter] = useState<'department' | 'shift' | 'cycle' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFacultyWeekTimetable();
      setPlanName(data.plan?.name ?? null);
      setDays(groupTimetableByDay(data));
    } catch {
      setPlanName(null);
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allSlots = useMemo(() => days.flatMap((day) => day.slots), [days]);
  const planBits = parsePlanName(planName);
  const departments = unique([...allSlots.map((slot) => slot.streamName), planBits.department]);
  const shifts = unique([...allSlots.map((slot) => slot.shiftName), planBits.shift]);
  const cycles = unique([...allSlots.map((slot) => slot.semesterMode), planBits.cycle]);

  useEffect(() => {
    if (!department && departments[0]) setDepartment(departments[0]);
    if (!shift && shifts[0]) setShift(shifts[0]);
    if (!cycle && cycles[0]) setCycle(cycles[0]);
  }, [cycle, cycles, department, departments, shift, shifts]);

  const visibleDays = useMemo(
    () =>
      days
        .map((day) => ({
          ...day,
          slots: day.slots.filter((slot) => {
            if (department && slot.streamName && slot.streamName !== department) return false;
            if (shift && slot.shiftName && slot.shiftName !== shift) return false;
            if (cycle && slot.semesterMode && slot.semesterMode !== cycle) return false;
            return true;
          }),
        }))
        .filter((day) => day.slots.length > 0),
    [cycle, days, department, shift],
  );

  const subjects = unique(visibleDays.flatMap((day) => day.slots.map((slot) => slot.subject)));
  const next = useMemo(() => nextClass(visibleDays), [visibleDays]);
  const yearLabel = academicYearLabel(home?.academicContext?.session);

  return (
    <FacultyScreenShell
      title="My Timetable"
      subtitle="Weekly teaching schedule"
      rightSlot={
        yearLabel ? (
          <View style={styles.yearChip}>
            <Text style={styles.yearText}>{yearLabel}</Text>
          </View>
        ) : null
      }
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <View style={styles.filters}>
          <FilterChip
            icon="🌿"
            label={department ?? 'Department'}
            options={departments}
            open={openFilter === 'department'}
            onToggle={() =>
              setOpenFilter((current) => (current === 'department' ? null : 'department'))
            }
            onSelect={(value) => {
              setDepartment(value);
              setOpenFilter(null);
            }}
          />
          <FilterChip
            icon="☀️"
            label={shift ?? 'Shift'}
            options={shifts}
            open={openFilter === 'shift'}
            onToggle={() => setOpenFilter((current) => (current === 'shift' ? null : 'shift'))}
            onSelect={(value) => {
              setShift(value);
              setOpenFilter(null);
            }}
          />
          <FilterChip
            icon="🗂️"
            label={cycle ?? 'Cycle'}
            options={cycles}
            open={openFilter === 'cycle'}
            onToggle={() => setOpenFilter((current) => (current === 'cycle' ? null : 'cycle'))}
            onSelect={(value) => {
              setCycle(value);
              setOpenFilter(null);
            }}
          />
        </View>

        {loading && visibleDays.length === 0 ? (
          <ActivityIndicator color={facultyTheme.primaryLight} style={{ marginTop: 24 }} />
        ) : visibleDays.length === 0 ? (
          <Text style={styles.empty}>No published timetable slots found for your account.</Text>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <SummaryCard
                tint="#ECFDF5"
                value={String(visibleDays.length)}
                label="Teaching Days This Week"
              />
              <SummaryCard
                tint="#F5F3FF"
                value={
                  next
                    ? `${shortDay(next.dayLabel)}, ${formatTimetableTime(next.slot.startTime)}`
                    : '—'
                }
                label={next ? `Next Class\n${next.slot.subject}` : 'Next Class'}
              />
              <SummaryCard tint="#EFF6FF" value={String(subjects.length)} label="Subjects" />
            </View>

            {visibleDays.map((day) => (
              <View key={day.dayOfWeek} style={styles.dayBlock}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{day.label}</Text>
                  <Text style={styles.dayDate}>{dateForWeekday(day.dayOfWeek)}</Text>
                </View>
                {day.slots.map((slot) => (
                  <SlotCard key={slot.id} slot={slot} />
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </FacultyScreenShell>
  );
}

function nextClass(days: DayGroup[]) {
  const now = new Date();
  const jsDay = now.getDay();
  const today = jsDay === 0 ? 7 : jsDay;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = days
    .flatMap((day) =>
      day.slots.map((slot) => ({ dayOfWeek: day.dayOfWeek, dayLabel: day.label, slot })),
    )
    .filter(
      (item) =>
        item.dayOfWeek > today ||
        (item.dayOfWeek === today && minutesOf(item.slot.startTime) > nowMinutes),
    )
    .sort(
      (a, b) =>
        a.dayOfWeek - b.dayOfWeek || minutesOf(a.slot.startTime) - minutesOf(b.slot.startTime),
    );
  if (upcoming[0]) return upcoming[0];
  const first = days
    .flatMap((day) =>
      day.slots.map((slot) => ({ dayOfWeek: day.dayOfWeek, dayLabel: day.label, slot })),
    )
    .sort(
      (a, b) =>
        a.dayOfWeek - b.dayOfWeek || minutesOf(a.slot.startTime) - minutesOf(b.slot.startTime),
    )[0];
  return first;
}

function FilterChip({
  icon,
  label,
  options,
  open,
  onToggle,
  onSelect,
}: {
  icon: string;
  label: string;
  options: string[];
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.filterWrap}>
      <Pressable style={styles.filterChip} onPress={options.length > 1 ? onToggle : undefined}>
        <Text style={styles.filterIcon}>{icon}</Text>
        <Text style={styles.filterLabel} numberOfLines={1}>
          {label}
        </Text>
        {options.length > 1 ? <Text style={styles.filterCaret}>▾</Text> : null}
      </Pressable>
      {open ? (
        <View style={styles.filterMenu}>
          {options.map((option) => (
            <Pressable key={option} style={styles.filterOption} onPress={() => onSelect(option)}>
              <Text style={styles.filterOptionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SummaryCard({ tint, value, label }: { tint: string; value: string; label: string }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: tint }]}>
      <Text style={styles.summaryValue} numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.summaryLabel} numberOfLines={3}>
        {label}
      </Text>
    </View>
  );
}

function SlotCard({ slot }: { slot: FacultyTimetableSlot }) {
  const bar = colorFor(slot.subject);
  return (
    <View style={styles.slotCard}>
      <View style={styles.timeCol}>
        <Text style={styles.slotTime}>{formatTimetableTime(slot.startTime)}</Text>
        <Text style={styles.slotTimeEnd}>{formatTimetableTime(slot.endTime)}</Text>
      </View>
      <View style={[styles.bar, { backgroundColor: bar }]} />
      <View style={styles.slotBody}>
        <Text style={styles.slotSubject}>{slot.subject}</Text>
        <View style={styles.badges}>
          {slot.semesterNo != null ? (
            <View style={[styles.badge, { backgroundColor: `${bar}22` }]}>
              <Text style={[styles.badgeText, { color: bar }]}>Sem {slot.semesterNo}</Text>
            </View>
          ) : null}
          {slot.shiftName ? (
            <View style={styles.shiftBadge}>
              <Text style={styles.shiftBadgeText}>{slot.shiftName}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 32 },
  yearChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  yearText: { color: '#1D4ED8', fontSize: 11, fontWeight: '800' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, zIndex: 2 },
  filterWrap: { position: 'relative' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 150,
  },
  filterIcon: { fontSize: 12 },
  filterLabel: { fontSize: 12, fontWeight: '700', color: facultyTheme.text, flexShrink: 1 },
  filterCaret: { color: '#6B7280', fontSize: 10 },
  filterMenu: {
    position: 'absolute',
    top: 40,
    left: 0,
    minWidth: 140,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 4,
    zIndex: 5,
    elevation: 4,
  },
  filterOption: { paddingHorizontal: 12, paddingVertical: 8 },
  filterOptionText: { fontSize: 13, fontWeight: '600', color: facultyTheme.text },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 10, minHeight: 92, gap: 4 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: facultyTheme.text },
  summaryLabel: { fontSize: 11, color: '#4B5563', fontWeight: '600' },
  empty: { fontSize: 13, color: facultyTheme.textMuted, marginTop: 8 },
  dayBlock: { gap: 8 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayTitle: { fontSize: 16, fontWeight: '800', color: facultyTheme.text },
  dayDate: { fontSize: 12, color: facultyTheme.textMuted, fontWeight: '600' },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  timeCol: { width: 72 },
  slotTime: { fontSize: 12, fontWeight: '800', color: facultyTheme.text },
  slotTimeEnd: { fontSize: 12, fontWeight: '600', color: facultyTheme.textMuted },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 99 },
  slotBody: { flex: 1, gap: 6 },
  slotSubject: { fontSize: 14, fontWeight: '800', color: facultyTheme.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  shiftBadge: {
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  shiftBadgeText: { fontSize: 11, fontWeight: '700', color: '#4B5563' },
});
