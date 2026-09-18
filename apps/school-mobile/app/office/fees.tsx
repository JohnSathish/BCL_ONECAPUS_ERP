import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '@/api/client';
import { inr } from '@/fees/format';
import { colors } from '@/theme/tokens';
import { Kpi, OfficeShell, RowCard } from '@/ui/office-shell';

type Dash = {
  todayCollection: number;
  todayCount: number;
  monthCollection: number;
  monthPaid: number;
  monthPending: number;
  enrolled: number;
  pendingFees: number;
  byClass: Array<{ name: string; amount: number; paid: number }>;
  byMonth: Array<{ month: string; label: string; amount: number; count: number }>;
  academicYear?: { name?: string };
};

export default function OfficeFees() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Dash>('/v1/school-mobile/principal/fees')
        .then((row) => {
          setData(row);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <OfficeShell
      title="Fees"
      subtitle={data?.academicYear?.name || 'Collection overview'}
      loading={loading}
      error={error}
    >
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Collected this month</Text>
        <Text style={styles.heroValue}>{inr(data?.monthCollection ?? 0)}</Text>
        <Text style={styles.heroHint}>{data?.monthPaid ?? 0} students paid</Text>
      </View>
      <View style={styles.kpis}>
        <Kpi
          label="Today"
          value={inr(data?.todayCollection ?? 0)}
          tint="#ecfdf5"
          hint={`${data?.todayCount ?? 0} receipts`}
        />
        <Kpi
          label="Pending"
          value={inr(data?.pendingFees ?? 0)}
          tint="#fff1f2"
          hint={`${data?.monthPending ?? 0} students`}
        />
      </View>
      <Text style={styles.section}>By class this month</Text>
      {(data?.byClass ?? []).map((row) => (
        <RowCard
          key={row.name}
          title={row.name}
          meta={`${row.paid} paid`}
          right={<Text style={styles.amt}>{inr(row.amount)}</Text>}
        />
      ))}
      <Text style={styles.section}>Year collection</Text>
      {(data?.byMonth ?? []).slice(-8).map((row) => (
        <RowCard
          key={row.month}
          title={row.label}
          meta={`${row.count} receipts`}
          right={<Text style={styles.amt}>{inr(row.amount)}</Text>}
        />
      ))}
    </OfficeShell>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#0f766e', borderRadius: 20, padding: 18 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  heroHint: { color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  kpis: { flexDirection: 'row', gap: 8 },
  section: { fontWeight: '800', color: colors.ink, marginTop: 4 },
  amt: { color: colors.navy, fontWeight: '800' },
});
