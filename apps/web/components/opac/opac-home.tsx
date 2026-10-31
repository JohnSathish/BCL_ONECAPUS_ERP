'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { BookCard } from '@/components/opac/book-card';
import { fetchOpacHome } from '@/services/opac';

const fields = [
  ['all', 'All fields'],
  ['title', 'Book title'],
  ['author', 'Author'],
  ['isbn', 'ISBN'],
  ['accession', 'Accession number'],
  ['subject', 'Subject'],
  ['department', 'Department'],
  ['publisher', 'Publisher'],
];

export function OpacHome() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [field, setField] = useState('all');
  const home = useQuery({ queryKey: ['opac', 'home'], queryFn: fetchOpacHome });

  function search(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (field !== 'all') params.set('field', field);
    router.push(`/opac/search?${params.toString()}`);
  }

  if (home.isLoading) {
    return <p className="text-sm text-slate-500">Loading the catalogue…</p>;
  }
  if (home.isError || !home.data) {
    return <p className="text-sm text-red-700">The catalogue could not be loaded.</p>;
  }
  const data = home.data;
  const cards = [
    ['Copies', data.cards.copies],
    ['Titles', data.cards.titles],
    ['Authors', data.cards.authors],
    ['Categories', data.cards.categories],
    ['Departments', data.cards.departments],
  ] as const;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-gradient-to-br from-sky-800 to-slate-900 px-6 py-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">Welcome to</p>
        <h1 className="mt-2 text-3xl font-bold">{data.collegeName}</h1>
        <p className="mt-1 text-sky-100">Online Library Public Access Catalogue</p>
        <form onSubmit={search} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search by title, author, ISBN, accession number…"
            className="h-12 flex-1 rounded-xl border-0 px-4 text-slate-900"
          />
          <select
            value={field}
            onChange={(event) => setField(event.target.value)}
            className="h-12 rounded-xl px-3 text-slate-900"
          >
            {fields.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="h-12 rounded-xl bg-sky-500 px-5 font-semibold">
            Search
          </button>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-2xl font-bold text-slate-950">{value.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/opac/departments" className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-semibold">Browse by department</p>
          <p className="text-sm text-slate-500">Titles linked to a college department</p>
        </Link>
        <Link
          href="/opac/search?field=subject"
          className="rounded-2xl border border-slate-200 bg-white p-4"
        >
          <p className="font-semibold">Browse by subject</p>
          <p className="text-sm text-slate-500">Search the subject recorded on each title</p>
        </Link>
        <Link
          href="/opac/search?availability=available"
          className="rounded-2xl border border-slate-200 bg-white p-4"
        >
          <p className="font-semibold">Available now</p>
          <p className="text-sm text-slate-500">Titles with a copy that can be issued</p>
        </Link>
      </section>

      <BookRow title="Recently added" books={data.recent} />
      <BookRow title="Most borrowed" books={data.mostBorrowed} />

      {data.settings.announcements.length || data.settings.hours.length ? (
        <section className="grid gap-4 md:grid-cols-2">
          {data.settings.hours.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">Library hours</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {data.settings.hours.map((row) => (
                  <li key={row.label} className="flex justify-between gap-3">
                    <span>{row.label}</span>
                    <span className="text-slate-600">{row.hours}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.settings.announcements.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">Library notices</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {data.settings.announcements.map((row) => (
                  <li key={row.text}>{row.text}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function BookRow({ title, books }: { title: string; books: OpacHomeBooks }) {
  if (!books.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}

type OpacHomeBooks = import('@/services/opac').OpacBookCard[];
