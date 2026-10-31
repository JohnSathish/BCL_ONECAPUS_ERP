'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { fetchOpacBook, reserveOpacBook } from '@/services/opac';
import { useAuthStore } from '@/store/auth-store';

const toneClass = {
  available: 'bg-emerald-50 text-emerald-800',
  borrowed: 'bg-amber-50 text-amber-800',
  reference: 'bg-violet-50 text-violet-800',
  closed: 'bg-slate-100 text-slate-600',
};

export function OpacBook({ id }: { id: string }) {
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const book = useQuery({ queryKey: ['opac', 'book', id], queryFn: () => fetchOpacBook(id) });
  const reserve = useMutation({
    mutationFn: () => reserveOpacBook(id),
    onSuccess: async () => {
      setMessage('Reservation saved. Your queue position is on My Library.');
      await queryClient.invalidateQueries({ queryKey: ['opac', 'account'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      setMessage(error.response?.data?.message || 'The reservation could not be saved.');
    },
  });

  if (book.isLoading) return <p className="text-sm text-slate-500">Loading the title…</p>;
  if (book.isError || !book.data)
    return <p className="text-sm text-red-700">This title was not found.</p>;
  const data = book.data;
  const canReserve = data.available === 0 && data.total > data.reference;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        {data.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.coverImageUrl} alt="" className="h-64 w-full rounded-2xl object-cover" />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-2xl bg-sky-50 text-4xl font-bold text-sky-800">
            {data.title.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{data.title}</h1>
          <p className="mt-1 text-slate-600">{data.author || 'Author not recorded'}</p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <Fact label="ISBN" value={data.isbn} />
            <Fact label="Publisher" value={data.publisher} />
            <Fact label="Year" value={data.publicationYear} />
            <Fact label="Edition" value={data.edition} />
            <Fact label="Subject" value={data.subject} />
            <Fact label="Category" value={data.category} />
            <Fact label="Department" value={data.department} />
            <Fact label="Class number" value={data.classificationNumber} />
            <Fact label="Language" value={data.language} />
          </dl>
          <p className="mt-4 text-sm text-slate-700">
            {data.total} copies · {data.available} available for issue · {data.borrowed} borrowed ·{' '}
            {data.reference} not for issue
          </p>
          {canReserve ? (
            session ? (
              <button
                type="button"
                className="mt-4 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={reserve.isPending}
                onClick={() => reserve.mutate()}
              >
                Reserve book
              </button>
            ) : (
              <Link
                href="/opac/login"
                className="mt-4 inline-block text-sm font-semibold text-sky-800"
              >
                Log in to reserve this title
              </Link>
            )
          ) : null}
          {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Accession</th>
              <th className="px-3 py-2">Call number</th>
              <th className="px-3 py-2">Shelf</th>
              <th className="px-3 py-2">Availability</th>
            </tr>
          </thead>
          <tbody>
            {data.copies.map((copy) => (
              <tr key={copy.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{copy.accessionNumber}</td>
                <td className="px-3 py-2">{copy.callNumber || '—'}</td>
                <td className="px-3 py-2">{copy.shelf || '—'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${toneClass[copy.tone]}`}
                  >
                    {copy.availability}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.copies.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No physical copies are recorded for this title.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}
