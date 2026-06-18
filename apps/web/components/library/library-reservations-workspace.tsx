'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked, Clock, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  cancelLibraryReservation,
  fetchLibraryReservationQueue,
  fetchLibraryReservations,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';

export function LibraryReservationsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();

  const queue = useQuery({
    queryKey: ['library', 'reservations', 'queue'],
    queryFn: fetchLibraryReservationQueue,
    enabled,
  });

  const flat = useQuery({
    queryKey: ['library', 'reservations'],
    queryFn: fetchLibraryReservations,
    enabled,
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelLibraryReservation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['library', 'reservations'] });
    },
  });

  const totalWaiting = flat.data?.length ?? 0;
  const booksWithQueue = queue.data?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Reservation Queue</h1>
        <p className="text-sm text-muted-foreground">
          FIFO holds when all copies are checked out — next in line is fulfilled on return
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Active holds</span>
          </div>
          <p className="mt-1 text-2xl font-semibold">{totalWaiting}</p>
        </div>
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookMarked className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Titles queued</span>
          </div>
          <p className="mt-1 text-2xl font-semibold">{booksWithQueue}</p>
        </div>
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Longest queue</span>
          </div>
          <p className="mt-1 text-2xl font-semibold">{queue.data?.[0]?.queue.length ?? 0}</p>
        </div>
      </div>

      {cancelMut.error ? (
        <p className="text-sm text-destructive">{apiErrorMessage(cancelMut.error)}</p>
      ) : null}

      <div className="space-y-4">
        {queue.isLoading ? <p className="text-sm text-muted-foreground">Loading queue…</p> : null}

        {queue.data?.map((group) => (
          <div key={group.bookId} className="rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <p className="font-medium">{group.bookTitle}</p>
                <p className="text-xs text-muted-foreground">{group.accessionNo}</p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {group.queue.length} waiting
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Student</th>
                    <th className="p-2 text-left">Enrollment</th>
                    <th className="p-2 text-left">Department</th>
                    <th className="p-2 text-left">Reserved</th>
                    <th className="p-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {group.queue.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2 font-mono">{r.queuePosition ?? '—'}</td>
                      <td className="p-2">{r.studentName ?? r.studentId}</td>
                      <td className="p-2">{r.enrollmentNumber ?? '—'}</td>
                      <td className="p-2">{r.department ?? '—'}</td>
                      <td className="p-2">{new Date(r.reservedAt).toLocaleString()}</td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cancelMut.isPending}
                          onClick={() => cancelMut.mutate(r.id)}
                        >
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {!queue.data?.length && !queue.isLoading ? (
          <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
            No active reservations — students can reserve titles when all copies are issued
          </p>
        ) : null}
      </div>
    </div>
  );
}
