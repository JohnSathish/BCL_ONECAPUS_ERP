import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiBaseSync } from '@/auth/school-config';
import { studentTheme } from '@/components/student-portal/theme';
import {
  fetchOpacAccount,
  fetchOpacBook,
  fetchOpacDigital,
  fetchStudentLibraryDashboard,
  fetchStudentLibraryFines,
  fetchStudentLibraryLoans,
  formatLibraryDate,
  libraryRequestMessage,
  renewMyLibraryCopy,
  reserveOpacBook,
  searchMyLibrary,
  type LibraryFine,
  type LibraryLoan,
  type OpacAccount,
  type OpacBook,
  type OpacCatalogueHit,
  type OpacDigitalItem,
  type OpacSearchField,
  type StudentLibraryDashboard,
} from '@/services/student-library';
import { formatInr } from '@/utils/currency';

type Tab = 'home' | 'search' | 'books' | 'fines' | 'profile';
type Material = 'all' | 'book' | 'journal' | 'ebook';

const FIELDS: { id: OpacSearchField; label: string }[] = [
  { id: 'all', label: 'All fields' },
  { id: 'title', label: 'Title' },
  { id: 'author', label: 'Author' },
  { id: 'isbn', label: 'ISBN' },
  { id: 'publisher', label: 'Publisher' },
  { id: 'subject', label: 'Subject' },
  { id: 'accession', label: 'Accession' },
  { id: 'call', label: 'Call number' },
];

function coverUri(url?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) {
    const origin = getApiBaseSync().replace(/\/api\/?$/, '');
    return `${origin}${url}`;
  }
  return null;
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const due = new Date(value).getTime();
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - Date.now()) / 86_400_000);
}

function availabilityLabel(hit: OpacCatalogueHit) {
  if (hit.availability === 'available' || hit.available > 0) return 'Available';
  if (hit.availability === 'issued' || (hit.borrowed ?? 0) > 0) return 'Issued';
  if (hit.availability === 'reference' || hit.reference > 0) return 'Reference';
  return 'Unavailable';
}

function availabilityTone(label: string) {
  if (label === 'Available') return styles.pillAvailable;
  if (label === 'Issued') return styles.pillIssued;
  return styles.pillHold;
}

export function OpacDesk() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<LibraryLoan[]>([]);
  const [fines, setFines] = useState<LibraryFine[]>([]);
  const [dashboard, setDashboard] = useState<StudentLibraryDashboard | null>(null);
  const [account, setAccount] = useState<OpacAccount | null>(null);
  const [digital, setDigital] = useState<OpacDigitalItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [field, setField] = useState<OpacSearchField>('all');
  const [year, setYear] = useState('');
  const [availability, setAvailability] = useState<'' | 'available' | 'borrowed' | 'reference'>('');
  const [material, setMaterial] = useState<Material>('all');
  const [advanced, setAdvanced] = useState(false);
  const [hits, setHits] = useState<OpacCatalogueHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [searchFailed, setSearchFailed] = useState(false);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [book, setBook] = useState<OpacBook | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [reserveNote, setReserveNote] = useState('');

  const loadAccount = useCallback(async () => {
    const [loanRows, fineRows, home, member, digitalRows] = await Promise.all([
      fetchStudentLibraryLoans().catch(() => [] as LibraryLoan[]),
      fetchStudentLibraryFines().catch(() => [] as LibraryFine[]),
      fetchStudentLibraryDashboard().catch(() => null),
      fetchOpacAccount().catch(() => null),
      fetchOpacDigital().catch(() => null),
    ]);
    setLoans(loanRows);
    setFines(fineRows);
    setDashboard(home);
    setAccount(member);
    setDigital(digitalRows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAccount().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadAccount]);

  const runSearch = useCallback(
    async (nextPage = 1) => {
      const q = query.trim();
      if (!q) {
        setHits([]);
        setTotal(0);
        setSearchFailed(false);
        setSearchMessage('');
        return;
      }
      if (material === 'ebook') {
        const rows = (digital ?? []).filter((item) => {
          const haystack = `${item.title} ${item.author ?? ''}`.toLowerCase();
          return haystack.includes(q.toLowerCase());
        });
        setHits([]);
        setTotal(rows.length);
        setSearchFailed(false);
        setSearchMessage(rows.length ? '' : 'No books found. Try another title or author.');
        setPage(1);
        return;
      }
      setSearching(true);
      setSearchFailed(false);
      if (nextPage === 1) setSearchMessage('');
      try {
        const result = await searchMyLibrary({
          q,
          field,
          page: nextPage,
          year: year.trim() || undefined,
          availability: availability || undefined,
          material: material === 'book' || material === 'journal' ? material : undefined,
        });
        const items = result.items ?? [];
        setHits((current) => (nextPage === 1 ? items : [...current, ...items]));
        setTotal(result.total ?? items.length);
        setPage(nextPage);
        if (nextPage === 1 && items.length === 0) {
          setSearchMessage('No books found. Try another title or author.');
        }
      } catch (error) {
        setHits([]);
        setTotal(0);
        setSearchFailed(true);
        setSearchMessage(libraryRequestMessage(error));
      } finally {
        setSearching(false);
      }
    },
    [availability, digital, field, material, query, year],
  );

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      void runSearch(1);
    }, 450);
    return () => clearTimeout(timer);
  }, [query, field, year, availability, material, runSearch]);

  const openBook = useCallback(async (id: string) => {
    setOpenedId(id);
    setDetailLoading(true);
    setDetailError('');
    setReserveNote('');
    setBook(null);
    try {
      setBook(await fetchOpacBook(id));
    } catch (error) {
      setDetailError(libraryRequestMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const activeLoans = loans.filter((loan) => !loan.returnedAt);
  const issuedNow = dashboard?.stats?.activeLoans ?? account?.stats?.borrowed ?? null;
  const finesDue = dashboard?.stats?.outstandingFine ?? account?.stats?.outstandingFine ?? null;
  const readingScore = dashboard?.readingScore?.overall ?? null;
  const booksRead = account?.stats?.totalBorrowed ?? dashboard?.stats?.totalLoans ?? null;
  const ebookHits =
    material === 'ebook'
      ? (digital ?? []).filter((item) =>
          `${item.title} ${item.author ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : [];

  if (book || detailLoading || detailError) {
    return (
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={() => {
            setBook(null);
            setDetailError('');
            setOpenedId(null);
          }}
        >
          <Text style={styles.back}>‹ Back to results</Text>
        </Pressable>
        {detailLoading ? <ActivityIndicator color={studentTheme.primary} /> : null}
        {detailError ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{detailError}</Text>
            <Pressable style={styles.retry} onPress={() => openedId && void openBook(openedId)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {book ? (
          <BookDetail
            book={book}
            canReserve={account?.reservationEnabled === true}
            note={reserveNote}
            onReserve={async () => {
              try {
                await reserveOpacBook(book.id);
                setReserveNote('Your reservation was sent to the library.');
              } catch (error) {
                setReserveNote(libraryRequestMessage(error));
              }
            }}
          />
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 92 }]}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <ActivityIndicator color={studentTheme.primary} style={{ marginTop: 12 }} />
        ) : null}
        {tab === 'home' || tab === 'search' ? (
          <>
            {tab === 'home' ? (
              <View style={styles.statsGrid}>
                <Stat
                  label="Issued Now"
                  value={issuedNow == null ? '—' : String(issuedNow)}
                  tint="#dbeafe"
                  mark="📗"
                />
                <Stat
                  label="Fines Due"
                  value={finesDue == null ? '—' : formatInr(Number(finesDue))}
                  tint="#fee2e2"
                  mark="₹"
                />
                <Stat
                  label="Reading Score"
                  value={readingScore == null ? '—' : String(readingScore)}
                  tint="#e0f2fe"
                  mark="🔖"
                />
                <Stat
                  label="Books Read"
                  value={booksRead == null ? '—' : String(booksRead)}
                  tint="#ede9fe"
                  mark="↺"
                />
              </View>
            ) : null}
            <View style={styles.searchCard}>
              <View style={styles.searchHead}>
                <View style={styles.titleRow}>
                  <Ionicons name="library" size={18} color="#2563eb" />
                  <Text style={styles.sectionTitle}>Search Books</Text>
                </View>
                <Pressable style={styles.titleRow} onPress={() => setAdvanced((open) => !open)}>
                  <Ionicons name="options-outline" size={14} color={studentTheme.primaryLight} />
                  <Text style={styles.link}>{advanced ? 'Hide filters' : 'Advanced Search'}</Text>
                </Pressable>
              </View>
              <View style={styles.searchRow}>
                <View style={styles.searchField}>
                  <Ionicons name="search" size={16} color={studentTheme.textSubtle} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Title, author, ISBN, accession"
                    placeholderTextColor={studentTheme.textSubtle}
                    style={styles.searchInput}
                    returnKeyType="search"
                    autoCorrect={false}
                    onSubmitEditing={() => {
                      setTab('search');
                      void runSearch(1);
                    }}
                  />
                  {query ? (
                    <Pressable
                      onPress={() => {
                        setQuery('');
                        setHits([]);
                        setTotal(0);
                        setSearchFailed(false);
                        setSearchMessage('');
                      }}
                      style={styles.clear}
                    >
                      <Ionicons name="close-circle" size={18} color={studentTheme.textSubtle} />
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  style={styles.searchButton}
                  onPress={() => {
                    setTab('search');
                    void runSearch(1);
                  }}
                >
                  <Ionicons name="search" size={16} color="#fff" />
                  <Text style={styles.searchButtonText}>Search</Text>
                </Pressable>
              </View>
              {advanced ? (
                <View style={styles.advanced}>
                  <View style={styles.chips}>
                    {FIELDS.map((item) => (
                      <Pressable
                        key={item.id}
                        style={[styles.chip, field === item.id && styles.chipOn]}
                        onPress={() => setField(item.id)}
                      >
                        <Text style={[styles.chipText, field === item.id && styles.chipTextOn]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={year}
                    onChangeText={setYear}
                    placeholder="Publication year"
                    keyboardType="number-pad"
                    style={styles.yearInput}
                  />
                  <View style={styles.chips}>
                    {(
                      [
                        ['', 'Any availability'],
                        ['available', 'Available'],
                        ['borrowed', 'Issued'],
                        ['reference', 'Reference'],
                      ] as const
                    ).map(([id, label]) => (
                      <Pressable
                        key={label}
                        style={[styles.chip, availability === id && styles.chipOn]}
                        onPress={() => setAvailability(id)}
                      >
                        <Text style={[styles.chipText, availability === id && styles.chipTextOn]}>
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
            <View style={styles.chips}>
              {(
                [
                  ['all', 'All', 'grid-outline'],
                  ['book', 'Books', 'book-outline'],
                  ...(digital ? [['ebook', 'eBooks', 'tablet-portrait-outline'] as const] : []),
                  ['journal', 'Journals', 'newspaper-outline'],
                ] as Array<[Material, string, keyof typeof Ionicons.glyphMap]>
              ).map(([id, label, icon]) => (
                <Pressable
                  key={id}
                  style={[styles.chip, material === id && styles.chipOn]}
                  onPress={() => {
                    setMaterial(id);
                    setTab('search');
                  }}
                >
                  <Ionicons
                    name={icon}
                    size={14}
                    color={material === id ? '#fff' : studentTheme.text}
                  />
                  <Text style={[styles.chipText, material === id && styles.chipTextOn]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {tab === 'search' ? (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>
              {query.trim() && !searchFailed
                ? `Search Results (${material === 'ebook' ? ebookHits.length : total})`
                : 'Search Results'}
            </Text>
            {searching ? <ActivityIndicator color={studentTheme.primary} /> : null}
            {searchMessage ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyArt}>
                  <Ionicons name="library" size={36} color="#2563eb" />
                  <View style={styles.emptyGlass}>
                    <Ionicons name="search" size={22} color="#7c3aed" />
                  </View>
                </View>
                <Text style={styles.emptyTitle}>{searchMessage}</Text>
                {searchFailed ? (
                  <Pressable style={styles.retry} onPress={() => void runSearch(1)}>
                    <Ionicons name="refresh" size={14} color="#fff" />
                    <Text style={styles.retryText}>Retry</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {material === 'ebook'
              ? ebookHits.map((item) => (
                  <View key={item.id} style={styles.resultCard}>
                    <View style={styles.coverFallback}>
                      <Text style={styles.coverLetter}>e</Text>
                    </View>
                    <View style={styles.resultBody}>
                      <Text style={styles.resultTitle}>{item.title}</Text>
                      {item.author ? <Text style={styles.muted}>{item.author}</Text> : null}
                      <Text style={styles.muted}>{item.assetType || 'Digital'}</Text>
                    </View>
                  </View>
                ))
              : hits.map((hit) => {
                  const label = availabilityLabel(hit);
                  const image = coverUri(hit.coverImageUrl);
                  return (
                    <Pressable
                      key={hit.id}
                      style={styles.resultCard}
                      onPress={() => void openBook(hit.id)}
                    >
                      {image ? (
                        <Image source={{ uri: image }} style={styles.cover} />
                      ) : (
                        <View style={styles.coverFallback}>
                          <Text style={styles.coverLetter}>
                            {hit.title.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.resultBody}>
                        <Text style={styles.resultTitle}>{hit.title}</Text>
                        {hit.author ? <Text style={styles.muted}>{hit.author}</Text> : null}
                        <Text style={styles.muted}>
                          {[
                            hit.bookType || 'Book',
                            hit.publicationYear,
                            hit.pages ? `${hit.pages} pages` : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                        <View style={styles.resultMeta}>
                          <Text style={[styles.pill, availabilityTone(label)]}>{label}</Text>
                          {hit.callNumber ? (
                            <Text style={styles.muted}>Call No: {hit.callNumber}</Text>
                          ) : null}
                        </View>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                  );
                })}
            {material !== 'ebook' && hits.length < total ? (
              <Pressable
                style={styles.retry}
                onPress={() => void runSearch(page + 1)}
                disabled={searching}
              >
                <Text style={styles.retryText}>{searching ? 'Loading…' : 'Load more'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {tab === 'home' || tab === 'books' ? (
          <View style={styles.block}>
            <View style={styles.searchHead}>
              <Text style={styles.sectionTitle}>Currently Issued</Text>
              {tab === 'home' ? (
                <Pressable onPress={() => setTab('books')}>
                  <Text style={styles.link}>View All</Text>
                </Pressable>
              ) : null}
            </View>
            {(tab === 'home' ? activeLoans.slice(0, 3) : activeLoans).length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No books currently issued to your account.</Text>
                <Text style={styles.muted}>
                  You can search the catalogue and ask the library to reserve a book.
                </Text>
              </View>
            ) : (
              (tab === 'home' ? activeLoans.slice(0, 3) : activeLoans).map((loan) => {
                const remaining = daysUntil(loan.dueAt);
                const overdue = (loan.daysOverdue ?? 0) > 0 || (remaining != null && remaining < 0);
                return (
                  <View key={loan.id} style={styles.resultCard}>
                    <View style={styles.coverFallback}>
                      <Text style={styles.coverLetter}>
                        {(loan.copy?.book?.title ?? 'B').slice(0, 1)}
                      </Text>
                    </View>
                    <View style={styles.resultBody}>
                      <Text style={styles.resultTitle}>{loan.copy?.book?.title ?? 'Book'}</Text>
                      <Text style={styles.muted}>Issued {formatLibraryDate(loan.issuedAt)}</Text>
                      <Text style={styles.muted}>Due {formatLibraryDate(loan.dueAt)}</Text>
                      <Text style={overdue ? styles.overdue : styles.muted}>
                        {overdue
                          ? `Overdue${loan.projectedFine ? ` · ${formatInr(Number(loan.projectedFine))}` : ''}`
                          : remaining == null
                            ? ''
                            : `${remaining} day${remaining === 1 ? '' : 's'} remaining`}
                      </Text>
                      {loan.copy?.barcode ? (
                        <Pressable
                          style={styles.retry}
                          onPress={() => {
                            void renewMyLibraryCopy(loan.copy?.barcode || '')
                              .then(() => loadAccount())
                              .catch((error) => setSearchMessage(libraryRequestMessage(error)));
                          }}
                        >
                          <Text style={styles.retryText}>Renew</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {tab === 'fines' ? (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>Fines</Text>
            <Text style={styles.muted}>
              Outstanding {finesDue == null ? '—' : formatInr(Number(finesDue))}
            </Text>
            {fines.length === 0 ? (
              <Text style={styles.emptyTitle}>No library fines on your account.</Text>
            ) : (
              fines.map((fine) => (
                <View key={fine.id} style={styles.resultCard}>
                  <View style={styles.resultBody}>
                    <Text style={styles.resultTitle}>
                      {fine.loan?.copy?.book?.title ?? 'Library fine'}
                    </Text>
                    {fine.reason ? <Text style={styles.muted}>{fine.reason}</Text> : null}
                    <Text style={styles.overdue}>{formatInr(Number(fine.amount ?? 0))}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {tab === 'profile' ? (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>Library account</Text>
            <Text style={styles.resultTitle}>{account?.profile?.name ?? 'Student'}</Text>
            {account?.profile?.code ? (
              <Text style={styles.muted}>Roll / code {account.profile.code}</Text>
            ) : null}
            {account?.profile?.department ? (
              <Text style={styles.muted}>{account.profile.department}</Text>
            ) : null}
            {account?.profile?.card ? (
              <Text style={styles.muted}>Card {account.profile.card}</Text>
            ) : null}
            {account?.profile?.status ? (
              <Text style={styles.muted}>Status {account.profile.status}</Text>
            ) : null}
            {(account?.reservations ?? []).length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Reservations</Text>
                {account?.reservations?.map((row) => (
                  <Text key={row.id} style={styles.muted}>
                    {row.title}
                    {row.queuePosition ? ` · queue ${row.queuePosition}` : ''} · {row.status}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {(
          [
            ['home', 'Home', 'home'],
            ['search', 'Search', 'search'],
            ['books', 'My Books', 'book'],
            ['fines', 'Fines', 'cash'],
            ['profile', 'Profile', 'person'],
          ] as Array<[Tab, string, keyof typeof Ionicons.glyphMap]>
        ).map(([id, label, icon]) => (
          <Pressable key={id} style={styles.navItem} onPress={() => setTab(id)}>
            <View style={[styles.navIcon, tab === id && styles.navIconOn]}>
              <Ionicons
                name={icon}
                size={18}
                color={tab === id ? '#2563eb' : studentTheme.textMuted}
              />
            </View>
            <Text style={[styles.navText, tab === id && styles.navTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  tint,
  mark,
}: {
  label: string;
  value: string;
  tint: string;
  mark: string;
}) {
  return (
    <View style={[styles.stat, { backgroundColor: tint }]}>
      <Text style={styles.statMark}>{mark}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BookDetail({
  book,
  canReserve,
  note,
  onReserve,
}: {
  book: OpacBook;
  canReserve: boolean;
  note: string;
  onReserve: () => Promise<void>;
}) {
  const image = coverUri(book.coverImageUrl);
  const status =
    book.available > 0 ? 'Available' : (book.borrowed ?? 0) > 0 ? 'Issued' : 'Unavailable';
  return (
    <View style={styles.block}>
      {image ? (
        <Image source={{ uri: image }} style={styles.detailCover} />
      ) : (
        <View style={[styles.coverFallback, styles.detailCover]}>
          <Text style={styles.coverLetter}>{book.title.slice(0, 1)}</Text>
        </View>
      )}
      <Text style={styles.resultTitle}>{book.title}</Text>
      <Text style={styles.muted}>{book.author}</Text>
      <Text style={[styles.pill, availabilityTone(status)]}>{status}</Text>
      <Fact label="ISBN" value={book.isbn} />
      <Fact label="Publisher" value={book.publisher} />
      <Fact label="Edition" value={book.edition} />
      <Fact label="Year" value={book.publicationYear} />
      <Fact label="Language" value={book.language} />
      <Fact label="Subject" value={book.subject || book.category} />
      <Fact label="Call number" value={book.classificationNumber} />
      {book.copies.slice(0, 8).map((copy) => (
        <Text key={copy.barcode} style={styles.muted}>
          {copy.accessionNumber} · {copy.availability}
          {copy.callNumber ? ` · ${copy.callNumber}` : ''}
          {copy.shelf ? ` · Shelf ${copy.shelf}` : ''}
        </Text>
      ))}
      {canReserve && book.available === 0 ? (
        <Pressable style={styles.searchButton} onPress={() => void onReserve()}>
          <Text style={styles.searchButtonText}>Reserve book</Text>
        </Pressable>
      ) : null}
      {note ? <Text style={styles.muted}>{note}</Text> : null}
    </View>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Text style={styles.muted}>
      {label}: {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { padding: 16, gap: 12 },
  block: { gap: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '48%', flexGrow: 1, borderRadius: 16, padding: 12, gap: 2 },
  statMark: { fontSize: 16 },
  statValue: { fontSize: 18, fontWeight: '800', color: studentTheme.text },
  statLabel: { fontSize: 11, fontWeight: '700', color: studentTheme.textMuted },
  searchCard: {
    backgroundColor: studentTheme.surface,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  searchHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: studentTheme.text },
  link: { color: studentTheme.primaryLight, fontWeight: '700', fontSize: 13 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: studentTheme.text,
  },
  clear: { padding: 4 },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchButtonText: { color: '#fff', fontWeight: '800' },
  advanced: { gap: 8 },
  yearInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: studentTheme.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  chipOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { color: studentTheme.text, fontSize: 12, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  resultCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: studentTheme.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: studentTheme.border,
    alignItems: 'center',
  },
  cover: { width: 54, height: 74, borderRadius: 8, backgroundColor: '#e2e8f0' },
  coverFallback: {
    width: 54,
    height: 74,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLetter: { color: '#fff', fontSize: 22, fontWeight: '800' },
  detailCover: { width: 120, height: 160, borderRadius: 12 },
  resultBody: { flex: 1, gap: 2 },
  resultTitle: { fontSize: 15, fontWeight: '800', color: studentTheme.text },
  resultMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  muted: { fontSize: 12, color: studentTheme.textMuted },
  pill: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '800',
  },
  pillAvailable: { backgroundColor: '#dcfce7', color: '#166534' },
  pillIssued: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  pillHold: { backgroundColor: '#ffedd5', color: '#c2410c' },
  chevron: { fontSize: 22, color: studentTheme.textSubtle },
  notice: { gap: 8 },
  noticeText: { color: studentTheme.text, fontSize: 14 },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  emptyArt: {
    width: 88,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGlass: {
    position: 'absolute',
    right: 8,
    bottom: 4,
    backgroundColor: '#f5f3ff',
    borderRadius: 999,
    padding: 4,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  empty: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: studentTheme.border,
  },
  emptyTitle: { fontWeight: '700', color: studentTheme.text, textAlign: 'center' },
  overdue: { color: studentTheme.danger, fontWeight: '700', fontSize: 12 },
  back: { color: studentTheme.primaryLight, fontWeight: '800', fontSize: 15 },
  nav: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 8,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingTop: 8,
    paddingHorizontal: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 2 },
  navIcon: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  navIconOn: { backgroundColor: '#dbeafe' },
  navText: { fontSize: 11, fontWeight: '700', color: studentTheme.textMuted },
  navTextOn: { color: '#2563eb' },
});
