'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { searchLibrary, searchLibrarySuggestions } from '@/services/library';

type SearchType = 'ALL' | 'BOOK' | 'DIGITAL' | 'RESEARCH';

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
    enabled: enabled && q.trim().length >= 2 && q !== term,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Unified Library Search</h1>
        <p className="text-sm text-muted-foreground">
          Ranked search across physical catalogue, digital library, and research repository
        </p>
      </div>

      <form
        className="flex max-w-2xl flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q.trim());
        }}
      >
        <Input
          className="min-w-[240px] flex-1"
          placeholder="Title, author, ISBN, accession…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          list="library-search-suggestions"
        />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as SearchType)}
        >
          <option value="ALL">All types</option>
          <option value="BOOK">Books only</option>
          <option value="DIGITAL">Digital only</option>
          <option value="RESEARCH">Research only</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Search
        </button>
      </form>

      {suggestions.data?.length ? (
        <datalist id="library-search-suggestions">
          {suggestions.data.map((s) => (
            <option key={`${s.type}-${s.id}`} value={s.label} />
          ))}
        </datalist>
      ) : null}

      {results.data ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h2 className="mb-2 text-sm font-medium">Books ({results.data.books.length})</h2>
            <ul className="space-y-1 text-sm">
              {results.data.books.map((b) => (
                <li key={b.id} className="rounded border p-2">
                  {b.title} · {b.accessionNo}
                </li>
              ))}
              {!results.data.books.length ? (
                <li className="text-muted-foreground">No books</li>
              ) : null}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium">Digital ({results.data.digital.length})</h2>
            <ul className="space-y-1 text-sm">
              {results.data.digital.map((d) => (
                <li key={d.id} className="rounded border p-2">
                  {d.title} · {d.assetType}
                </li>
              ))}
              {!results.data.digital.length ? (
                <li className="text-muted-foreground">No digital assets</li>
              ) : null}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-medium">Research ({results.data.research.length})</h2>
            <ul className="space-y-1 text-sm">
              {results.data.research.map((r) => (
                <li key={r.id} className="rounded border p-2">
                  {r.title} · {r.itemType}
                </li>
              ))}
              {!results.data.research.length ? (
                <li className="text-muted-foreground">No research items</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
