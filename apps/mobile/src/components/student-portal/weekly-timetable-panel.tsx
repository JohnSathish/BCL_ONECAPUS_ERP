import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { studentTheme } from '@/components/student-portal/theme';
import { categoryTone } from '@/components/student-portal/category-tones';
import type { TimetableSlot } from '@/types/academics';

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseMinutes(time?: string | null): number | null {
  const raw = String(time ?? '').trim();
  if (!raw) return null;
  const m12 = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2]);
    const p = m12[3]?.toUpperCase();
    if (p === 'PM' && h < 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  const m24 = raw.match(/^(\d{1,2}):(\d{2})/);
  if (m24) return Number(m24[1]) * 60 + Number(m24[2]);
  return null;
}

function formatClock(time?: string | null): string {
  const mins = parseMinutes(time);
  if (mins == null) {
    const raw = String(time ?? '').trim();
    return raw.replace(/:(\d{2}):\d{2}\b/, ':$1') || '—';
  }
  const h24 = Math.floor(mins / 60);
  const min = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
}

function formatRange(slot: TimetableSlot) {
  if (slot.startTime && slot.endTime) {
    return `${formatClock(slot.startTime)} – ${formatClock(slot.endTime)}`;
  }
  return slot.time?.replace(/–/g, '–').replace(/:(\d{2}):\d{2}/g, ':$1') || '—';
}

type TimelineItem =
  | { kind: 'class'; slot: TimetableSlot; key: string }
  | { kind: 'lunch'; start: string; end: string; key: string };

function buildTimeline(slots: TimetableSlot[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    items.push({ kind: 'class', slot, key: `c-${i}-${slot.startTime}-${slot.title}` });
    const next = slots[i + 1];
    if (!next) continue;
    const end = parseMinutes(slot.endTime ?? slot.time);
    const start = parseMinutes(next.startTime ?? next.time);
    if (end == null || start == null) continue;
    const gap = start - end;
    const mid = end + gap / 2;
    if (gap >= 25 && gap <= 50 && mid >= 11 * 60 + 20 && mid <= 13 * 60 + 30) {
      items.push({
        kind: 'lunch',
        start: formatClock(slot.endTime),
        end: formatClock(next.startTime),
        key: `lunch-${i}`,
      });
    }
  }
  return items;
}

function buildWeekDays(anchor = new Date()) {
  const base = new Date(anchor);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  monday.setHours(12, 0, 0, 0);

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dow = d.getDay();
    return {
      date: d,
      dayOfWeek: dow,
      short: DAY_SHORT[dow],
      dateLabel: d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      isToday:
        d.getFullYear() === anchor.getFullYear() &&
        d.getMonth() === anchor.getMonth() &&
        d.getDate() === anchor.getDate(),
    };
  });
}

export type WeeklyDayGroup = {
  day: string;
  dayOfWeek: number;
  slots: TimetableSlot[];
};

export function WeeklyTimetablePanel({
  weeklyTimetable,
  todayClasses,
  compactEmpty = false,
}: {
  weeklyTimetable: WeeklyDayGroup[];
  todayClasses?: TimetableSlot[];
  compactEmpty?: boolean;
}) {
  const weekDays = useMemo(() => buildWeekDays(new Date()), []);
  const defaultDow = (() => {
    const today = new Date().getDay();
    if (today >= 1 && today <= 6) return today;
    return 1;
  })();
  const [selectedDow, setSelectedDow] = useState(defaultDow);
  const [expandedDow, setExpandedDow] = useState<number | null>(defaultDow);

  const selectedDay = weekDays.find((d) => d.dayOfWeek === selectedDow) ?? weekDays[0];

  const daySlots = useMemo(() => {
    const fromWeek = weeklyTimetable.find((d) => d.dayOfWeek === selectedDow)?.slots ?? [];
    if (fromWeek.length) return fromWeek;
    if (selectedDow === new Date().getDay()) return todayClasses ?? [];
    return [];
  }, [weeklyTimetable, todayClasses, selectedDow]);

  const timeline = useMemo(() => buildTimeline(daySlots), [daySlots]);

  function slotsFor(dow: number) {
    const fromWeek = weeklyTimetable.find((d) => d.dayOfWeek === dow)?.slots ?? [];
    if (fromWeek.length) return fromWeek;
    if (dow === new Date().getDay()) return todayClasses ?? [];
    return [];
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayPicker}
      >
        {weekDays.map((d) => {
          const active = d.dayOfWeek === selectedDow;
          return (
            <Pressable
              key={d.dayOfWeek}
              onPress={() => {
                setSelectedDow(d.dayOfWeek);
                setExpandedDow(d.dayOfWeek);
              }}
              style={[styles.dayChip, active && styles.dayChipActive]}
            >
              <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                {d.short}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.dayHeader}>
        <View style={styles.dayHeaderLeft}>
          <Text style={styles.dayHeaderTitle}>{DAY_FULL[selectedDow]}</Text>
          <Text style={styles.dayHeaderDate}>{selectedDay?.dateLabel}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {daySlots.length} Class{daySlots.length === 1 ? '' : 'es'}
          </Text>
        </View>
      </View>

      {timeline.length === 0 ? (
        <View style={[styles.emptyCard, compactEmpty && styles.emptyCompact]}>
          <Text style={styles.emptyArt}>📅</Text>
          <Text style={styles.emptyTitle}>
            {selectedDay?.isToday
              ? 'No classes scheduled for today.'
              : `No classes scheduled for ${DAY_FULL[selectedDow]}.`}
          </Text>
          {!compactEmpty ? (
            <Text style={styles.emptySub}>
              {selectedDay?.isToday
                ? 'Enjoy your day! Pick another day above.'
                : 'Pick another day above to browse your week.'}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.timeline}>
          {timeline.map((item, index) => {
            const last = index === timeline.length - 1;
            if (item.kind === 'lunch') {
              return (
                <View key={item.key} style={styles.slotRow}>
                  <View style={styles.railCol}>
                    <View style={[styles.railDot, { backgroundColor: '#fb923c' }]} />
                    {!last ? <View style={styles.railLine} /> : null}
                  </View>
                  <View style={styles.timeCol}>
                    <Text style={[styles.timeText, { color: '#c2410c' }]}>
                      {item.start} – {item.end}
                    </Text>
                  </View>
                  <View style={styles.lunchCard}>
                    <Text style={styles.lunchIcon}>🍽️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lunchTitle}>Lunch Break</Text>
                      <Text style={styles.lunchSub}>Take a break and recharge!</Text>
                    </View>
                  </View>
                </View>
              );
            }

            const tone = categoryTone(item.slot.category);
            return (
              <View key={item.key} style={styles.slotRow}>
                <View style={styles.railCol}>
                  <View style={[styles.railDot, { backgroundColor: tone.dot }]} />
                  {!last ? <View style={styles.railLine} /> : null}
                </View>
                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>{formatRange(item.slot)}</Text>
                </View>
                <View
                  style={[
                    styles.classCard,
                    item.slot.isCurrent && styles.classCardLive,
                    { backgroundColor: studentTheme.surface },
                  ]}
                >
                  <View style={styles.classTop}>
                    {item.slot.courseCode ? (
                      <View style={[styles.codePill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.codePillText, { color: tone.fg }]}>
                          {item.slot.courseCode}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.codePill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.codePillText, { color: tone.fg }]}>
                          {item.slot.category || 'Class'}
                        </Text>
                      </View>
                    )}
                    {item.slot.category ? (
                      <View style={[styles.catPill, { backgroundColor: tone.soft }]}>
                        <Text style={[styles.catPillText, { color: tone.fg }]}>
                          {item.slot.category}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.classTitle} numberOfLines={2}>
                    {item.slot.title}
                  </Text>
                  <View style={styles.classBottom}>
                    <Text style={styles.faculty} numberOfLines={1}>
                      {item.slot.facultyName ? `👤 ${item.slot.facultyName}` : '👤 Faculty TBA'}
                    </Text>
                    {item.slot.room ? (
                      <Text style={styles.room} numberOfLines={1}>
                        📍 {item.slot.room}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.collapsedList}>
        {weekDays
          .filter((d) => d.dayOfWeek !== selectedDow)
          .map((d) => {
            const count = slotsFor(d.dayOfWeek).length;
            const open = expandedDow === d.dayOfWeek;
            return (
              <View key={d.dayOfWeek} style={styles.collapsedBlock}>
                <Pressable
                  style={styles.collapsedRow}
                  onPress={() => {
                    setSelectedDow(d.dayOfWeek);
                    setExpandedDow(d.dayOfWeek);
                  }}
                >
                  <View>
                    <Text style={styles.collapsedDay}>{DAY_FULL[d.dayOfWeek]}</Text>
                    <Text style={styles.collapsedDate}>{d.dateLabel}</Text>
                  </View>
                  <View style={styles.collapsedRight}>
                    <View style={styles.countBadgeMuted}>
                      <Text style={styles.countBadgeMutedText}>
                        {count} Class{count === 1 ? '' : 'es'}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
      </View>
    </View>
  );
}

export function TodayClassesEmptyCard() {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyArt}>🌤️</Text>
      <Text style={styles.emptyTitle}>No classes scheduled for today.</Text>
      <Text style={styles.emptySub}>Enjoy your day!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  dayPicker: { gap: 8, paddingRight: 4 },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: studentTheme.primaryLight,
    backgroundColor: '#fff',
    minWidth: 56,
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: studentTheme.primaryLight,
    borderColor: studentTheme.primaryLight,
  },
  dayChipText: { fontSize: 13, fontWeight: '800', color: studentTheme.primaryLight },
  dayChipTextActive: { color: '#fff' },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dayHeaderLeft: { gap: 2 },
  dayHeaderTitle: { fontSize: 18, fontWeight: '800', color: studentTheme.text },
  dayHeaderDate: { fontSize: 12, fontWeight: '600', color: studentTheme.textMuted },
  countBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countBadgeText: { fontSize: 11, fontWeight: '800', color: studentTheme.primaryLight },
  countBadgeMuted: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countBadgeMutedText: { fontSize: 11, fontWeight: '700', color: studentTheme.textMuted },
  emptyCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: studentTheme.border,
    alignItems: 'center',
    gap: 6,
  },
  emptyCompact: { padding: 14 },
  emptyArt: { fontSize: 28, marginBottom: 4 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: studentTheme.text, textAlign: 'center' },
  emptySub: { fontSize: 12, color: studentTheme.textMuted, textAlign: 'center' },
  timeline: { gap: 0 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    minHeight: 88,
    paddingBottom: 12,
  },
  railCol: {
    width: 14,
    alignItems: 'center',
    paddingTop: 6,
  },
  railDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 1,
  },
  railLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#e2e8f0',
    marginTop: 2,
    borderRadius: 1,
  },
  timeCol: { width: 78, paddingTop: 2 },
  timeText: {
    fontSize: 11,
    fontWeight: '800',
    color: studentTheme.primaryLight,
    lineHeight: 15,
  },
  classCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  classCardLive: {
    borderColor: '#6ee7b7',
    backgroundColor: '#f0fdf4',
  },
  classTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  codePill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codePillText: { fontSize: 10, fontWeight: '800' },
  catPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catPillText: { fontSize: 10, fontWeight: '800' },
  classTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: studentTheme.text,
    marginTop: 2,
    lineHeight: 19,
  },
  classBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
  faculty: { flex: 1, fontSize: 11, color: studentTheme.textMuted, fontWeight: '600' },
  room: { fontSize: 11, color: studentTheme.textMuted, fontWeight: '700' },
  lunchCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fdba74',
    padding: 12,
  },
  lunchIcon: { fontSize: 22 },
  lunchTitle: { fontSize: 14, fontWeight: '800', color: '#c2410c' },
  lunchSub: { fontSize: 11, color: '#9a3412', marginTop: 2, fontWeight: '600' },
  collapsedList: { gap: 8, marginTop: 4 },
  collapsedBlock: {
    backgroundColor: studentTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    overflow: 'hidden',
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  collapsedDay: { fontSize: 14, fontWeight: '800', color: studentTheme.text },
  collapsedDate: { fontSize: 11, color: studentTheme.textMuted, marginTop: 2, fontWeight: '600' },
  collapsedRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chevron: { fontSize: 14, color: studentTheme.textMuted },
});
