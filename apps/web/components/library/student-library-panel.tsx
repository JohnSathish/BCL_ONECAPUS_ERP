'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  cancelLibraryReservation,
  downloadDigitalAsset,
  downloadResearchItem,
  fetchDigitalAssets,
  fetchMyLibraryDashboard,
  fetchMyLibraryFines,
  fetchMyLibraryLoans,
  fetchMyLibraryQr,
  fetchMyLibraryReservations,
  fetchMyLibraryVisits,
  fetchPopularDigitalAssets,
  fetchResearchItems,
  reserveLibraryBook,
  searchLibrary,
  selfCheckInLibrary,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';
import { LibraryKnowledgeAssistant } from '@/components/library/library-knowledge-assistant';

function ReadingScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-muted-foreground';
  return (
    <div
      className={`flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 ${color} border-current bg-background`}
    >
      <span className="text-2xl font-bold">{pct}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-80">Score</span>
    </div>
  );
}

export function StudentLibraryPanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [checkInMsg, setCheckInMsg] = useState('');
  const [reserveQuery, setReserveQuery] = useState('');
  const [reserveSearch, setReserveSearch] = useState('');
  const [reserveMsg, setReserveMsg] = useState('');

  const searchResults = useQuery({
    queryKey: ['library', 'student', 'search', reserveSearch],
    queryFn: () => searchLibrary(reserveSearch, 10, 'BOOK'),
    enabled: enabled && reserveSearch.length >= 2,
  });

  const dashboard = useQuery({
    queryKey: ['library', 'me', 'dashboard'],
    queryFn: fetchMyLibraryDashboard,
    enabled,
  });

  const qr = useQuery({ queryKey: ['library', 'me', 'qr'], queryFn: fetchMyLibraryQr, enabled });
  const visits = useQuery({
    queryKey: ['library', 'me', 'visits'],
    queryFn: fetchMyLibraryVisits,
    enabled,
  });
  const loans = useQuery({
    queryKey: ['library', 'me', 'loans'],
    queryFn: fetchMyLibraryLoans,
    enabled,
  });
  const myFines = useQuery({
    queryKey: ['library', 'me', 'fines'],
    queryFn: fetchMyLibraryFines,
    enabled,
  });
  const reservations = useQuery({
    queryKey: ['library', 'me', 'reservations'],
    queryFn: fetchMyLibraryReservations,
    enabled,
  });
  const digital = useQuery({
    queryKey: ['library', 'digital', 'student'],
    queryFn: () => fetchDigitalAssets({ limit: 20 }),
    enabled,
  });
  const popular = useQuery({
    queryKey: ['library', 'digital', 'popular'],
    queryFn: fetchPopularDigitalAssets,
    enabled,
  });
  const research = useQuery({
    queryKey: ['library', 'research', 'student'],
    queryFn: () => fetchResearchItems({ limit: 20, status: 'PUBLISHED' }),
    enabled,
  });

  const downloadDigitalMut = useMutation({
    mutationFn: async ({ id, fileName }: { id: string; fileName: string }) => {
      const blob = await downloadDigitalAsset(id);
      downloadBlob(blob, fileName || 'download.pdf');
    },
  });

  const downloadResearchMut = useMutation({
    mutationFn: async ({ id, fileName }: { id: string; fileName: string }) => {
      const blob = await downloadResearchItem(id);
      downloadBlob(blob, fileName || 'research.pdf');
    },
  });

  const downloadError = downloadDigitalMut.error ?? downloadResearchMut.error;

  const checkInMut = useMutation({
    mutationFn: () => selfCheckInLibrary(),
    onSuccess: (result) => {
      setCheckInMsg(
        result.action === 'ENTRY'
          ? `Checked in${result.zone?.seatLabel ? ` — seat ${result.zone.seatLabel}` : ''}`
          : `Checked out (${result.visit.durationMinutes ?? 0} min)`,
      );
      void qc.invalidateQueries({ queryKey: ['library', 'me', 'visits'] });
      void qc.invalidateQueries({ queryKey: ['library', 'me', 'dashboard'] });
    },
    onError: (e) => setCheckInMsg(apiErrorMessage(e)),
  });

  const reserveMut = useMutation({
    mutationFn: (bookId: string) => reserveLibraryBook(bookId),
    onSuccess: (r) => {
      setReserveMsg(
        `Reserved "${r.book?.title ?? 'book'}" — queue position ${r.queuePosition ?? '?'}`,
      );
      void qc.invalidateQueries({ queryKey: ['library', 'me', 'reservations'] });
      void qc.invalidateQueries({ queryKey: ['library', 'me', 'dashboard'] });
    },
    onError: (e) => setReserveMsg(apiErrorMessage(e)),
  });

  const cancelResMut = useMutation({
    mutationFn: (id: string) => cancelLibraryReservation(id),
    onSuccess: () => {
      setReserveMsg('Reservation cancelled');
      void qc.invalidateQueries({ queryKey: ['library', 'me', 'reservations'] });
      void qc.invalidateQueries({ queryKey: ['library', 'me', 'dashboard'] });
    },
    onError: (e) => setReserveMsg(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      {dashboard.data ? (
        <section className="rounded-xl border bg-gradient-to-br from-indigo-50/80 to-background p-4 dark:from-indigo-950/30">
          <div className="flex flex-wrap items-start gap-4">
            <ReadingScoreRing score={dashboard.data.readingScore.overall} />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{dashboard.data.profile.fullName}</h2>
              <p className="text-sm text-muted-foreground">
                {[
                  dashboard.data.profile.department,
                  dashboard.data.profile.programme,
                  dashboard.data.profile.semester ? `Sem ${dashboard.data.profile.semester}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Library member'}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Visits</p>
                  <p className="font-medium">{dashboard.data.stats.totalVisits}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Books read</p>
                  <p className="font-medium">{dashboard.data.stats.totalLoans}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Active loans</p>
                  <p className="font-medium">{dashboard.data.stats.activeLoans}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reservations</p>
                  <p className="font-medium">{dashboard.data.stats.activeReservations}</p>
                </div>
              </div>
            </div>
          </div>
          {dashboard.data.activeLoans.length ? (
            <ul className="mt-4 space-y-1 border-t pt-3 text-sm">
              {dashboard.data.activeLoans.map((l) => (
                <li key={l.id} className={l.isOverdue ? 'text-destructive' : ''}>
                  {l.bookTitle} — due {new Date(l.dueAt).toLocaleDateString()}
                  {l.isOverdue ? ' (overdue)' : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : dashboard.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your library dashboard…</p>
      ) : null}

      {dashboard.data?.recommendations.length ? (
        <section>
          <h2 className="text-sm font-medium">Recommended for you</h2>
          <p className="text-xs text-muted-foreground">
            Based on your department, courses, and reading history
          </p>
          <ul className="mt-2 space-y-2">
            {dashboard.data.recommendations.map((book) => (
              <li
                key={book.bookId}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{book.title}</p>
                  {book.author ? (
                    <p className="text-xs text-muted-foreground">{book.author}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {book.reasons.map((r) => (
                      <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                        {r}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {book.availableCopies > 0
                      ? `${book.availableCopies} copy available`
                      : 'All copies issued — reserve to join queue'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={book.availableCopies > 0 || reserveMut.isPending}
                  onClick={() => reserveMut.mutate(book.bookId)}
                >
                  {book.availableCopies > 0 ? 'At desk' : 'Reserve'}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {dashboard.data?.readingHistory.length ? (
        <section>
          <h2 className="text-sm font-medium">Reading history</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Title</th>
                  <th className="p-2 text-left">Issued</th>
                  <th className="p-2 text-left">Returned</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.data.readingHistory.map((h) => (
                  <tr key={h.id} className="border-t">
                    <td className="p-2">
                      {h.bookTitle}
                      {h.wasOverdue ? (
                        <span className="ml-1 text-xs text-amber-600">late</span>
                      ) : null}
                    </td>
                    <td className="p-2">{new Date(h.issuedAt).toLocaleDateString()}</td>
                    <td className="p-2">
                      {h.returnedAt ? new Date(h.returnedAt).toLocaleDateString() : 'Active'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-medium">Library Entry</h2>
        <p className="text-xs text-muted-foreground">
          Show QR at the desk or tap check-in from your phone
        </p>
        {checkInMsg ? <p className="mt-2 text-sm text-muted-foreground">{checkInMsg}</p> : null}
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {qr.data?.qrImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr.data.qrImageUrl}
              alt="Library QR pass"
              className="h-36 w-36 rounded border bg-white p-2"
            />
          ) : null}
          <div className="space-y-2">
            <p className="text-sm font-medium">{qr.data?.fullName ?? '—'}</p>
            <p className="font-mono text-xs text-muted-foreground">{qr.data?.payload ?? ''}</p>
            <Button size="sm" disabled={checkInMut.isPending} onClick={() => checkInMut.mutate()}>
              {checkInMut.isPending ? 'Processing…' : 'Check in / out'}
            </Button>
          </div>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-medium">Digital Library</h2>
        <p className="text-xs text-muted-foreground">Browse and download published resources</p>
        {downloadError ? (
          <p className="mt-1 text-xs text-destructive">{apiErrorMessage(downloadError)}</p>
        ) : null}
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {digital.data?.items.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{a.title}</td>
                  <td className="p-2">{a.assetType.replace(/_/g, ' ')}</td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadDigitalMut.isPending}
                      onClick={() =>
                        downloadDigitalMut.mutate({
                          id: a.id,
                          fileName: a.fileName ?? `${a.title}.pdf`,
                        })
                      }
                    >
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
              {!digital.data?.items.length ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-muted-foreground">
                    No digital resources available
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {popular.data?.length ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Popular:{' '}
            {popular.data
              .slice(0, 3)
              .map((a) => a.title)
              .join(', ')}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="text-sm font-medium">Research Repository</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Title</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {research.data?.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-2">{item.title}</td>
                  <td className="p-2">{item.itemType.replace(/_/g, ' ')}</td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadResearchMut.isPending}
                      onClick={() =>
                        downloadResearchMut.mutate({ id: item.id, fileName: `${item.title}.pdf` })
                      }
                    >
                      Download
                    </Button>
                  </td>
                </tr>
              ))}
              {!research.data?.items.length ? (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-muted-foreground">
                    No published research yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium">Library Activity</h2>
        <p className="text-xs text-muted-foreground">
          Total completed visits: {visits.data?.totalVisits ?? 0}
        </p>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">In</th>
                <th className="p-2 text-left">Out</th>
                <th className="p-2 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              {visits.data?.items.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2">{new Date(v.entryAt).toLocaleDateString()}</td>
                  <td className="p-2">{new Date(v.entryAt).toLocaleTimeString()}</td>
                  <td className="p-2">
                    {v.exitAt ? new Date(v.exitAt).toLocaleTimeString() : '—'}
                  </td>
                  <td className="p-2">{v.durationMinutes ? `${v.durationMinutes} min` : '—'}</td>
                </tr>
              ))}
              {!visits.data?.items.length ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No visits yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium">My Loans</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {loans.data
            ?.filter((l) => l.status === 'ACTIVE')
            .map((l) => (
              <li key={l.id}>
                {l.copy.book.title} — due {new Date(l.dueAt).toLocaleDateString()}
              </li>
            ))}
          {!loans.data?.filter((l) => l.status === 'ACTIVE').length ? (
            <li className="text-muted-foreground">No active loans</li>
          ) : null}
        </ul>
      </div>

      {myFines.data?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <h2 className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Unpaid library fines
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {myFines.data.map((fine) => (
              <li key={fine.id}>
                {fine.loan?.copy.book.title ?? 'Book'} — ₹{Number(fine.amount).toFixed(2)}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Please settle at the library circulation desk.
          </p>
        </div>
      ) : null}

      <div>
        <h2 className="text-sm font-medium">Book reservations</h2>
        <p className="text-xs text-muted-foreground">
          Reserve when all copies are checked out — you will be notified when a copy is returned
        </p>
        {reserveMsg ? <p className="mt-1 text-xs text-muted-foreground">{reserveMsg}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Search title or accession…"
            value={reserveQuery}
            onChange={(e) => setReserveQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setReserveSearch(reserveQuery.trim());
            }}
          />
          <Button size="sm" onClick={() => setReserveSearch(reserveQuery.trim())}>
            Search
          </Button>
        </div>
        {searchResults.data?.books.length ? (
          <ul className="mt-2 space-y-1 rounded-lg border p-2 text-sm">
            {searchResults.data.books.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {b.title}
                  <span className="ml-2 text-xs text-muted-foreground">{b.accessionNo}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reserveMut.isPending}
                  onClick={() => reserveMut.mutate(b.id)}
                >
                  Reserve
                </Button>
              </li>
            ))}
          </ul>
        ) : reserveSearch.length >= 2 && !searchResults.isLoading ? (
          <p className="mt-2 text-xs text-muted-foreground">No books found</p>
        ) : null}
        <h3 className="mt-4 text-xs font-medium uppercase text-muted-foreground">My queue</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {reservations.data
            ?.filter((r) => r.status === 'ACTIVE')
            .map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
              >
                <span>
                  {r.book?.title ?? r.bookId}
                  {r.queuePosition != null ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Position #{r.queuePosition}
                    </span>
                  ) : null}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={cancelResMut.isPending}
                  onClick={() => cancelResMut.mutate(r.id)}
                >
                  Cancel
                </Button>
              </li>
            ))}
          {!reservations.data?.filter((r) => r.status === 'ACTIVE').length ? (
            <li className="text-muted-foreground">No active reservations</li>
          ) : null}
        </ul>
      </div>

      <LibraryKnowledgeAssistant studentView compact />
    </div>
  );
}
