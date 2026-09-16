import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text } from 'react-native';
import { fetchSchoolFees, fetchActivePaymentGateway } from '@/api/school-mobile';
import { SchoolCard, SchoolEmpty, SchoolShell } from '@/components/school-sis/school-shell';
import { useSchoolSession } from '@/store/school-session';
import { schoolUi } from '@/theme/school-ui';

function rec(v: unknown) {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

export default function SchoolFeesScreen() {
  const childId = useSchoolSession((s) => s.childId);
  const persona = useSchoolSession((s) => s.persona);
  const q = useQuery({
    queryKey: ['school-fees', childId],
    queryFn: () => fetchSchoolFees(childId),
  });
  const gw = useQuery({
    queryKey: ['school-pay-gw'],
    queryFn: fetchActivePaymentGateway,
  });
  const data = rec(q.data);
  const pending = Number(data.pending ?? data.outstanding ?? data.due ?? 0);
  const paid = Number(data.paid ?? data.collected ?? 0);
  const total = Number(data.total ?? paid + pending);
  const heads = Array.isArray(data.heads ?? data.breakdown ?? data.items)
    ? ((data.heads ?? data.breakdown ?? data.items) as Record<string, unknown>[])
    : [];

  if (persona === 'teacher' || persona === 'librarian' || persona === 'transport') {
    return (
      <SchoolShell title="Fees">
        <SchoolEmpty title="Not available" body="This module is not part of your role." />
      </SchoolShell>
    );
  }

  return (
    <SchoolShell title="Fees" loading={q.isLoading} onRefresh={() => void q.refetch()}>
      <SchoolCard>
        <Text style={styles.k}>Outstanding</Text>
        <Text style={styles.hero}>₹{pending.toLocaleString('en-IN')}</Text>
        <Text style={styles.m}>
          Paid ₹{paid.toLocaleString('en-IN')} · Total ₹{total.toLocaleString('en-IN')}
        </Text>
      </SchoolCard>
      {heads.map((h, i) => (
        <SchoolCard key={i}>
          <Text style={styles.k}>{String(h.name ?? h.head ?? h.label ?? 'Fee head')}</Text>
          <Text style={styles.line}>
            ₹{Number(h.pending ?? h.amount ?? h.due ?? 0).toLocaleString('en-IN')}
          </Text>
        </SchoolCard>
      ))}
      {gw.data?.available ? (
        <SchoolCard>
          <Text style={styles.k}>Pay now</Text>
          <Text style={styles.m}>
            {gw.data.name} ({gw.data.provider}). Payment is created and verified by the school ERP —
            this app never marks a fee as paid on its own.
          </Text>
        </SchoolCard>
      ) : (
        <SchoolCard>
          <Text style={styles.m}>
            Online payment is not configured for this school. Pay at the office or wait until a
            default gateway is activated.
          </Text>
        </SchoolCard>
      )}
    </SchoolShell>
  );
}

const styles = StyleSheet.create({
  k: { color: schoolUi.colors.muted, fontWeight: '800', textTransform: 'uppercase', fontSize: 12 },
  hero: { fontSize: 28, fontWeight: '800', color: schoolUi.colors.primary, marginTop: 6 },
  m: { color: schoolUi.colors.muted, marginTop: 6, lineHeight: 20 },
  line: { fontWeight: '700', marginTop: 4, color: schoolUi.colors.text },
});
