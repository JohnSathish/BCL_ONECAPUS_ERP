'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
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
      <JournalPageHero
        eyebrow="Discover"
        title="Search articles"
        subtitle="Find Transient articles by title, author, or keyword."
      />
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <form
          className="flex flex-wrap gap-2"
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
              className="rounded-lg border border-[var(--jp-border)] bg-[var(--jp-card)] p-4 shadow-sm"
            >
              <Link
                href={`/journals-portal/articles/${article.id}`}
                className="jp-serif text-base font-semibold text-[var(--jp-ink)] hover:underline"
              >
                {article.title}
              </Link>
              <p className="mt-1 text-xs text-[var(--jp-muted)]">
                {(article.authors ?? []).map((a) => a.fullName).join(', ')}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </JournalPublicShell>
  );
}
