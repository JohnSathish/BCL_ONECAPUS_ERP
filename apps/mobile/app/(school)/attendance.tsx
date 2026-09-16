import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { fetchSchoolAttendance } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

const LEGEND: Record<string, string> = {
  P: 'Present',
  A: 'Absent',
  L: 'Late',
  LV: 'Leave',
  H: 'Holiday',
};

export default function SchoolAttendanceViewScreen() {
  const childId = useSchoolSession((s) => s.childId);
  const q = useQuery({
    queryKey: ['school-attendance', childId],
    queryFn: () => fetchSchoolAttendance(childId),
  });
  const data = (q.data ?? {}) as Record<string, unknown>;
  const cal = Array.isArray(data.calendar) ? (data.calendar as Record<string, unknown>[]) : [];
  const percent = data.percent != null ? Math.round(Number(data.percent)) : null;

  return (
    <SchoolShell title="Attendance" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      <SchoolCard>
        <Text style={styles.hero}>{percent != null ? `${percent}%` : '—'}</Text>
        <Text style={styles.m}>
          Working days {String(data.workingDays ?? '—')} · Band {String(data.band ?? '—')}
        </Text>
      </SchoolCard>
      {cal.length === 0 ? (
        <SchoolEmpty
          title="No calendar yet"
          body="Attendance marks will appear as they are submitted."
        />
      ) : (
        <View style={styles.grid}>
          {cal.slice(0, 42).map((day, i) => {
            const code = String(day.status ?? day.code ?? day.mark ?? '');
            return (
              <View key={i} style={styles.cell}>
                <Text style={styles.day}>{String(day.day ?? day.date ?? i + 1)}</Text>
                <Text style={styles.code}>{code || '·'}</Text>
              </View>
            );
          })}
        </View>
      )}
      <SchoolCard>
        <Text style={styles.k}>Legend</Text>
        {Object.entries(LEGEND).map(([k, v]) => (
          <Text key={k} style={styles.m}>
            {k} — {v}
          </Text>
        ))}
      </SchoolCard>
    </SchoolShell>
  );
}

const styles = StyleSheet.create({
  hero: { fontSize: 32, fontWeight: '800', color: schoolUi.colors.primary },
  m: { color: schoolUi.colors.muted, marginTop: 4 },
  k: { fontWeight: '800', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    width: '13%',
    minWidth: 40,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 6,
    alignItems: 'center',
  },
  day: { fontSize: 10, color: schoolUi.colors.muted },
  code: { fontWeight: '800', color: schoolUi.colors.text },
});
