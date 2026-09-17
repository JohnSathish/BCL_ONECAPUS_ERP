import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '@/api/client';
import { inr, monthTitle } from '@/fees/format';
import { Card, EmptyState, Feed, Loader, Screen } from '@/ui/kit';
import { colors } from '@/theme/tokens';

type Row = {
  id: string;
  paidAt: string;
  receiptNumber: string;
  months: string[];
  amount: number;
  paymentMode?: string;
};
type MonthRow = { feeMonth: string; monthLabel: string };

export default function FeesHistoryScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{
      monthly?: { history?: Row[]; rows?: MonthRow[] };
    }>('/v1/school-mobile/fees')
      .then((payload) => {
        setRows(payload.monthly?.history ?? []);
        setLabels(
          Object.fromEntries((payload.monthly?.rows ?? []).map((r) => [r.feeMonth, r.monthLabel])),
        );
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => rows, [rows]);

  return (
    <Screen title="Payment History" onBack>
      {loading ? <Loader /> : null}
      {error ? <EmptyState title="Could not load receipts" body={error} /> : null}
      {!loading && !error && !sorted.length ? (
        <EmptyState
          title="No receipts yet"
          body="Payments recorded by the school office will appear here."
        />
      ) : null}
      <Feed>
        {sorted.map((row) => (
          <Card key={row.id}>
            <Text style={styles.title}>{monthTitle(row.months ?? [], labels)}</Text>
            <Text style={styles.meta}>
              {new Date(row.paidAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </Text>
            <Text style={styles.meta}>Transaction ID: {row.receiptNumber}</Text>
            {row.paymentMode ? <Text style={styles.meta}>{row.paymentMode}</Text> : null}
            <Text style={styles.amt}>{inr(row.amount)}</Text>
          </Card>
        ))}
      </Feed>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted, marginTop: 4 },
  amt: { marginTop: 8, fontWeight: '800', color: colors.navy, fontSize: 16 },
});
