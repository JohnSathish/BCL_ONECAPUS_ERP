import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '@/api/client';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';
import {
  addDayKey,
  formatDayLabel,
  istDayKey,
  istNowMinutes,
  periodStatus,
  railColor,
  splitClock,
  subjectLook,
  weekdayFromKey,
  type PeriodStatus,
} from '@/timetable/format';

type Bell = {
  id: string;
  kind: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

type Slot = {
  id: string;
  dayOfWeek: number;
  roomLabel?: string | null;
  printedSubject?: string | null;
  printedTeacher?: string | null;
  subject?: { name?: string } | null;
  staff?: { fullName?: string } | null;
  bell?: Bell | null;
  section?: { name?: string; grade?: { name?: string } | null } | null;
};

type Payload = {
  days?: number[];
  bells?: Bell[];
  slots?: Slot[];
  classLabel?: string;
  section?: { name?: string; grade?: { name?: string } } | null;
  student?: { fullName?: string } | null;
};

type CalCell = {
  date: string;
  weekday: number;
  kind: string;
  items?: Array<{ title?: string }>;
};

type Row = {
  key: string;
  kind: string;
  title: string;
  teacher?: string | null;
  room?: string | null;
  start: string;
  end: string;
  status: PeriodStatus;
};

const TABS = ['Today', 'Week', 'Month'] as const;
type Tab = (typeof TABS)[number];
const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function classFrom(payload: Payload | null) {
  if (payload?.classLabel) return payload.classLabel;
  const sec = payload?.section;
  if (!sec) return 'Your class';
  return `${sec.grade?.name ?? ''} ${sec.name}`.trim() || 'Your class';
}

function buildRows(
  payload: Payload | null,
  dayOfWeek: number,
  viewingToday: boolean,
  nowMinutes: number,
): Row[] {
  const bells = [...(payload?.bells ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const slots = (payload?.slots ?? []).filter((s) => s.dayOfWeek === dayOfWeek);
  if (bells.length) {
    return bells.map((bell) => {
      const slot = slots.find((s) => s.bell?.id === bell.id);
      const breakBell = bell.kind === 'BREAK';
      const title = breakBell
        ? bell.label || 'Break'
        : slot?.subject?.name || slot?.printedSubject || 'Free period';
      return {
        key: `${bell.id}-${dayOfWeek}`,
        kind: breakBell ? 'BREAK' : 'PERIOD',
        title,
        teacher: breakBell ? null : slot?.staff?.fullName || slot?.printedTeacher || null,
        room: breakBell ? null : slot?.roomLabel || null,
        start: bell.startTime,
        end: bell.endTime,
        status: periodStatus(bell.startTime, bell.endTime, bell.kind, viewingToday, nowMinutes),
      };
    });
  }
  return slots
    .slice()
    .sort((a, b) => (a.bell?.sortOrder ?? 0) - (b.bell?.sortOrder ?? 0))
    .map((slot) => {
      const start = slot.bell?.startTime ?? '';
      const end = slot.bell?.endTime ?? '';
      const kind = slot.bell?.kind ?? 'PERIOD';
      return {
        key: slot.id,
        kind,
        title: slot.subject?.name || slot.printedSubject || slot.bell?.label || 'Period',
        teacher: slot.staff?.fullName || slot.printedTeacher || null,
        room: slot.roomLabel || null,
        start,
        end,
        status: periodStatus(start, end, kind, viewingToday, nowMinutes),
      };
    });
}

function StatusChip({ status }: { status: PeriodStatus }) {
  if (!status) return null;
  const map = {
    NOW: { label: 'Now', bg: '#dbeafe', fg: '#1d4ed8', dot: '#2563eb' },
    UPCOMING: { label: 'Upcoming', bg: '#dcfce7', fg: '#15803d', dot: '#22c55e' },
    DONE: { label: 'Done', bg: '#f1f5f9', fg: '#64748b', dot: '#94a3b8' },
    BREAK: { label: 'Break', bg: '#e0f2fe', fg: '#0369a1', dot: '#38bdf8' },
  } as const;
  const tone = map[status];
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <View style={[styles.chipDot, { backgroundColor: tone.dot }]} />
      <Text style={[styles.chipText, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  );
}

function PeriodCard({ row, index }: { row: Row; index: number }) {
  const look = subjectLook(row.title, row.kind);
  const start = splitClock(row.start);
  const end = splitClock(row.end);
  const done = row.status === 'DONE';
  return (
    <View style={styles.periodRow}>
      <View style={[styles.timeRail, { backgroundColor: railColor(index) }]}>
        <Text style={styles.timeMain}>{start.time}</Text>
        <Text style={styles.timeMer}>{start.mer}</Text>
        <View style={styles.timeRule} />
        <Text style={styles.timeEnd}>{end.time}</Text>
        <Text style={styles.timeMer}>{end.mer}</Text>
      </View>
      <View style={styles.periodCard}>
        <View style={[styles.subjectIcon, { backgroundColor: look.bg }]}>
          <Text style={{ fontSize: 18 }}>{look.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.subject, done && styles.subjectDone]}>{row.title}</Text>
          {row.kind === 'BREAK' ? (
            <Text style={styles.meta}>Break Time</Text>
          ) : (
            <>
              {row.teacher ? <Text style={styles.meta}>👤 {row.teacher}</Text> : null}
              {row.room ? <Text style={styles.meta}>📍 {row.room}</Text> : null}
              {!row.teacher && !row.room ? (
                <Text style={styles.meta}>No teacher assigned</Text>
              ) : null}
            </>
          )}
        </View>
        <StatusChip status={row.status} />
      </View>
    </View>
  );
}

export function StudentTimetable() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('Today');
  const [dateKey, setDateKey] = useState(istDayKey);
  const [nowMin, setNowMin] = useState(istNowMinutes);
  const [monthCells, setMonthCells] = useState<CalCell[]>([]);
  const [monthStamp, setMonthStamp] = useState(() => {
    const k = istDayKey();
    return k.slice(0, 7);
  });

  const load = useCallback(async () => {
    const data = await apiFetch<Payload>('/v1/school-mobile/timetable');
    setPayload(data);
    setError(null);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setNowMin(istNowMinutes()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const stamp = dateKey.slice(0, 7);
    setMonthStamp((prev) => (prev === stamp ? prev : stamp));
  }, [dateKey]);

  useEffect(() => {
    const [y, m] = monthStamp.split('-').map(Number);
    apiFetch<{ cells?: CalCell[] }>(`/v1/school-mobile/calendar?year=${y}&month=${m}`)
      .then((row) => setMonthCells(row.cells ?? []))
      .catch(() => setMonthCells([]));
  }, [monthStamp]);

  const schoolDays = payload?.days?.length ? payload.days : [1, 2, 3, 4, 5];
  const viewingToday = dateKey === istDayKey();
  const dayOfWeek = weekdayFromKey(dateKey);
  const isSchoolDay = schoolDays.includes(dayOfWeek);
  const calKind = monthCells.find((c) => c.date === dateKey)?.kind;
  const holiday = calKind === 'HOLIDAY' || calKind === 'VACATION' || calKind === 'WEEKLY_OFF';
  const rows = useMemo(
    () => (isSchoolDay && !holiday ? buildRows(payload, dayOfWeek, viewingToday, nowMin) : []),
    [payload, dayOfWeek, viewingToday, nowMin, isSchoolDay, holiday],
  );

  const weekKeys = useMemo(() => {
    const wd = weekdayFromKey(dateKey);
    const monday = addDayKey(dateKey, -(wd === 7 ? 6 : wd - 1));
    return [0, 1, 2, 3, 4, 5, 6].map((i) => addDayKey(monday, i));
  }, [dateKey]);

  const monthMeta = useMemo(() => {
    const [y, m] = monthStamp.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const startPad = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells: Array<string | null> = [
      ...Array.from({ length: startPad }, () => null),
      ...Array.from(
        { length: days },
        (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      ),
    ];
    while (cells.length % 7) cells.push(null);
    const label = first.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return { cells, label, y, m };
  }, [monthStamp]);

  function shiftDate(delta: number) {
    setDateKey(addDayKey(dateKey, delta));
    setTab('Today');
  }

  function shiftMonth(delta: number) {
    const [y, m] = monthStamp.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonthStamp(dt.toISOString().slice(0, 7));
  }

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh timetable.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen title="Timetable" onBack>
      {loading ? <Loader /> : null}
      {error ? <EmptyState title="Timetable unavailable" body={error} /> : null}
      {!loading && !error ? (
        <ScrollView
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
        >
          <View style={styles.tabs}>
            {TABS.map((item) => {
              const on = tab === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setTab(item)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{item}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                const today = istDayKey();
                setDateKey(today);
                setMonthStamp(today.slice(0, 7));
                setTab('Today');
              }}
              style={styles.calBtn}
              hitSlop={8}
            >
              <Text style={{ fontSize: 16 }}>📅</Text>
            </Pressable>
          </View>

          <View style={styles.metaCard}>
            <View style={styles.metaHalf}>
              <View style={styles.metaIcon}>
                <Text style={{ fontSize: 18 }}>🎓</Text>
              </View>
              <View>
                <Text style={styles.metaKicker}>Class</Text>
                <Text style={styles.metaValue}>{classFrom(payload)}</Text>
              </View>
            </View>
            <View style={styles.metaSplit} />
            <View style={[styles.metaHalf, { flex: 1.2 }]}>
              <View style={styles.metaIcon}>
                <Text style={{ fontSize: 18 }}>🗓️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metaKicker}>Date</Text>
                <Text style={styles.metaValue}>{formatDayLabel(dateKey)}</Text>
                {viewingToday ? <Text style={styles.todayHint}>Today</Text> : null}
              </View>
              <View style={styles.arrows}>
                <Pressable onPress={() => shiftDate(-1)} style={styles.arrow} hitSlop={8}>
                  <Text style={styles.arrowTxt}>‹</Text>
                </Pressable>
                <Pressable onPress={() => shiftDate(1)} style={styles.arrow} hitSlop={8}>
                  <Text style={styles.arrowTxt}>›</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {tab === 'Week' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.weekStrip}
            >
              {weekKeys.map((key) => {
                const wd = weekdayFromKey(key);
                const on = key === dateKey;
                const off = !schoolDays.includes(wd);
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setDateKey(key);
                    }}
                    style={[styles.weekDay, on && styles.weekDayOn, off && styles.weekDayOff]}
                  >
                    <Text style={[styles.weekDow, on && styles.weekOnInk]}>{DAY_SHORT[wd]}</Text>
                    <Text style={[styles.weekNum, on && styles.weekOnInk]}>{key.slice(8)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {tab === 'Month' ? (
            <View style={styles.monthCard}>
              <View style={styles.monthHead}>
                <Pressable onPress={() => shiftMonth(-1)} hitSlop={8}>
                  <Text style={styles.arrowTxt}>‹</Text>
                </Pressable>
                <Text style={styles.monthTitle}>{monthMeta.label}</Text>
                <Pressable onPress={() => shiftMonth(1)} hitSlop={8}>
                  <Text style={styles.arrowTxt}>›</Text>
                </Pressable>
              </View>
              <View style={styles.monthGrid}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <Text key={`${d}-${i}`} style={styles.monthDow}>
                    {d}
                  </Text>
                ))}
                {monthMeta.cells.map((key, i) => {
                  if (!key) return <View key={`e-${i}`} style={styles.monthCell} />;
                  const cell = monthCells.find((c) => c.date === key);
                  const kind = cell?.kind ?? '';
                  const on = key === dateKey;
                  const today = key === istDayKey();
                  const closed = kind === 'HOLIDAY' || kind === 'VACATION' || kind === 'WEEKLY_OFF';
                  const eventful = Boolean(cell?.items?.length);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setDateKey(key);
                        setTab('Today');
                      }}
                      style={[
                        styles.monthCell,
                        on && styles.monthOn,
                        closed && !on && styles.monthClosed,
                        today && !on && styles.monthToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.monthNum,
                          on && { color: '#fff' },
                          closed && !on && { color: '#be123c' },
                        ]}
                      >
                        {Number(key.slice(8))}
                      </Text>
                      {eventful ? (
                        <View style={[styles.monthDot, on && { backgroundColor: '#fff' }]} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.monthHint}>Tap a date to open that day’s timetable.</Text>
            </View>
          ) : null}

          {tab !== 'Month' ? (
            <>
              {!isSchoolDay || holiday ? (
                <EmptyState
                  title={holiday ? 'School holiday' : 'No classes today'}
                  body={
                    holiday
                      ? 'This date is a holiday or weekly off on the school calendar.'
                      : 'There is no class timetable on this day of the week.'
                  }
                />
              ) : !rows.length ? (
                <EmptyState
                  title="No periods yet"
                  body="Your class timetable will appear here once the school publishes it."
                />
              ) : (
                rows.map((row, i) => <PeriodCard key={row.key} row={row} index={i} />)
              )}
            </>
          ) : null}

          {tab === 'Today' ? (
            <View style={styles.note}>
              <Text style={styles.noteIcon}>ℹ️</Text>
              <Text style={styles.noteText}>
                This is today’s timetable. Changes, if any, will be updated by the school and
                reflected here.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  feed: { padding: space.md, gap: 12, paddingBottom: 48 },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderRadius: radii.pill,
    padding: 4,
    gap: 4,
  },
  tab: { flex: 1, borderRadius: radii.pill, paddingVertical: 8, alignItems: 'center' },
  tabOn: { backgroundColor: '#2f3dd9' },
  tabText: { fontWeight: '800', color: '#64748b', fontSize: 13 },
  tabTextOn: { color: '#fff' },
  calBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCard: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#1a237e',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  metaHalf: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaSplit: { width: 1, height: 36, backgroundColor: '#e2e8f0', marginHorizontal: 8 },
  metaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaKicker: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  metaValue: { fontSize: 14, fontWeight: '800', color: colors.navy },
  todayHint: { fontSize: 11, color: '#2563eb', fontWeight: '700' },
  arrows: { flexDirection: 'row', gap: 4 },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowTxt: { fontSize: 18, color: colors.navy, fontWeight: '700', marginTop: -2 },
  weekStrip: { gap: 8, paddingVertical: 2 },
  weekDay: {
    width: 52,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  weekDayOn: { backgroundColor: '#2f3dd9', borderColor: '#2f3dd9' },
  weekDayOff: { opacity: 0.45 },
  weekDow: { fontSize: 11, fontWeight: '700', color: colors.muted },
  weekNum: { fontSize: 16, fontWeight: '800', color: colors.ink },
  weekOnInk: { color: '#fff' },
  monthCard: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 12,
  },
  monthHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  monthTitle: { fontWeight: '800', color: colors.navy, fontSize: 16 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthDow: {
    width: '14.28%',
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '800',
    fontSize: 11,
    paddingVertical: 6,
  },
  monthCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  monthOn: { backgroundColor: '#2f3dd9' },
  monthClosed: { backgroundColor: '#fff1f2' },
  monthToday: { borderWidth: 1, borderColor: '#2f3dd9' },
  monthNum: { fontWeight: '700', color: colors.ink },
  monthDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#2f3dd9', marginTop: 2 },
  monthHint: { marginTop: 8, textAlign: 'center', color: colors.muted, fontSize: 12 },
  periodRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  timeRail: {
    width: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  timeMain: { fontWeight: '800', color: colors.navy, fontSize: 13 },
  timeEnd: { fontWeight: '700', color: colors.navy, fontSize: 12 },
  timeMer: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  timeRule: { width: 12, height: 1, backgroundColor: '#94a3b8', marginVertical: 4 },
  periodCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1a237e',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subject: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  subjectDone: { color: '#475569' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontWeight: '800' },
  note: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#e0f2fe',
    borderRadius: radii.lg,
    padding: 12,
    alignItems: 'flex-start',
  },
  noteIcon: { fontSize: 16, marginTop: 1 },
  noteText: { flex: 1, color: '#0369a1', fontSize: 13, lineHeight: 18 },
});
