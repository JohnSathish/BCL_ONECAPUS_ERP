'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Monitor, Search } from 'lucide-react';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { searchLibrary, searchLibrarySuggestions } from '@/services/library';
import { cn } from '@/utils/cn';

type SearchType = 'ALL' | 'BOOK' | 'DIGITAL' | 'RESEARCH';

const TYPES: { id: SearchType; label: string }[] = [
  { id: 'ALL', label: 'All types' },
  { id: 'BOOK', label: 'Books' },
  { id: 'DIGITAL', label: 'Digital' },
  { id: 'RESEARCH', label: 'Research' },
];

export function LibrarySearchWorkspace() {
  const enabled = useAuthQueryEnabled();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [type, setType] = useState<SearchType>('ALL');

  const results = useQuery({
    queryKey: ['library', 'search', term, type],
    queryFn: () => searchLibrary(term, 24, type),
    enabled: enabled && term.length >= 2,
  });

  const suggestions = useQuery({
    queryKey: ['library', 'search-suggestions', q],
    queryFn: () => searchLibrarySuggestions(q),
    enabled: enabled && q.trim().length >= 2 && q.trim() !== term,
  });

  function runSearch(value = q) {
    const next = value.trim();
    if (next.length < 2) return;
    setQ(next);
    setTerm(next);
  }

  const showBooks = type === 'ALL' || type === 'BOOK';
  const showDigital = type === 'ALL' || type === 'DIGITAL';
  const showResearch = type === 'ALL' || type === 'RESEARCH';
  const columns = [showBooks, showDigital, showResearch].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#155EEF] text-white shadow-sm">
          <Search className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Library Search</h1>
          <p className="text-sm text-slate-500">
            Ranked search across the physical catalogue, digital library, and research repository.
          </p>
        </div>
      </div>

      <form
        className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search the library</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Title, author, ISBN, accession number..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-[#F4F7FC] pl-9 pr-3 text-sm outline-none ring-[#155EEF] placeholder:text-slate-400 focus:ring-2"
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-xl bg-[#155EEF] px-5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium',
                type === item.id
                  ? 'bg-[#155EEF] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
              onClick={() => setType(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {suggestions.data?.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.data.map((item) => (
              <li key={`${item.type}-${item.id}`}>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-[#F8FAFC] px-3 py-1 text-xs text-slate-700 hover:border-blue-200"
                  onClick={() => runSearch(item.label)}
                >
                  {item.label}
                  {item.meta ? <span className="text-slate-400"> · {item.meta}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      {results.isError ? (
        <QueryErrorPanel
          title="Unable to search the library"
          error={results.error}
          onRetry={() => void results.refetch()}
          isRetrying={results.isFetching}
        />
      ) : null}

      {!term ? (
        <div className="rounded-[18px] bg-white px-4 py-14 text-center shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-800">Search the whole library</p>
          <p className="mt-1 text-sm text-slate-500">
            Enter at least two characters. Results stay grouped as books, digital files, and
            research.
          </p>
        </div>
      ) : results.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-[18px] bg-white" />
          ))}
        </div>
      ) : results.data ? (
        <div
          className={cn(
            'grid gap-4',
            columns === 3 ? 'xl:grid-cols-3' : columns === 2 ? 'md:grid-cols-2' : '',
          )}
        >
          {showBooks ? (
            <ResultColumn
              title="Books"
              count={results.data.books.length}
              icon={BookOpen}
              empty="No matching books"
            >
              {results.data.books.map((book) => (
                <Link
                  key={book.id}
                  href={`/admin/library/catalogue?search=${encodeURIComponent(book.accessionNo || book.title)}`}
                  className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <p className="font-medium text-slate-900">{book.title}</p>
                  <p className="text-xs text-slate-500">
                    {book.author || 'Author not recorded'} · {book.accessionNo}
                  </p>
                </Link>
              ))}
            </ResultColumn>
          ) : null}
          {showDigital ? (
            <ResultColumn
              title="Digital"
              count={results.data.digital.length}
              icon={Monitor}
              empty="No digital assets"
            >
              {results.data.digital.map((item) => (
                <Link
                  key={item.id}
                  href="/admin/library/digital"
                  className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {item.author || 'Author not recorded'} · {item.assetType}
                  </p>
                </Link>
              ))}
            </ResultColumn>
          ) : null}
          {showResearch ? (
            <ResultColumn
              title="Research"
              count={results.data.research.length}
              icon={GraduationCap}
              empty="No research items"
            >
              {results.data.research.map((item) => (
                <Link
                  key={item.id}
                  href="/admin/library/research"
                  className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.itemType}</p>
                </Link>
              ))}
            </ResultColumn>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultColumn({
  title,
  count,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  count: number;
  icon: typeof BookOpen;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[18px] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-[#155EEF]" />
        {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {count}
        </span>
      </h2>
      {count ? (
        <div className="space-y-2 text-sm">{children}</div>
      ) : (
        <p className="text-sm text-slate-500">{empty}</p>
      )}
    </section>
  );
}
