import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '@/theme/tokens';
import { Kpi, OfficeShell, RowCard } from '@/ui/office-shell';
import { apiFetch } from '@/api/client';

type ClassRow = {
  sectionId: string;
  label: string;
  students: number;
  present: number;
  absent: number;
  percent: number;
  status: string;
};

type Dash = {
  date: string;
  dayKind?: string;
  totals: { present: number; absent: number; late: number; leave: number; percent: number };
  completion: { submitted: number; total: number };
  byClass: ClassRow[];
};

export default function OfficeAttendance() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Dash>('/v1/school-mobile/principal/attendance')
        .then((row) => {
          setData(row);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    }, []),
  );

  const t = data?.totals;
  const pct = t?.percent != null ? `${Math.round(t.percent)}%` : '—';

  return (
    <OfficeShell
      title="Attendance"
      subtitle={data?.date ? `Today · ${data.date}` : 'School-wide today'}
      loading={loading}
      error={error}
    >
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Present today</Text>
        <Text style={styles.heroValue}>{pct}</Text>
        <Text style={styles.heroHint}>
          {data?.completion?.submitted ?? 0} of {data?.completion?.total ?? 0} classes marked
        </Text>
      </View>
      <View style={styles.kpis}>
        <Kpi label="Present" value={String(t?.present ?? 0)} tint="#ecfdf5" />
        <Kpi label="Absent" value={String(t?.absent ?? 0)} tint="#fef2f2" />
        <Kpi label="Late" value={String(t?.late ?? 0)} tint="#fff7ed" />
        <Kpi label="Leave" value={String(t?.leave ?? 0)} tint="#eff6ff" />
      </View>
      {(data?.byClass ?? []).map((row) => (
        <RowCard
          key={row.sectionId}
          title={row.label}
          meta={`${row.present} present · ${row.absent} absent · ${row.status.replaceAll('_', ' ')}`}
          right={
            <Text style={styles.pct}>{row.percent ? `${Math.round(row.percent)}%` : '—'}</Text>
          }
        />
      ))}
    </OfficeShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: 18,
  },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontWeight: '700' },
  heroValue: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 4 },
  heroHint: { color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pct: { color: colors.navy, fontWeight: '800' },
});
