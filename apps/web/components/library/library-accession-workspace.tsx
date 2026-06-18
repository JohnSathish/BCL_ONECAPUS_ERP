'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookPlus, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  createAccessionBook,
  fetchLibraryBooks,
  fetchLibraryCategories,
  fetchNextAccessionNo,
  updateAccessionWorkflow,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';

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
  const [tab, setTab] = useState<'queue' | 'new'>('queue');
  const [form, setForm] = useState({
    title: '',
    author: '',
    publisher: '',
    isbn: '',
    categoryId: '',
    totalCopies: 1,
    price: '',
  });

  const nextAcc = useQuery({
    queryKey: ['library', 'accession', 'next'],
    queryFn: fetchNextAccessionNo,
    enabled: enabled && tab === 'new',
  });

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

  const categories = useQuery({
    queryKey: ['library', 'categories'],
    queryFn: fetchLibraryCategories,
    enabled,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createAccessionBook({
        ...form,
        accessionStatus: 'PENDING',
        categoryId: form.categoryId || undefined,
        price: form.price ? Number(form.price) : undefined,
      }),
    onSuccess: () => {
      setMessage('Accession entry created');
      setForm({
        title: '',
        author: '',
        publisher: '',
        isbn: '',
        categoryId: '',
        totalCopies: 1,
        price: '',
      });
      void qc.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e)),
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

  function BookQueue({
    title,
    books,
  }: {
    title: string;
    books: { id: string; accessionNo: string; title: string; author?: string | null }[];
  }) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Accession Workflow</h1>
          <p className="text-sm text-muted-foreground">
            Receive → catalogue → shelve with auto accession numbers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === 'queue' ? 'default' : 'outline'} onClick={() => setTab('queue')}>
            Workflow queue
          </Button>
          <Button variant={tab === 'new' ? 'default' : 'outline'} onClick={() => setTab('new')}>
            New entry
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_STEPS.map((s) => (
          <span key={s.value} className="rounded-full border px-3 py-1 text-xs">
            {s.label}
          </span>
        ))}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {tab === 'queue' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <BookQueue title="Pending receipt" books={pending.data?.items ?? []} />
          <BookQueue title="Catalogued — awaiting shelving" books={catalogued.data?.items ?? []} />
        </div>
      ) : (
        <div className="max-w-2xl space-y-4 rounded-xl border bg-card p-6">
          <div className="flex items-center gap-2 text-sm">
            <BookPlus className="h-4 w-4" />
            Next accession:{' '}
            <span className="font-mono font-semibold">{nextAcc.data?.accessionNo ?? '…'}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              placeholder="Author"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
            />
            <Input
              placeholder="Publisher"
              value={form.publisher}
              onChange={(e) => setForm({ ...form, publisher: e.target.value })}
            />
            <Input
              placeholder="ISBN"
              value={form.isbn}
              onChange={(e) => setForm({ ...form, isbn: e.target.value })}
            />
            <select
              className="h-10 rounded-md border bg-card px-3 text-sm"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">Category</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              placeholder="Copies"
              value={form.totalCopies}
              onChange={(e) => setForm({ ...form, totalCopies: Number(e.target.value) || 1 })}
            />
            <Input
              placeholder="Price (₹)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <Button
            disabled={!form.title.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            Create accession entry
          </Button>
        </div>
      )}
    </div>
  );
}
