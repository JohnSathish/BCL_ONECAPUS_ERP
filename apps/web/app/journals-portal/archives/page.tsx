'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { JournalPageHero } from '@/components/journals-portal/journal-page-hero';
import { fetchJournalIssues } from '@/services/journals-portal';

export default function ArchivesPage() {
  const issuesQ = useQuery({
    queryKey: ['journal-issues'],
    queryFn: fetchJournalIssues,
  });

  return (
    <JournalPublicShell>
      <JournalPageHero
        eyebrow="Publications"
        title="Archives"
        subtitle="Browse past volumes and issues of Transient."
      />
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        {issuesQ.isLoading ? (
          <p className="text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : (
          <ul className="space-y-3">
            {(issuesQ.data ?? []).map((issue) => (
              <li
                key={issue.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-[var(--jp-border)] bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="jp-serif text-base font-semibold text-[var(--jp-ink)]">
                    {issue.title ||
                      `Vol. ${issue.volume.volumeNumber} (${issue.volume.year}) — Issue ${issue.issueNumber}`}
                  </p>
                  <p className="text-xs text-[var(--jp-muted)]">
                    {issue._count?.articles ?? 0} article(s)
                    {issue.isCurrent ? ' · Current' : ''}
                  </p>
                </div>
                <Link
                  href={`/journals-portal/issues/${issue.id}`}
                  className="text-sm font-medium text-[var(--jp-ink)] hover:underline"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </JournalPublicShell>
  );
}
