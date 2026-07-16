'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import { fetchJournalPortalInfo } from '@/services/journals-portal';

export default function CurrentIssuePage() {
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
  });
  const issue = infoQ.data?.currentIssue;

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="Publications"
        title="Current Issue"
        subtitle="The latest peer-reviewed contributions published in Transient."
      />
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        {infoQ.isLoading ? (
          <p className="text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : !issue ? (
          <p className="text-sm text-[var(--jp-muted)]">No current issue published yet.</p>
        ) : (
          <div>
            <h2 className="jp-serif text-xl font-semibold text-[var(--jp-ink)]">
              {issue.title ||
                `Vol. ${issue.volume.volumeNumber} (${issue.volume.year}) — Issue ${issue.issueNumber}`}
            </h2>
            {issue.summary ? (
              <p className="mt-2 text-sm text-[var(--jp-ink)]/75">{issue.summary}</p>
            ) : null}
            <ul className="mt-8 space-y-4">
              {(issue.articles ?? []).map((article) => (
                <li
                  key={article.id}
                  className="rounded-lg border border-[var(--jp-border)] bg-[var(--jp-card)] p-5 shadow-sm"
                >
                  <Link
                    href={`/journals-portal/articles/${article.id}`}
                    className="jp-serif text-lg font-semibold text-[var(--jp-ink)] hover:underline"
                  >
                    {article.title}
                  </Link>
                  <p className="mt-1 text-xs text-[var(--jp-muted)]">
                    {(article.authors ?? []).map((a) => a.fullName).join(', ')}
                    {article.pageRange ? ` · pp. ${article.pageRange}` : ''}
                  </p>
                  {article.abstract ? (
                    <p className="mt-3 line-clamp-3 text-sm text-[var(--jp-ink)]/75">
                      {article.abstract}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </JournalPublicShell>
  );
}
