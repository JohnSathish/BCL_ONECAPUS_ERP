import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '@/api/client';
import { colors } from '@/theme/tokens';
import { Kpi, OfficeShell, RowCard } from '@/ui/office-shell';

type Exam = {
  id: string;
  name: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  type?: string | null;
};

type Dash = {
  upcoming: number;
  ongoing: number;
  completed: number;
  marksPending: number;
  resultsPublished: number;
  studentsAppeared: number;
  studentsPassed: number;
  studentsFailed: number;
  exams: Exam[];
};

function when(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function OfficeExaminations() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Dash>('/v1/school-mobile/principal/examinations')
        .then((row) => {
          setData(row);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    }, []),
  );

  const passPct =
    data && data.studentsAppeared
      ? Math.round((data.studentsPassed / data.studentsAppeared) * 100)
      : null;

  return (
    <OfficeShell
      title="Examinations"
      subtitle="School-wide exam pulse"
      loading={loading}
      error={error}
    >
      <View style={styles.kpis}>
        <Kpi label="Upcoming" value={String(data?.upcoming ?? 0)} tint="#eff6ff" />
        <Kpi label="Ongoing" value={String(data?.ongoing ?? 0)} tint="#fff7ed" />
        <Kpi label="Published" value={String(data?.resultsPublished ?? 0)} tint="#ecfdf5" />
        <Kpi
          label="Marks pending"
          value={String(data?.marksPending ?? 0)}
          tint="#fef2f2"
          hint="Entries still in draft"
        />
      </View>
      <View style={styles.pass}>
        <Text style={styles.passLabel}>Published pass rate</Text>
        <Text style={styles.passValue}>{passPct == null ? '—' : `${passPct}%`}</Text>
        <Text style={styles.passHint}>
          {data?.studentsPassed ?? 0} passed · {data?.studentsFailed ?? 0} to support
        </Text>
      </View>
      {(data?.exams ?? []).map((row) => (
        <RowCard
          key={row.id}
          title={row.name}
          meta={[row.type, row.status, when(row.startDate)].filter(Boolean).join(' · ')}
        />
      ))}
    </OfficeShell>
  );
}

const styles = StyleSheet.create({
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pass: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  passLabel: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  passValue: { color: colors.navy, fontWeight: '800', fontSize: 32, marginTop: 4 },
  passHint: { color: colors.muted, marginTop: 4 },
});
