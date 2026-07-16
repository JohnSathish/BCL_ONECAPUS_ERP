'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import { fetchJournalIssue } from '@/services/journals-portal';

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const issueQ = useQuery({
    queryKey: ['journal-issue', params.id],
    queryFn: () => fetchJournalIssue(params.id),
    enabled: Boolean(params.id),
  });
  const issue = issueQ.data;
  const title = issue
    ? issue.title ||
      `Vol. ${issue.volume.volumeNumber} (${issue.volume.year}) — Issue ${issue.issueNumber}`
    : 'Issue';

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="Issue"
        title={issueQ.isLoading ? 'Loading…' : title}
        subtitle={issue?.summary || undefined}
      />
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        {issueQ.isLoading ? (
          <p className="text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : !issue ? (
          <p className="text-sm text-red-700">Issue not found.</p>
        ) : (
          <ul className="space-y-4">
            {(issue.articles ?? []).map((article) => (
              <li
                key={article.id}
                className="rounded-lg border border-[var(--jp-border)] bg-white p-5 shadow-sm"
              >
                <Link
                  href={`/journals-portal/articles/${article.id}`}
                  className="jp-serif text-lg font-semibold text-[var(--jp-ink)] hover:underline"
                >
                  {article.title}
                </Link>
                <p className="mt-1 text-xs text-[var(--jp-muted)]">
                  {(article.authors ?? []).map((a) => a.fullName).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </JournalPublicShell>
  );
}
