import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '@/api/client';
import { SCHOOL } from '@/brand';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';
import {
  formatDayLabel,
  formatIstStamp,
  formatMonthLong,
  istDayKey,
  monthsBetween,
  sundayMonthGrid,
} from '@/timetable/format';

type DayRecord = {
  date: string;
  status: string;
  remark?: string | null;
  letter?: string | null;
  markedAt?: string | null;
  markedBy?: string | null;
};

type Payload = {
  student?: { className?: string; fullName?: string } | null;
  className?: string | null;
  academicYear?: { name?: string; startDate?: string; endDate?: string } | null;
  monthKey?: string;
  monthWorkingDays?: number;
  month?: {
    present?: number;
    absent?: number;
    late?: number;
    leave?: number;
    half?: number;
  } | null;
  calendar?: DayRecord[];
  percent?: number | null;
};

type CalCell = { date: string; kind: string };

type Tone = 'present' | 'absent' | 'leave' | 'holiday' | 'unmarked' | 'future' | 'outside';

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TONE: Record<
  Tone,
  { fill: string; ink: string; label: string; chip: string; chipInk: string; icon: string }
> = {
  present: {
    fill: '#dcfce7',
    ink: '#15803d',
    label: 'Present',
    chip: '#dcfce7',
    chipInk: '#15803d',
    icon: '✓',
  },
  absent: {
    fill: '#fee2e2',
    ink: '#dc2626',
    label: 'Absent',
    chip: '#fee2e2',
    chipInk: '#dc2626',
    icon: '✕',
  },
  leave: {
    fill: '#ffedd5',
    ink: '#c2410c',
    label: 'Leave',
    chip: '#ffedd5',
    chipInk: '#c2410c',
    icon: '◷',
  },
  holiday: {
    fill: '#ede9fe',
    ink: '#6d28d9',
    label: 'Holiday',
    chip: '#ede9fe',
    chipInk: '#6d28d9',
    icon: '☼',
  },
  unmarked: {
    fill: '#dbeafe',
    ink: '#1d4ed8',
    label: 'Not Marked',
    chip: '#dbeafe',
    chipInk: '#1d4ed8',
    icon: '○',
  },
  future: {
    fill: 'transparent',
    ink: colors.ink,
    label: 'Upcoming',
    chip: '#e2e8f0',
    chipInk: '#475569',
    icon: '○',
  },
  outside: {
    fill: 'transparent',
    ink: '#cbd5e1',
    label: '',
    chip: '#e2e8f0',
    chipInk: '#94a3b8',
    icon: '',
  },
};

function isClosedKind(kind?: string | null) {
  return kind === 'HOLIDAY' || kind === 'VACATION' || kind === 'WEEKLY_OFF';
}

function isWorkingKind(kind?: string | null) {
  return (
    kind === 'WORKING_DAY' || kind === 'SPECIAL_WORKING_DAY' || kind === 'EXAMINATION' || !kind
  );
}

function statusTone(status?: string | null): Tone | null {
  const code = (status ?? '').toUpperCase();
  if (code === 'PRESENT' || code === 'LATE' || code === 'HALF_DAY') return 'present';
  if (code === 'ABSENT') return 'absent';
  if (code === 'LEAVE' || code === 'EXCUSED') return 'leave';
  return null;
}

function statusLabel(status?: string | null) {
  const code = (status ?? '').toUpperCase();
  if (code === 'LATE') return 'Late';
  if (code === 'HALF_DAY') return 'Half day';
  if (code === 'EXCUSED') return 'Excused';
  if (code === 'LEAVE') return 'Leave';
  if (code === 'ABSENT') return 'Absent';
  if (code === 'PRESENT') return 'Present';
  return code ? code.replace(/_/g, ' ') : 'Not Marked';
}

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export function StudentAttendance() {
  const today = istDayKey();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthStamp, setMonthStamp] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [calCells, setCalCells] = useState<CalCell[]>([]);
  const [picker, setPicker] = useState(false);

  const load = useCallback(async (stamp: string) => {
    const data = await apiFetch<Payload>(
      `/v1/school-mobile/attendance?month=${encodeURIComponent(stamp)}`,
    );
    setPayload(data);
    setError(null);
  }, []);

  useEffect(() => {
    load(monthStamp)
      .catch((err: Error) => setError(err.message))
      .finally(() => setBooting(false));
  }, [load, monthStamp]);

  useEffect(() => {
    const [y, m] = monthStamp.split('-').map(Number);
    apiFetch<{ cells?: CalCell[] }>(`/v1/school-mobile/calendar?year=${y}&month=${m}`)
      .then((row) => setCalCells(row.cells ?? []))
      .catch(() => setCalCells([]));
  }, [monthStamp]);

  const byDate = useMemo(() => {
    const map = new Map<string, DayRecord>();
    for (const row of payload?.calendar ?? []) map.set(row.date, row);
    return map;
  }, [payload]);

  const kindByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const cell of calCells) map.set(cell.date, cell.kind);
    return map;
  }, [calCells]);

  const grid = useMemo(() => sundayMonthGrid(monthStamp), [monthStamp]);

  const toneFor = useCallback(
    (key: string, outside: boolean): Tone => {
      if (outside) return 'outside';
      const kind = kindByDate.get(key);
      if (isClosedKind(kind)) return 'holiday';
      const rec = byDate.get(key);
      const marked = statusTone(rec?.status);
      if (marked) return marked;
      if (key > today) return 'future';
      if (isWorkingKind(kind)) return 'unmarked';
      return 'future';
    },
    [byDate, kindByDate, today],
  );

  const kpis = useMemo(() => {
    const monthRows = (payload?.calendar ?? []).filter((row) => row.date.startsWith(monthStamp));
    let present = 0;
    let absent = 0;
    let leave = 0;
    for (const row of monthRows) {
      const tone = statusTone(row.status);
      if (tone === 'present') present += 1;
      else if (tone === 'absent') absent += 1;
      else if (tone === 'leave') leave += 1;
    }
    const fromApi = payload?.month;
    if (!monthRows.length && fromApi && payload?.monthKey === monthStamp) {
      present = (fromApi.present ?? 0) + (fromApi.late ?? 0) + (fromApi.half ?? 0);
      absent = fromApi.absent ?? 0;
      leave = fromApi.leave ?? 0;
    }
    const workingFromCal = calCells.filter(
      (c) => isWorkingKind(c.kind) && !isClosedKind(c.kind),
    ).length;
    const total =
      payload?.monthKey === monthStamp && payload.monthWorkingDays
        ? payload.monthWorkingDays
        : workingFromCal;
    return { present, absent, leave, total };
  }, [payload, monthStamp, calCells]);

  const monthOptions = useMemo(() => {
    const start = payload?.academicYear?.startDate ?? `${today.slice(0, 4)}-01-01`;
    const end = payload?.academicYear?.endDate ?? `${today.slice(0, 4)}-12-31`;
    return monthsBetween(start.slice(0, 7), end.slice(0, 7));
  }, [payload, today]);

  function shiftMonth(delta: number) {
    const [y, m] = monthStamp.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
    if (monthOptions.length && !monthOptions.includes(next)) return;
    setMonthStamp(next);
    setSelected(today.startsWith(next) ? today : `${next}-01`);
  }

  function pickDay(key: string, outside: boolean) {
    if (outside) {
      const stamp = key.slice(0, 7);
      setMonthStamp(stamp);
      setSelected(key);
      return;
    }
    setSelected(key);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load(monthStamp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh attendance.');
    } finally {
      setRefreshing(false);
    }
  };

  const classLabel = payload?.student?.className || payload?.className || 'Your class';
  const rec = byDate.get(selected);
  const selectedTone = toneFor(selected, false);
  const look = TONE[selectedTone];
  const selectedKind = kindByDate.get(selected);
  const marked = Boolean(rec?.status);
  const holidayTitle =
    selectedKind === 'WEEKLY_OFF'
      ? 'Weekly off'
      : selectedKind === 'VACATION'
        ? 'Vacation'
        : 'Holiday';

  return (
    <Screen
      title="Attendance"
      onBack
      action={
        <Pressable onPress={() => setPicker(true)} style={styles.monthChip} hitSlop={8}>
          <Text style={styles.monthChipTxt} numberOfLines={1}>
            {formatMonthLong(monthStamp)} ▾
          </Text>
        </Pressable>
      }
    >
      {booting ? <Loader /> : null}
      {error && !payload ? <EmptyState title="Attendance unavailable" body={error} /> : null}
      {!booting && (payload || !error) ? (
        <ScrollView
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
        >
          <View style={styles.classCard}>
            <View style={styles.classIcon}>
              <Text style={{ fontSize: 22 }}>🎓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.classKicker}>Class</Text>
              <Text style={styles.className}>{classLabel}</Text>
              <Text style={styles.classSchool}>
                {SCHOOL.legalName}, {SCHOOL.city.split(',')[0]}
              </Text>
            </View>
          </View>

          <View style={styles.kpiRow}>
            <Kpi
              icon="✓"
              value={kpis.present}
              label="Present"
              hint={`${pct(kpis.present, kpis.total)}%`}
              bg="#ecfdf3"
              ink="#15803d"
            />
            <Kpi
              icon="✕"
              value={kpis.absent}
              label="Absent"
              hint={`${pct(kpis.absent, kpis.total)}%`}
              bg="#fef2f2"
              ink="#dc2626"
            />
            <Kpi
              icon="◷"
              value={kpis.leave}
              label="Leave"
              hint={`${pct(kpis.leave, kpis.total)}%`}
              bg="#fff7ed"
              ink="#c2410c"
            />
            <Kpi
              icon="▦"
              value={kpis.total}
              label="Total Days"
              hint="This month"
              bg="#eff6ff"
              ink="#1d4ed8"
            />
          </View>

          <View style={styles.legend}>
            {(
              [
                ['present', 'Present'],
                ['absent', 'Absent'],
                ['leave', 'Leave'],
                ['holiday', 'Holiday'],
                ['unmarked', 'Not Marked'],
              ] as const
            ).map(([tone, label]) => (
              <View key={tone} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: TONE[tone].ink }]} />
                <Text style={styles.legendTxt}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calCard}>
            <View style={styles.calHead}>
              <Pressable onPress={() => shiftMonth(-1)} style={styles.calArrow} hitSlop={8}>
                <Text style={styles.calArrowTxt}>‹</Text>
              </Pressable>
              <Text style={styles.calTitle}>{formatMonthLong(monthStamp)}</Text>
              <Pressable onPress={() => shiftMonth(1)} style={styles.calArrow} hitSlop={8}>
                <Text style={styles.calArrowTxt}>›</Text>
              </Pressable>
            </View>
            <View style={styles.calGrid}>
              {WEEK.map((d) => (
                <Text key={d} style={styles.calDow}>
                  {d}
                </Text>
              ))}
              {grid.map((cell) => {
                const tone = toneFor(cell.key, cell.outside);
                const on = !cell.outside && cell.key === selected;
                const isToday = cell.key === today;
                const lookDay = TONE[tone];
                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => pickDay(cell.key, cell.outside)}
                    style={styles.calCell}
                  >
                    <View
                      style={[
                        styles.calBubble,
                        { backgroundColor: lookDay.fill },
                        isToday && styles.calToday,
                        on && styles.calSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.calNum,
                          { color: lookDay.ink },
                          on && { color: colors.navy, fontWeight: '800' },
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailHead}>
              <View style={styles.detailIcon}>
                <Text style={{ fontSize: 16 }}>📅</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailDate}>{formatDayLabel(selected)}</Text>
                <Text style={styles.detailSub}>
                  {marked
                    ? 'Attendance Marked'
                    : selectedTone === 'holiday'
                      ? holidayTitle
                      : selectedTone === 'future'
                        ? 'Upcoming school day'
                        : 'Attendance not marked'}
                </Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: look.chip }]}>
                <Text style={[styles.statusChipTxt, { color: look.chipInk }]}>
                  {look.icon} {marked ? statusLabel(rec?.status) : look.label}
                </Text>
              </View>
            </View>

            {marked ? (
              <>
                <DetailRow icon="📖" label="Remarks" value={rec?.remark?.trim() || '—'} />
                <DetailRow icon="📝" label="Marked By" value={rec?.markedBy || 'School office'} />
                <DetailRow
                  icon="🕐"
                  label="Marked On"
                  value={formatIstStamp(rec?.markedAt) || '—'}
                />
              </>
            ) : selectedTone === 'holiday' ? (
              <Text style={styles.detailHint}>
                School is closed on this date. Attendance is not taken on holidays or weekly offs.
              </Text>
            ) : selectedTone === 'future' ? (
              <Text style={styles.detailHint}>
                This date is still ahead. Attendance will appear here after the school marks it.
              </Text>
            ) : (
              <Text style={styles.detailHint}>
                The school has not marked attendance for this date yet.
              </Text>
            )}
          </View>

          <View style={styles.note}>
            <Text style={styles.noteIcon}>ℹ️</Text>
            <Text style={styles.noteText}>
              Your attendance is marked by the school. Please contact the class teacher or school
              office for any corrections.
            </Text>
          </View>
        </ScrollView>
      ) : null}

      <Modal
        visible={picker}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(false)}
      >
        <Pressable style={styles.modalScrim} onPress={() => setPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Select month</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {monthOptions.map((stamp) => {
                const on = stamp === monthStamp;
                return (
                  <Pressable
                    key={stamp}
                    onPress={() => {
                      setMonthStamp(stamp);
                      setSelected(today.startsWith(stamp) ? today : `${stamp}-01`);
                      setPicker(false);
                    }}
                    style={[styles.modalRow, on && styles.modalRowOn]}
                  >
                    <Text style={[styles.modalRowTxt, on && styles.modalRowTxtOn]}>
                      {formatMonthLong(stamp)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Kpi({
  icon,
  value,
  label,
  hint,
  bg,
  ink,
}: {
  icon: string;
  value: number;
  label: string;
  hint: string;
  bg: string;
  ink: string;
}) {
  return (
    <View style={[styles.kpi, { backgroundColor: bg }]}>
      <View style={[styles.kpiIcon, { backgroundColor: '#fff' }]}>
        <Text style={{ color: ink, fontWeight: '800', fontSize: 12 }}>{icon}</Text>
      </View>
      <Text style={[styles.kpiValue, { color: ink }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiHint, { color: ink }]}>{hint}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowIcon}>{icon}</Text>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { padding: space.md, gap: 12, paddingBottom: 48 },
  monthChip: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#fff',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 150,
  },
  monthChipTxt: { fontSize: 11, fontWeight: '800', color: colors.navy },
  classCard: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#1a237e',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  classIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  classKicker: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  className: { fontSize: 18, fontWeight: '800', color: colors.navy },
  classSchool: { fontSize: 12, color: colors.muted, marginTop: 2 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  kpiIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: colors.muted, marginTop: 2 },
  kpiHint: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 11, fontWeight: '700', color: colors.muted },
  calCard: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 12,
    shadowColor: '#1a237e',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  calHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calTitle: { fontWeight: '800', color: colors.navy, fontSize: 16 },
  calArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calArrowTxt: { fontSize: 18, color: colors.navy, fontWeight: '700', marginTop: -2 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDow: {
    width: '14.28%',
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '800',
    fontSize: 11,
    paddingVertical: 6,
  },
  calCell: { width: '14.28%', height: 44, alignItems: 'center', justifyContent: 'center' },
  calBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calToday: { borderWidth: 2, borderColor: colors.navy },
  calSelected: { borderWidth: 2, borderColor: colors.navy },
  calNum: { fontWeight: '700', fontSize: 13 },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 14,
    gap: 10,
    shadowColor: '#1a237e',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailDate: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  detailSub: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  statusChip: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipTxt: { fontSize: 12, fontWeight: '800' },
  detailHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  detailRowIcon: { width: 22, fontSize: 14 },
  detailRowLabel: { width: 92, color: colors.muted, fontWeight: '700', fontSize: 13 },
  detailRowValue: {
    flex: 1,
    color: colors.ink,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'right',
  },
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
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(10, 16, 72, 0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 16,
    maxHeight: 480,
  },
  modalTitle: { fontWeight: '800', color: colors.navy, fontSize: 16, marginBottom: 8 },
  modalRow: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10 },
  modalRowOn: { backgroundColor: '#eef2ff' },
  modalRowTxt: { fontWeight: '700', color: colors.ink },
  modalRowTxtOn: { color: colors.navy },
});
