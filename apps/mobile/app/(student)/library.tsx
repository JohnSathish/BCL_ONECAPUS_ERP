import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import { formatInr } from '@/utils/currency';
import {
  fetchStudentLibraryDashboard,
  fetchStudentLibraryFines,
  fetchStudentLibraryLoans,
  formatLibraryDate,
  type LibraryFine,
  type LibraryLoan,
} from '@/services/student-library';

function LoanCard({ loan }: { loan: LibraryLoan }) {
  const title = loan.copy?.book?.title ?? 'Book';
  const author = loan.copy?.book?.author;
  const overdue = loan.status === 'ACTIVE' && (loan.daysOverdue ?? 0) > 0;
  return (
    <View style={[styles.loanCard, overdue ? styles.loanCardOverdue : null]}>
      <Text style={styles.loanTitle}>{title}</Text>
      {author ? <Text style={styles.loanMeta}>by {author}</Text> : null}
      <Text style={styles.loanMeta}>
        Issued {formatLibraryDate(loan.issuedAt)} · Due {formatLibraryDate(loan.dueAt)}
      </Text>
      {loan.copy?.barcode ? <Text style={styles.loanMeta}>Barcode {loan.copy.barcode}</Text> : null}
      {loan.returnedAt ? (
        <Text style={styles.returned}>Returned {formatLibraryDate(loan.returnedAt)}</Text>
      ) : overdue ? (
        <Text style={styles.overdue}>{loan.daysOverdue} day(s) overdue</Text>
      ) : (
        <Text style={styles.active}>Currently issued</Text>
      )}
    </View>
  );
}

function FineRow({ fine }: { fine: LibraryFine }) {
  const title = fine.loan?.copy?.book?.title ?? 'Library fine';
  return (
    <View style={styles.fineRow}>
      <View style={styles.fineInfo}>
        <Text style={styles.fineTitle}>{title}</Text>
        {fine.reason ? <Text style={styles.fineMeta}>{fine.reason}</Text> : null}
      </View>
      <Text style={styles.fineAmount}>{formatInr(Number(fine.amount ?? 0))}</Text>
    </View>
  );
}

export default function StudentLibraryScreen() {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LibraryLoan[]>([]);
  const [fines, setFines] = useState<LibraryFine[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [outstandingFine, setOutstandingFine] = useState(0);
  const [readingScore, setReadingScore] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loanRows, dashboard, fineRows] = await Promise.all([
        fetchStudentLibraryLoans().catch(() => []),
        fetchStudentLibraryDashboard().catch(() => null),
        fetchStudentLibraryFines().catch(() => []),
      ]);
      setLoans(loanRows);
      setFines(fineRows);
      setActiveCount(dashboard?.stats?.activeLoans ?? loanRows.filter((l) => !l.returnedAt).length);
      setOutstandingFine(Number(dashboard?.stats?.outstandingFine ?? 0));
      setReadingScore(dashboard?.readingScore?.overall ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeLoans = loans.filter((loan) => !loan.returnedAt);
  const recentReturns = loans.filter((loan) => loan.returnedAt).slice(0, 5);

  return (
    <StudentScreenShell title="Library" subtitle="Issued books & fines">
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        {loading && loans.length === 0 ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 24 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{activeCount}</Text>
                <Text style={styles.statLabel}>Issued Now</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{formatInr(outstandingFine)}</Text>
                <Text style={styles.statLabel}>Fines Due</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{readingScore ?? '—'}</Text>
                <Text style={styles.statLabel}>Reading Score</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Currently Issued</Text>
            {activeLoans.length === 0 ? (
              <Text style={styles.muted}>No books currently issued to your account.</Text>
            ) : (
              activeLoans.map((loan) => <LoanCard key={loan.id} loan={loan} />)
            )}

            {recentReturns.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Recently Returned</Text>
                {recentReturns.map((loan) => (
                  <LoanCard key={`returned-${loan.id}`} loan={loan} />
                ))}
              </>
            ) : null}

            {fines.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Outstanding Fines</Text>
                <View style={styles.finesCard}>
                  {fines.map((fine) => (
                    <FineRow key={fine.id} fine={fine} />
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  muted: { fontSize: 13, color: studentTheme.textMuted },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: studentTheme.surface,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  statValue: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  statLabel: { fontSize: 10, fontWeight: '700', color: studentTheme.textMuted, marginTop: 4 },
  loanCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: studentTheme.border,
    gap: 4,
  },
  loanCardOverdue: { borderColor: '#fecaca', backgroundColor: '#fff1f2' },
  loanTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  loanMeta: { fontSize: 12, color: studentTheme.textMuted },
  active: { fontSize: 12, fontWeight: '700', color: studentTheme.primaryLight, marginTop: 4 },
  returned: { fontSize: 12, fontWeight: '700', color: studentTheme.success, marginTop: 4 },
  overdue: { fontSize: 12, fontWeight: '700', color: studentTheme.danger, marginTop: 4 },
  finesCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: studentTheme.border,
    overflow: 'hidden',
  },
  fineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  fineInfo: { flex: 1, gap: 2 },
  fineTitle: { fontSize: 13, fontWeight: '700', color: studentTheme.text },
  fineMeta: { fontSize: 11, color: studentTheme.textMuted },
  fineAmount: { fontSize: 13, fontWeight: '800', color: studentTheme.danger },
});
