import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { FacultyScreenShell } from '@/components/faculty-portal/faculty-screen-shell';
import { useFacultyPortal } from '@/components/faculty-portal/faculty-portal-context';
import { facultyTheme } from '@/components/faculty-portal/theme';
import { formatInr } from '@/utils/currency';
import {
  downloadAndSharePayslipPdf,
  fetchStaffPayslips,
  type StaffPayslip,
} from '@/services/faculty-payroll';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FacultyPayrollScreen() {
  const { home } = useFacultyPortal();
  const { width } = useWindowDimensions();
  const payroll = home?.payroll;
  const [payslips, setPayslips] = useState<StaffPayslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchStaffPayslips();
      setPayslips(rows);
      setMessage('');
    } catch (e) {
      setPayslips([]);
      setMessage(e instanceof Error ? e.message : 'Could not load payslips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDownload(row: StaffPayslip) {
    setBusyId(row.id);
    setMessage('');
    try {
      const label = `Payslip_${MONTHS[(row.month ?? 1) - 1]}_${row.year}`;
      await downloadAndSharePayslipPdf(row.id, label);
      setMessage('Payslip ready to share / save');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <FacultyScreenShell title="Payroll & Payslips" subtitle="Salary summary and PDF downloads">
      <ScrollView
        contentContainerStyle={[styles.container, { paddingHorizontal: width < 360 ? 12 : 16 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Latest Salary</Text>
          <Text style={styles.amount}>{formatInr(payroll?.amount ?? 0)}</Text>
          <View style={styles.summaryMeta}>
            <Text style={styles.meta}>Status: {payroll?.status ?? '—'}</Text>
            <Text style={styles.meta}>
              Last paid:{' '}
              {payroll?.lastPaymentDate
                ? new Date(payroll.lastPaymentDate).toLocaleDateString('en-IN')
                : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Payslip History</Text>
          {loading && payslips.length === 0 ? (
            <ActivityIndicator color={facultyTheme.primary} style={{ marginTop: 12 }} />
          ) : payslips.length === 0 ? (
            <Text style={styles.muted}>
              {message || 'No payslips available yet. Contact accounts if salary was credited.'}
            </Text>
          ) : (
            payslips.map((row) => (
              <View key={row.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {MONTHS[(row.month ?? 1) - 1]} {row.year}
                  </Text>
                  <Text style={styles.rowMeta}>
                    Net {formatInr(row.netSalary ?? 0)} · Gross {formatInr(row.grossSalary ?? 0)}
                  </Text>
                </View>
                <Pressable
                  style={[styles.downloadBtn, busyId === row.id && styles.downloadBusy]}
                  disabled={busyId === row.id}
                  onPress={() => void onDownload(row)}
                >
                  <Text style={styles.downloadText}>{busyId === row.id ? '…' : 'PDF'}</Text>
                </Pressable>
              </View>
            ))
          )}
          {message && payslips.length > 0 ? <Text style={styles.hint}>{message}</Text> : null}
        </View>
      </ScrollView>
    </FacultyScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, gap: 12, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: facultyTheme.primary,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  amount: { fontSize: 28, fontWeight: '800', color: '#fff' },
  summaryLabel: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  summaryMeta: { gap: 2, marginTop: 4 },
  meta: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  card: {
    backgroundColor: facultyTheme.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: facultyTheme.border,
    gap: 10,
  },
  section: { fontSize: 15, fontWeight: '800', color: facultyTheme.text },
  muted: { fontSize: 13, color: facultyTheme.textMuted, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: facultyTheme.border,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: facultyTheme.text },
  rowMeta: { fontSize: 12, color: facultyTheme.textMuted, marginTop: 2 },
  downloadBtn: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  downloadBusy: { opacity: 0.6 },
  downloadText: { fontSize: 12, fontWeight: '800', color: facultyTheme.primary },
  hint: { fontSize: 12, color: facultyTheme.textMuted },
});
