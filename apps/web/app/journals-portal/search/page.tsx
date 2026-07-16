'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { fetchJournalArticles } from '@/services/journals-portal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function JournalSearchPage() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const articlesQ = useQuery({
    queryKey: ['journal-search', submitted],
    queryFn: () => fetchJournalArticles({ q: submitted || undefined }),
  });

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">Discover</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">Search articles</h1>
        <form
          className="mt-6 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q.trim());
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, author, keyword…"
            className="max-w-md"
          />
          <Button type="submit">Search</Button>
        </form>
        <ul className="mt-8 space-y-3">
          {(articlesQ.data ?? []).map((article) => (
            <li
              key={article.id}
              className="rounded-lg border border-[#0A2342]/10 bg-white p-4 shadow-sm"
            >
              <Link
                href={`/journals-portal/articles/${article.id}`}
                className="font-serif text-base font-semibold text-[#0A2342] hover:underline"
              >
                {article.title}
              </Link>
              <p className="mt-1 text-xs text-[#0A2342]/60">
                {(article.authors ?? []).map((a) => a.fullName).join(', ')}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </JournalPublicShell>
  );
}
