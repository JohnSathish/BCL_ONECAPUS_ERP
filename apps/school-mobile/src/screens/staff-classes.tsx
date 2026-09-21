import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { fetchHome } from '@/auth/login';
import { EmptyState, Loader, Screen } from '@/ui/kit';
import { colors, radii, space } from '@/theme/tokens';

export type StaffClassRow = {
  id: string;
  label: string;
  students: number;
  subjects?: number;
  classTeacher?: boolean;
  submitted?: boolean;
  percent: number | null;
};

const TINTS = [
  { bg: '#dbeafe', fg: '#2563eb' },
  { bg: '#d1fae5', fg: '#059669' },
  { bg: '#fce7f3', fg: '#db2777' },
  { bg: '#fef9c3', fg: '#ca8a04' },
];

function ringColor(percent: number | null) {
  if (percent == null) return '#cbd5e1';
  if (percent >= 90) return '#22c55e';
  if (percent >= 75) return '#eab308';
  return '#ef4444';
}

function AttendanceRing({ percent }: { percent: number | null }) {
  const size = 62;
  const stroke = 6;
  const track = '#e2e8f0';
  const color = ringColor(percent);
  const p = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <View style={styles.ringWrap}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: stroke,
          borderTopColor: p > 8 ? color : track,
          borderRightColor: p > 33 ? color : track,
          borderBottomColor: p > 58 ? color : track,
          borderLeftColor: p > 83 ? color : track,
          transform: [{ rotate: '-45deg' }],
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
        }}
      >
        <Text
          style={[
            styles.ringValue,
            { color: percent == null ? '#94a3b8' : color, transform: [{ rotate: '45deg' }] },
          ]}
        >
          {percent == null ? '—' : `${Math.round(percent)}%`}
        </Text>
      </View>
      <Text style={styles.ringCaption}>{percent == null ? 'No Data' : 'Attendance'}</Text>
    </View>
  );
}

export function StaffClasses() {
  const router = useRouter();
  const [rows, setRows] = useState<StaffClassRow[]>([]);
  const [subjectCount, setSubjectCount] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const home = await fetchHome();
    const desk = (home.desk ?? {}) as {
      classes?: StaffClassRow[];
      subjectCount?: number;
      avgAttendance?: number | null;
    };
    const list = desk.classes ?? [];
    setRows(list);
    setSubjectCount(desk.subjectCount ?? 0);
    const marked = list.map((row) => row.percent).filter((n): n is number => n != null);
    setAvgAttendance(
      desk.avgAttendance ??
        (marked.length ? Math.round(marked.reduce((sum, n) => sum + n, 0) / marked.length) : null),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch(() => {
          setRows([]);
          setSubjectCount(0);
          setAvgAttendance(null);
        })
        .finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const totals = useMemo(() => {
    return {
      classes: rows.length,
      students: rows.reduce((n, row) => n + (row.students ?? 0), 0),
      subjects: subjectCount || rows.reduce((n, row) => n + (row.subjects ?? 0), 0),
      avg: avgAttendance,
    };
  }, [rows, subjectCount, avgAttendance]);

  function openClass(id: string) {
    router.push(`/class/${encodeURIComponent(id)}`);
  }

  return (
    <Screen title="My Classes">
      {loading ? <Loader /> : null}
      {!loading && !rows.length ? (
        <EmptyState
          title="No classes assigned"
          body="Class teacher and subject allocations will appear here."
        />
      ) : null}
      {!loading && rows.length ? (
        <ScrollView
          contentContainerStyle={styles.feed}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
          }
        >
          <Text style={styles.subtitle}>Manage your classes and view quick information</Text>

          <View style={styles.kpiRow}>
            <Kpi value={String(totals.classes)} label="Total Classes" bg="#eff6ff" ink="#1d4ed8" />
            <Kpi
              value={String(totals.students)}
              label="Total Students"
              bg="#ecfdf3"
              ink="#047857"
            />
            <Kpi
              value={totals.avg == null ? '—' : `${totals.avg}%`}
              label="Avg. Attendance"
              bg="#f5f3ff"
              ink="#6d28d9"
            />
            <Kpi
              value={String(totals.subjects)}
              label="Total Subjects"
              bg="#fffbeb"
              ink="#b45309"
            />
          </View>

          {rows.map((row, i) => {
            const tint = TINTS[i % TINTS.length];
            const marked = Boolean(row.submitted) && row.percent != null;
            return (
              <Pressable key={row.id} onPress={() => openClass(row.id)} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.classIcon, { backgroundColor: tint.bg }]}>
                    <Text style={{ fontSize: 20 }}>🎓</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.className}>{row.label}</Text>
                    <Text style={styles.classMeta}>{row.students} students</Text>
                    <View style={styles.roleRow}>
                      <Text style={{ fontSize: 12 }}>👤</Text>
                      <Text style={styles.roleTxt}>
                        {row.classTeacher ? 'Class Teacher' : 'Subject Teacher'}
                      </Text>
                    </View>
                  </View>
                  <AttendanceRing percent={row.percent} />
                  <Text style={styles.chev}>›</Text>
                </View>
                <View style={styles.actions}>
                  <Action
                    icon="📘"
                    label={`${row.subjects ?? 0} Subjects`}
                    color="#2563eb"
                    onPress={() => openClass(row.id)}
                  />
                  <Action
                    icon="👥"
                    label={`${row.students} Students`}
                    color="#16a34a"
                    onPress={() => openClass(row.id)}
                  />
                  <Action
                    icon="📅"
                    label={marked ? 'Today Attendance' : 'Mark Attendance'}
                    color="#dc2626"
                    onPress={() =>
                      router.push(`/take-attendance?sectionId=${encodeURIComponent(row.id)}`)
                    }
                  />
                  <Action
                    icon="📄"
                    label="View Details"
                    color="#0d9488"
                    onPress={() => openClass(row.id)}
                  />
                </View>
              </Pressable>
            );
          })}

          <View style={styles.note}>
            <Text style={styles.noteIcon}>ℹ️</Text>
            <Text style={styles.noteText}>
              Tap on a class to view students, attendance, timetable and more.
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

function Kpi({ value, label, bg, ink }: { value: string; label: string; bg: string; ink: string }) {
  return (
    <View style={[styles.kpi, { backgroundColor: bg }]}>
      <Text style={[styles.kpiValue, { color: ink }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Action({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action} hitSlop={4}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={[styles.actionTxt, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  feed: { padding: space.md, gap: 12, paddingBottom: 48 },
  subtitle: {
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
    marginTop: -4,
  },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 14,
    shadowColor: '#1a237e',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  classIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  className: { fontWeight: '800', color: colors.navy, fontSize: 16 },
  classMeta: { color: colors.muted, fontWeight: '600', marginTop: 2, fontSize: 13 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  roleTxt: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  chev: { color: '#94a3b8', fontSize: 22, fontWeight: '600', marginLeft: -4 },
  ringWrap: { alignItems: 'center', width: 72 },
  ringValue: { fontWeight: '800', fontSize: 12 },
  ringCaption: { fontSize: 10, fontWeight: '700', color: colors.muted, marginTop: 4 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  action: { flex: 1, alignItems: 'center', gap: 4 },
  actionTxt: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
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
