'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  downloadDigitalAsset,
  downloadResearchItem,
  fetchDigitalAssets,
  fetchMyLibraryLoans,
  fetchMyLibraryFines,
  fetchMyLibraryQr,
  fetchMyLibraryReservations,
  fetchMyLibraryVisits,
  fetchPopularDigitalAssets,
  fetchResearchItems,
  selfCheckInLibrary,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

export function StudentLibraryPanel() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [checkInMsg, setCheckInMsg] = useState('');

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
    },
    onError: (e) => setCheckInMsg(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
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
        <h2 className="text-sm font-medium">Reservations</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {reservations.data
            ?.filter((r) => r.status === 'ACTIVE')
            .map((r) => (
              <li key={r.id}>{r.book?.title ?? r.bookId}</li>
            ))}
          {!reservations.data?.filter((r) => r.status === 'ACTIVE').length ? (
            <li className="text-muted-foreground">No active reservations</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
