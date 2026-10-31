'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { BookCard } from '@/components/opac/book-card';
import { searchOpac } from '@/services/opac';

export function OpacSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get('q') ?? '';
  const field = params.get('field') ?? 'all';
  const sort = params.get('sort') ?? 'title';
  const availability = params.get('availability') ?? '';
  const departmentId = params.get('departmentId') ?? '';
  const year = params.get('year') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const result = useQuery({
    queryKey: ['opac', 'search', q, field, sort, availability, departmentId, year, page],
    queryFn: () =>
      searchOpac({
        q: q || undefined,
        field,
        sort,
        availability: availability || undefined,
        departmentId: departmentId || undefined,
        year: year || undefined,
        page,
        limit: 12,
      }),
  });

  function push(next: Record<string, string>) {
    const url = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) url.set(key, value);
      else url.delete(key);
    });
    if (!('page' in next)) url.delete('page');
    router.push(`/opac/search?${url.toString()}`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    push({ q: draft.trim() });
  }

  const total = result.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search the catalogue"
          className="h-11 flex-1 rounded-xl border border-slate-200 px-3"
        />
        <button type="submit" className="h-11 rounded-xl bg-sky-700 px-4 font-semibold text-white">
          Search
        </button>
      </form>
      <div className="flex flex-wrap gap-2 text-sm">
        <select
          value={availability}
          onChange={(event) => push({ availability: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1"
        >
          <option value="">Any availability</option>
          <option value="available">Available now</option>
          <option value="borrowed">Currently borrowed</option>
          <option value="reference">Reference only</option>
        </select>
        <select
          value={sort}
          onChange={(event) => push({ sort: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1"
        >
          <option value="title">Title A–Z</option>
          <option value="title_desc">Title Z–A</option>
          <option value="recent">Recently added</option>
          <option value="borrowed">Most borrowed</option>
          <option value="author">Author name</option>
        </select>
        <input
          defaultValue={year}
          placeholder="Year"
          className="w-24 rounded-lg border border-slate-200 px-2 py-1"
          onBlur={(event) => push({ year: event.target.value.trim() })}
        />
      </div>
      {result.isLoading ? <p className="text-sm text-slate-500">Searching…</p> : null}
      {result.isError ? (
        <p className="text-sm text-red-700">Search could not be completed.</p>
      ) : null}
      {result.data ? (
        <>
          <p className="text-sm text-slate-500">{total.toLocaleString('en-IN')} titles</p>
          {result.data.items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
              No titles match this search.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {result.data.items.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
              onClick={() => push({ page: String(page - 1) })}
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
              onClick={() => push({ page: String(page + 1) })}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
