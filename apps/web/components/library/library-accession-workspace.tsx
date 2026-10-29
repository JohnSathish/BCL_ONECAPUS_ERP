'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchLibraryBooks, updateAccessionWorkflow } from '@/services/library';
import type { LibraryBook } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { LibraryAccessionEntryForm } from './library-accession-entry-form';
import { writeLibraryBarcodeLabels } from './print-library-barcode-labels';

const STATUS_STEPS = [
  { value: 'PENDING', label: 'Received' },
  { value: 'CATALOGUED', label: 'Catalogued' },
  { value: 'ON_SHELF', label: 'On shelf' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
] as const;

export function LibraryAccessionWorkspace() {
  const qc = useQueryClient();
  const enabled = useAuthQueryEnabled();
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'queue' | 'new'>('new');

  const pending = useQuery({
    queryKey: ['library', 'accession', 'pending'],
    queryFn: () => fetchLibraryBooks({ accessionStatus: 'PENDING', limit: 50 }),
    enabled: enabled && tab === 'queue',
  });

  const catalogued = useQuery({
    queryKey: ['library', 'accession', 'catalogued'],
    queryFn: () => fetchLibraryBooks({ accessionStatus: 'CATALOGUED', limit: 50 }),
    enabled: enabled && tab === 'queue',
  });

  const advanceStatus = async (bookId: string, status: string, extra?: Record<string, string>) => {
    try {
      await updateAccessionWorkflow(bookId, { accessionStatus: status, ...extra });
      setMessage(`Moved to ${status}`);
      void qc.invalidateQueries({ queryKey: ['library', 'accession'] });
    } catch (e) {
      setMessage(apiErrorMessage(e));
    }
  };

  function printBarcodes(book: LibraryBook) {
    const labels = (book.copies ?? []).map((copy) => ({
      title: book.title,
      author: [book.author, book.additionalAuthors].filter(Boolean).join(', '),
      accessionNo: copy.accessionNumber || copy.barcode,
      barcode: copy.barcode,
    }));
    if (!labels.length) {
      setMessage('This entry has no barcode labels yet.');
      return;
    }
    const popup = window.open('', '_blank');
    if (popup) writeLibraryBarcodeLabels(popup, labels);
  }

  function BookQueue({ title, books }: { title: string; books: LibraryBook[] }) {
    return (
      <div className="rounded-xl border">
        <div className="border-b px-4 py-2 text-sm font-medium">{title}</div>
        {books.length ? (
          <ul className="divide-y">
            {books.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{b.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.accessionNo} · {b.author ?? '—'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => printBarcodes(b)}>
                    <Printer className="mr-1 h-3 w-3" />
                    Print barcodes
                  </Button>
                  {title.includes('Pending') ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void advanceStatus(b.id, 'CATALOGUED')}
                    >
                      Mark catalogued
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        void advanceStatus(b.id, 'ON_SHELF', { location: 'Main stack' })
                      }
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Shelve
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">Queue empty</p>
        )}
      </div>
    );
  }

  if (tab === 'new') {
    return <LibraryAccessionEntryForm onOpenQueue={() => setTab('queue')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Accession Workflow</h1>
          <p className="text-sm text-muted-foreground">
            Receive → catalogue → shelve with auto accession numbers
          </p>
        </div>
        <Button onClick={() => setTab('new')}>New entry</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_STEPS.map((s) => (
          <span key={s.value} className="rounded-full border px-3 py-1 text-xs">
            {s.label}
          </span>
        ))}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <BookQueue title="Pending receipt" books={pending.data?.items ?? []} />
        <BookQueue title="Catalogued — awaiting shelving" books={catalogued.data?.items ?? []} />
      </div>
    </div>
  );
}
