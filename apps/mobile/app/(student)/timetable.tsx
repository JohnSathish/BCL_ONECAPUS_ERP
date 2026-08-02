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
import { LinearGradient } from 'expo-linear-gradient';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { useStudentPortal } from '@/components/student-portal/student-portal-context';
import { studentTheme } from '@/components/student-portal/theme';
import { fetchStudentAcademics } from '@/services/academics';
import type { StudentAcademicsPayload, TimetableSlot } from '@/types/academics';

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_THEME: Record<string, { bar: string; soft: string; label: string }> = {
  MAJOR: { bar: '#10b981', soft: '#ecfdf5', label: 'Major' },
  MINOR: { bar: '#8b5cf6', soft: '#f5f3ff', label: 'Minor' },
  MDC: { bar: '#f59e0b', soft: '#fffbeb', label: 'MDC' },
  AEC: { bar: '#3b82f6', soft: '#eff6ff', label: 'AEC' },
  SEC: { bar: '#a855f7', soft: '#faf5ff', label: 'SEC' },
  VAC: { bar: '#f43f5e', soft: '#fff1f2', label: 'VAC' },
  VTC: { bar: '#ea580c', soft: '#fff7ed', label: 'VTC' },
};

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
    return `${formatClock(slot.startTime)} - ${formatClock(slot.endTime)}`;
  }
  return slot.time?.replace(/–/g, '-').replace(/:(\d{2}):\d{2}/g, ':$1') || '—';
}

function minutesLeft(endTime?: string | null): number | null {
  const end = parseMinutes(endTime);
  if (end == null) return null;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, end - current);
}

function minutesUntil(startTime?: string | null): number | null {
  const start = parseMinutes(startTime);
  if (start == null) return null;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, start - current);
}

function categoryTheme(category?: string | null) {
  const key = String(category ?? '').toUpperCase();
  return (
    CATEGORY_THEME[key] ?? {
      bar: studentTheme.primaryLight,
      soft: '#eff6ff',
      label: key || 'Class',
    }
  );
}

function buildWeekDays(anchor = new Date()) {
  const base = new Date(anchor);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  monday.setHours(12, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dow = d.getDay();
    return {
      date: d,
      dayOfWeek: dow,
      short: DAY_SHORT[dow],
      label: `${DAY_SHORT[dow]} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`,
      fullDate: d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
      isToday:
        d.getFullYear() === anchor.getFullYear() &&
        d.getMonth() === anchor.getMonth() &&
        d.getDate() === anchor.getDate(),
    };
  });
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

export default function StudentTimetableScreen() {
  const { home } = useStudentPortal();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentAcademicsPayload | null>(null);
  const [selectedDow, setSelectedDow] = useState(() => new Date().getDay());
  const [nowTick, setNowTick] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchStudentAcademics();
      setData(payload);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const weekDays = useMemo(() => buildWeekDays(new Date()), [nowTick]);
  const selectedDay = weekDays.find((d) => d.dayOfWeek === selectedDow) ?? weekDays[0];

  const daySlots = useMemo(() => {
    const fromWeek = data?.weeklyTimetable?.find((d) => d.dayOfWeek === selectedDow)?.slots ?? [];
    if (fromWeek.length) return fromWeek;
    if (selectedDow === new Date().getDay()) return data?.todayClasses ?? [];
    return [];
  }, [data, selectedDow]);

  const liveSlot = useMemo(() => daySlots.find((s) => s.isCurrent) ?? null, [daySlots, nowTick]);
  const nextSlot = useMemo(() => {
    if (liveSlot) {
      const idx = daySlots.indexOf(liveSlot);
      return daySlots.slice(idx + 1).find((s) => !s.isPast) ?? null;
    }
    return daySlots.find((s) => !s.isPast && !s.isCurrent) ?? null;
  }, [daySlots, liveSlot, nowTick]);

  const completed = daySlots.filter((s) => s.isPast && !s.isCurrent).length;
  const remaining = daySlots.filter((s) => !s.isPast || s.isCurrent).length;
  const attendancePct = useMemo(() => {
    const rows = data?.attendanceBySubject ?? [];
    if (!rows.length) return null;
    const sum = rows.reduce((acc, r) => acc + Number(r.percentage || 0), 0);
    return Math.round(sum / rows.length);
  }, [data]);

  const studentName =
    home?.profile?.displayFullName?.trim() || home?.profile?.programLabel || 'Student';
  const firstName = studentName.split(/\s+/)[0] || 'Student';
  const shift = data?.header?.shift?.trim() || home?.profile?.department || 'Shift';
  const sem =
    data?.header?.semesterLabel ||
    (data?.header?.semesterSequence != null
      ? `Sem ${data.header.semesterSequence}`
      : home?.profile?.semesterLabel || 'Semester');

  const timeline = useMemo(() => buildTimeline(daySlots), [daySlots]);

  return (
    <StudentScreenShell
      title="Timetable"
      subtitle="Your weekly class schedule"
      rightSlot={<Text style={styles.headerCalIcon}>📅</Text>}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !data ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <LinearGradient
              colors={['#1d4ed8', '#1e40af', '#0f3c89']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroDecorOne} />
              <View style={styles.heroDecorTwo} />
              <Text style={styles.heroGreeting}>
                {firstName.toUpperCase()} <Text style={styles.heroWave}>👋</Text>
              </Text>
              <View style={styles.heroBadges}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{shift}</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{sem}</Text>
                </View>
              </View>
              <Text style={styles.heroDate}>
                📆 {selectedDay?.fullDate ?? DAY_FULL[selectedDow]}
              </Text>
            </LinearGradient>

            <View style={styles.statsRow}>
              <StatChip
                icon="📘"
                label="Today's Classes"
                value={`${daySlots.length}`}
                sub="Scheduled"
                tone="#dbeafe"
              />
              <StatChip
                icon="✅"
                label="Completed"
                value={`${completed}`}
                sub="Classes"
                tone="#d1fae5"
              />
              <StatChip
                icon="⏰"
                label="Remaining"
                value={`${remaining}`}
                sub="Classes"
                tone="#ffedd5"
              />
              <StatChip
                icon="🎯"
                label="Attendance"
                value={attendancePct != null ? `${attendancePct}%` : '—'}
                sub="This Month"
                tone="#ede9fe"
              />
            </View>

            {liveSlot ? (
              <View style={styles.liveCard}>
                <View style={styles.liveTop}>
                  <View style={styles.livePill}>
                    <Text style={styles.livePillText}>● LIVE</Text>
                  </View>
                  <Text style={styles.liveTime}>{formatRange(liveSlot)}</Text>
                </View>
                {liveSlot.courseCode ? (
                  <Text style={styles.liveCode}>{liveSlot.courseCode}</Text>
                ) : null}
                <Text style={styles.liveTitle}>{liveSlot.title}</Text>
                <View style={styles.liveMetaRow}>
                  <View style={styles.liveMeta}>
                    {liveSlot.facultyName ? (
                      <Text style={styles.liveMetaText}>👤 {liveSlot.facultyName}</Text>
                    ) : null}
                    {liveSlot.room ? (
                      <Text style={styles.liveMetaText}>📍 Room {liveSlot.room}</Text>
                    ) : null}
                  </View>
                  <View style={styles.liveRing}>
                    <Text style={styles.liveRingValue}>{minutesLeft(liveSlot.endTime) ?? '—'}</Text>
                    <Text style={styles.liveRingLabel}>mins left</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {nextSlot ? (
              <View style={styles.nextCard}>
                <View style={styles.nextLeft}>
                  <Text style={styles.nextLabel}>Next Class</Text>
                  <Text style={styles.nextTime}>{formatClock(nextSlot.startTime)}</Text>
                  {nextSlot.courseCode ? (
                    <Text style={styles.nextCode}>{nextSlot.courseCode}</Text>
                  ) : null}
                  <Text style={styles.nextTitle} numberOfLines={2}>
                    {nextSlot.title}
                  </Text>
                </View>
                <View style={styles.nextCountdown}>
                  <Text style={styles.nextCountdownValue}>
                    {String(minutesUntil(nextSlot.startTime) ?? 0).padStart(2, '0')}
                  </Text>
                  <Text style={styles.nextCountdownLabel}>Starts in mins</Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>
              {selectedDay?.isToday ? "Today's Classes" : `${DAY_FULL[selectedDow]} Classes`}
            </Text>

            {timeline.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No classes scheduled</Text>
                <Text style={styles.emptySub}>
                  Pick another day from Week View, or pull to refresh after timetable publish.
                </Text>
              </View>
            ) : (
              timeline.map((item) => {
                if (item.kind === 'lunch') {
                  return (
                    <View key={item.key} style={styles.lunchCard}>
                      <Text style={styles.lunchIcon}>🍽️</Text>
                      <View style={styles.lunchBody}>
                        <Text style={styles.lunchTime}>
                          {item.start} - {item.end}
                        </Text>
                        <Text style={styles.lunchTitle}>
                          Lunch Break — Take a break and recharge!
                        </Text>
                      </View>
                    </View>
                  );
                }
                const theme = categoryTheme(item.slot.category);
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.classCard,
                      item.slot.isCurrent && styles.classCardLive,
                      item.slot.isPast && !item.slot.isCurrent && styles.classCardPast,
                    ]}
                  >
                    <View style={[styles.classBar, { backgroundColor: theme.bar }]} />
                    <View style={styles.classBody}>
                      <View style={styles.classTopRow}>
                        <Text style={styles.classTime}>{formatRange(item.slot)}</Text>
                        {item.slot.category ? (
                          <View style={[styles.catPill, { backgroundColor: theme.soft }]}>
                            <Text style={[styles.catPillText, { color: theme.bar }]}>
                              {theme.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {item.slot.courseCode ? (
                        <Text style={styles.classCode}>{item.slot.courseCode}</Text>
                      ) : null}
                      <Text style={styles.classTitle}>{item.slot.title}</Text>
                      <Text style={styles.classMeta}>
                        {[
                          item.slot.facultyName ? `👤 ${item.slot.facultyName}` : null,
                          item.slot.room ? `📍 ${item.slot.room}` : null,
                        ]
                          .filter(Boolean)
                          .join('   ')}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            <Text style={styles.sectionTitle}>Week View</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekRow}
            >
              {weekDays.map((d) => {
                const active = d.dayOfWeek === selectedDow;
                const count =
                  data?.weeklyTimetable?.find((x) => x.dayOfWeek === d.dayOfWeek)?.slots.length ??
                  0;
                return (
                  <Pressable
                    key={d.label}
                    onPress={() => setSelectedDow(d.dayOfWeek)}
                    style={[styles.weekChip, active && styles.weekChipActive]}
                  >
                    <Text style={[styles.weekChipDay, active && styles.weekChipTextActive]}>
                      {d.short}
                    </Text>
                    <Text style={[styles.weekChipDate, active && styles.weekChipTextActive]}>
                      {d.date.getDate()} {d.date.toLocaleDateString('en-GB', { month: 'short' })}
                    </Text>
                    <Text style={[styles.weekChipCount, active && styles.weekChipTextActive]}>
                      {count} class{count === 1 ? '' : 'es'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

function StatChip({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <View style={[styles.statChip, { backgroundColor: tone }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 36 },
  headerCalIcon: { fontSize: 18 },
  hero: {
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    minHeight: 120,
  },
  heroDecorOne: {
    position: 'absolute',
    right: -20,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroDecorTwo: {
    position: 'absolute',
    right: 40,
    bottom: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroGreeting: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  heroWave: { fontSize: 18 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroBadgeText: { color: '#e0e7ff', fontSize: 11, fontWeight: '700' },
  heroDate: { color: '#bfdbfe', fontSize: 12, fontWeight: '600', marginTop: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statChip: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 16,
    padding: 12,
    minWidth: '45%',
  },
  statIcon: { fontSize: 16 },
  statValue: { fontSize: 20, fontWeight: '800', color: studentTheme.text, marginTop: 4 },
  statLabel: { fontSize: 11, fontWeight: '700', color: studentTheme.text, marginTop: 2 },
  statSub: { fontSize: 10, color: studentTheme.textMuted, marginTop: 1 },
  liveCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#6ee7b7',
    gap: 4,
  },
  liveTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  livePill: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  livePillText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  liveTime: { fontSize: 12, fontWeight: '700', color: '#065f46' },
  liveCode: { fontSize: 12, fontWeight: '800', color: '#047857', marginTop: 4 },
  liveTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  liveMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  liveMeta: { flex: 1, gap: 2 },
  liveMetaText: { fontSize: 12, color: studentTheme.textMuted, fontWeight: '600' },
  liveRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#34d399',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  liveRingValue: { fontSize: 16, fontWeight: '800', color: '#059669' },
  liveRingLabel: { fontSize: 8, color: studentTheme.textMuted, fontWeight: '700' },
  nextCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  nextLeft: { flex: 1, gap: 2 },
  nextLabel: { fontSize: 11, fontWeight: '800', color: studentTheme.primaryLight },
  nextTime: { fontSize: 13, fontWeight: '700', color: studentTheme.textMuted },
  nextCode: { fontSize: 12, fontWeight: '800', color: studentTheme.primary },
  nextTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  nextCountdown: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
    minWidth: 78,
  },
  nextCountdownValue: { fontSize: 22, fontWeight: '800', color: studentTheme.primaryLight },
  nextCountdownLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: studentTheme.textMuted,
    textAlign: 'center',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text, marginTop: 4 },
  emptyCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: studentTheme.text },
  emptySub: { fontSize: 12, color: studentTheme.textMuted, marginTop: 4, lineHeight: 18 },
  classCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: studentTheme.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  classCardLive: { borderColor: '#6ee7b7', backgroundColor: '#f0fdf4' },
  classCardPast: { opacity: 0.72 },
  classBar: { width: 5 },
  classBody: { flex: 1, padding: 12, gap: 2 },
  classTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  classTime: { fontSize: 12, fontWeight: '800', color: studentTheme.primaryLight },
  catPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  catPillText: { fontSize: 10, fontWeight: '800' },
  classCode: { fontSize: 12, fontWeight: '800', color: studentTheme.textMuted, marginTop: 2 },
  classTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  classMeta: { fontSize: 12, color: studentTheme.textMuted, marginTop: 2, fontWeight: '600' },
  lunchCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fdba74',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  lunchIcon: { fontSize: 22 },
  lunchBody: { flex: 1 },
  lunchTime: { fontSize: 12, fontWeight: '800', color: '#c2410c' },
  lunchTitle: { fontSize: 13, fontWeight: '700', color: studentTheme.text, marginTop: 2 },
  weekRow: { gap: 8, paddingRight: 8, paddingBottom: 4 },
  weekChip: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    minWidth: 84,
    alignItems: 'center',
  },
  weekChipActive: {
    backgroundColor: studentTheme.primary,
    borderColor: studentTheme.primary,
  },
  weekChipDay: { fontSize: 13, fontWeight: '800', color: studentTheme.text },
  weekChipDate: { fontSize: 11, fontWeight: '600', color: studentTheme.textMuted, marginTop: 2 },
  weekChipCount: { fontSize: 10, color: studentTheme.textSubtle, marginTop: 4, fontWeight: '600' },
  weekChipTextActive: { color: '#fff' },
});
