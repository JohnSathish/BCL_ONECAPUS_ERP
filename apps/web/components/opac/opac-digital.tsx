'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { fetchOpacDigital } from '@/services/opac';

const kindTitle: Record<string, string> = {
  ebook: 'E-books',
  journal: 'Journals',
  research: 'Research materials',
};

function matchesKind(kind: string, assetType: string) {
  const type = assetType.toUpperCase();
  if (kind === 'ebook') return type === 'EBOOK' || type === 'E-BOOK';
  if (kind === 'journal') return type === 'JOURNAL' || type === 'MAGAZINE' || type === 'PERIODICAL';
  if (kind === 'research') {
    return [
      'RESEARCH_PAPER',
      'THESIS',
      'DISSERTATION',
      'PUBLICATION',
      'ARTICLE',
      'PROJECT',
      'PATENT',
    ].includes(type);
  }
  return true;
}

export function OpacDigital() {
  const params = useSearchParams();
  const kind = params.get('kind') ?? '';
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const list = useQuery({
    queryKey: ['opac', 'digital', term],
    queryFn: () => fetchOpacDigital(term || undefined),
  });

  function search(event: FormEvent) {
    event.preventDefault();
    setTerm(q.trim());
  }

  const items = (list.data ?? []).filter((item) => matchesKind(kind, item.assetType));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{kindTitle[kind] ?? 'Digital library'}</h1>
      <p className="text-sm text-slate-600">
        Only resources the librarian has published for the public catalogue are listed here.
        Student-only files stay behind the college login.
      </p>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search digital resources"
          className="h-11 flex-1 rounded-xl border border-slate-200 px-3"
        />
        <button type="submit" className="h-11 rounded-xl bg-sky-700 px-4 font-semibold text-white">
          Search
        </button>
      </form>
      {list.isLoading ? <p className="text-sm text-slate-500">Loading resources…</p> : null}
      {!list.isLoading && items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          {kind
            ? 'No public resources of this kind are published.'
            : 'No public digital resources are published.'}
        </p>
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-semibold">{item.title}</p>
            <p className="text-slate-500">
              {item.author || 'Author not recorded'} · {item.assetType}
            </p>
            {item.externalUrl ? (
              <a
                href={item.externalUrl}
                className="mt-2 inline-block font-semibold text-sky-800"
                target="_blank"
                rel="noreferrer"
              >
                Open resource
              </a>
            ) : (
              <p className="mt-2 text-slate-500">
                This file is stored in the library and is not a public link.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
