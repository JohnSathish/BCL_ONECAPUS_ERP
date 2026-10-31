import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StudentScreenShell } from '@/components/student-portal/student-screen-shell';
import { studentTheme } from '@/components/student-portal/theme';
import { formatInr } from '@/utils/currency';
import {
  fetchOpacAccount,
  fetchOpacBook,
  fetchOpacDigital,
  fetchStudentLibraryDashboard,
  fetchStudentLibraryFines,
  fetchStudentLibraryLoans,
  formatLibraryDate,
  renewMyLibraryCopy,
  searchMyLibrary,
  type LibraryFine,
  type LibraryLoan,
  type OpacAccount,
  type OpacBook,
  type OpacCatalogueHit,
  type OpacDigitalItem,
} from '@/services/student-library';

function LoanCard({ loan, onRenew }: { loan: LibraryLoan; onRenew?: (barcode: string) => void }) {
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
      {!loan.returnedAt && loan.copy?.barcode ? (
        <Pressable style={styles.renewButton} onPress={() => onRenew?.(loan.copy?.barcode || '')}>
          <Text style={styles.renewText}>Renew</Text>
        </Pressable>
      ) : null}
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

export function LibraryDesk() {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LibraryLoan[]>([]);
  const [fines, setFines] = useState<LibraryFine[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [outstandingFine, setOutstandingFine] = useState(0);
  const [readingScore, setReadingScore] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<OpacCatalogueHit[]>([]);
  const [searchNote, setSearchNote] = useState('');
  const [renewNote, setRenewNote] = useState('');
  const [account, setAccount] = useState<OpacAccount | null>(null);
  const [digital, setDigital] = useState<OpacDigitalItem[]>([]);
  const [book, setBook] = useState<OpacBook | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loanRows, dashboard, fineRows, opacAccount, digitalRows] = await Promise.all([
        fetchStudentLibraryLoans().catch(() => [] as LibraryLoan[]),
        fetchStudentLibraryDashboard().catch(() => null),
        fetchStudentLibraryFines().catch(() => [] as LibraryFine[]),
        fetchOpacAccount().catch(() => null),
        fetchOpacDigital().catch(() => [] as OpacDigitalItem[]),
      ]);
      setLoans(loanRows);
      setAccount(opacAccount);
      setDigital(digitalRows);
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

  const renew = useCallback(
    async (barcode: string) => {
      try {
        await renewMyLibraryCopy(barcode);
        setRenewNote('The book was renewed.');
        await load();
      } catch (error) {
        setRenewNote(error instanceof Error ? error.message : 'This book cannot be renewed.');
      }
    },
    [load],
  );

  const activeLoans = loans.filter((loan) => !loan.returnedAt);
  const recentReturns = loans.filter((loan) => loan.returnedAt).slice(0, 5);

  const reservations = account?.reservations ?? [];
  const announcements = account?.announcements ?? [];
  const history = account?.history ?? [];

  return (
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

          <Text style={styles.sectionTitle}>Search books</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Title, author, ISBN, or accession"
            style={styles.search}
            onSubmitEditing={() => {
              void searchMyLibrary(query.trim())
                .then((result) => {
                  setHits(result.items ?? []);
                  setSearchNote(`${result.total ?? 0} titles`);
                })
                .catch(() => setSearchNote('Search could not be completed.'));
            }}
          />
          {searchNote ? <Text style={styles.muted}>{searchNote}</Text> : null}
          {hits.map((hit) => (
            <Pressable
              key={hit.id}
              style={styles.loanCard}
              onPress={() => {
                void fetchOpacBook(hit.id)
                  .then(setBook)
                  .catch(() => setSearchNote('Book details are not available.'));
              }}
            >
              <Text style={styles.loanTitle}>{hit.title}</Text>
              {hit.author ? <Text style={styles.loanMeta}>{hit.author}</Text> : null}
              <Text style={styles.loanMeta}>
                {hit.available > 0
                  ? `${hit.available} of ${hit.total} available for issue`
                  : hit.reference > 0
                    ? 'Reference only'
                    : 'No copy available for issue'}
              </Text>
            </Pressable>
          ))}
          {book ? (
            <View style={styles.loanCard}>
              <Text style={styles.loanTitle}>{book.title}</Text>
              <Text style={styles.loanMeta}>
                {[book.author, book.publicationYear, book.publisher].filter(Boolean).join(' · ')}
              </Text>
              {book.isbn ? <Text style={styles.loanMeta}>ISBN {book.isbn}</Text> : null}
              {book.department ? (
                <Text style={styles.loanMeta}>Department {book.department}</Text>
              ) : null}
              {book.subject ? <Text style={styles.loanMeta}>Subject {book.subject}</Text> : null}
              {(book.copies ?? []).slice(0, 6).map((copy) => (
                <Text key={copy.barcode} style={styles.loanMeta}>
                  {copy.accessionNumber} · {copy.availability}
                  {copy.shelf ? ` · Shelf ${copy.shelf}` : ''}
                  {copy.callNumber ? ` · ${copy.callNumber}` : ''}
                </Text>
              ))}
            </View>
          ) : null}

          {renewNote ? <Text style={styles.muted}>{renewNote}</Text> : null}
          <Text style={styles.sectionTitle}>Currently Issued</Text>
          {activeLoans.length === 0 ? (
            <Text style={styles.muted}>No books currently issued to your account.</Text>
          ) : (
            activeLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} onRenew={(barcode) => void renew(barcode)} />
            ))
          )}

          {recentReturns.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Recently Returned</Text>
              {recentReturns.map((loan) => (
                <LoanCard key={`returned-${loan.id}`} loan={loan} />
              ))}
            </>
          ) : null}

          {reservations.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Reservations</Text>
              {reservations.map((row) => (
                <Text key={row.id} style={styles.muted}>
                  {row.title}
                  {row.queuePosition ? ` · queue ${row.queuePosition}` : ''} · {row.status}
                </Text>
              ))}
            </>
          ) : null}

          {history.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Borrowing history</Text>
              {history.slice(0, 6).map((row) => (
                <Text key={row.id} style={styles.muted}>
                  {row.title}
                  {row.returnedAt ? ` · returned ${formatLibraryDate(row.returnedAt)}` : ''}
                </Text>
              ))}
            </>
          ) : null}

          {announcements.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Library announcements</Text>
              {announcements.map((row) => (
                <Text key={row.text} style={styles.muted}>
                  {row.text}
                </Text>
              ))}
            </>
          ) : null}

          {digital.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Digital library</Text>
              {digital.slice(0, 8).map((item) => (
                <Text key={item.id} style={styles.muted}>
                  {item.title}
                  {item.author ? ` · ${item.author}` : ''}
                </Text>
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
  );
}

export default function StudentLibraryScreen() {
  return (
    <StudentScreenShell title="Library / OPAC" subtitle="Catalogue, loans, and due dates">
      <LibraryDesk />
    </StudentScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  search: {
    backgroundColor: studentTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: studentTheme.text,
  },
  renewButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: studentTheme.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  renewText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
