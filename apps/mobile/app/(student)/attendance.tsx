import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchMyAttendance } from '@/services/attendance';
import type { AttendanceSubject, StudentAttendanceSummary } from '@/types/attendance';

function pct(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function pctLabel(value: number | string | null | undefined) {
  return `${pct(value).toFixed(2)}%`;
}

function toneColor(value: number) {
  if (value >= 75) return '#059669';
  if (value >= 65) return '#d97706';
  return '#dc2626';
}

function subjectLabel(subject: AttendanceSubject) {
  const meta = subject.metadata ?? {};
  const title = meta.courseTitle ?? meta.courseCode ?? meta.title;
  if (typeof title === 'string' && title) return title;
  if (subject.courseId) return `Subject ${subject.courseId.slice(0, 8)}`;
  return 'Subject';
}

export default function StudentAttendanceScreen() {
  const [data, setData] = useState<StudentAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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

  const overall = data?.overall == null ? null : pct(data.overall);
  const subjects = data?.subjects ?? [];
  const alerts = data?.alerts ?? [];

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading attendance…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <Text style={styles.title}>My Attendance</Text>
      <Text style={styles.subtitle}>Subject-wise register and eligibility warnings</Text>

      {message ? <Text style={styles.error}>{message}</Text> : null}

      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Overall</Text>
          <Text
            style={[styles.kpiValue, { color: overall == null ? '#374151' : toneColor(overall) }]}
          >
            {overall == null ? '—' : pctLabel(overall)}
          </Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Subjects</Text>
          <Text style={styles.kpiValue}>{subjects.length}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiLabel}>Alerts</Text>
          <Text style={[styles.kpiValue, { color: alerts.length ? '#d97706' : '#059669' }]}>
            {alerts.length}
          </Text>
        </View>
      </View>

      {alerts.length > 0 ? (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>Attendance alerts</Text>
          {alerts.map((alert, index) => (
            <Text key={`${alert.courseId ?? 'alert'}-${index}`} style={styles.alertItem}>
              {alert.message}: {pctLabel(alert.percentage)}
            </Text>
          ))}
        </View>
      ) : null}

      <Text style={styles.section}>Subject register</Text>
      {subjects.length === 0 ? (
        <Text style={styles.muted}>No attendance records yet for this semester.</Text>
      ) : (
        subjects.map((subject) => {
          const value = pct(subject.percentage);
          return (
            <View key={subject.id} style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectTitle}>{subjectLabel(subject)}</Text>
                  <Text style={styles.muted}>
                    Present {subject.presentCount}/{subject.totalSessions} · Absent{' '}
                    {subject.absentCount}
                  </Text>
                </View>
                <Text
                  style={[styles.badge, { color: toneColor(value), borderColor: toneColor(value) }]}
                >
                  {pctLabel(value)}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, value)}%`, backgroundColor: toneColor(value) },
                  ]}
                />
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#6b7280' },
  section: { fontWeight: '600', marginTop: 8 },
  muted: { fontSize: 13, color: '#6b7280' },
  error: { color: '#dc2626', fontSize: 14 },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  kpiLabel: { fontSize: 12, color: '#6b7280' },
  kpiValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  alertBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  alertTitle: { fontWeight: '600', color: '#92400e' },
  alertItem: { fontSize: 13, color: '#92400e' },
  subjectCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#fff',
    gap: 8,
  },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectTitle: { fontSize: 15, fontWeight: '600' },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  barTrack: { height: 6, borderRadius: 999, backgroundColor: '#e5e7eb', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
});
