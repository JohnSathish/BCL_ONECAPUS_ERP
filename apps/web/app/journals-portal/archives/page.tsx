'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { fetchJournalIssues } from '@/services/journals-portal';

export default function ArchivesPage() {
  const issuesQ = useQuery({
    queryKey: ['journal-issues'],
    queryFn: fetchJournalIssues,
  });

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">
          Publications
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">Archives</h1>
        {issuesQ.isLoading ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">Loading…</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {(issuesQ.data ?? []).map((issue) => (
              <li
                key={issue.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-[#0A2342]/10 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-serif text-base font-semibold text-[#0A2342]">
                    {issue.title ||
                      `Vol. ${issue.volume.volumeNumber} (${issue.volume.year}) — Issue ${issue.issueNumber}`}
                  </p>
                  <p className="text-xs text-[#0A2342]/55">
                    {issue._count?.articles ?? 0} article(s)
                    {issue.isCurrent ? ' · Current' : ''}
                  </p>
                </div>
                <Link
                  href={`/journals-portal/issues/${issue.id}`}
                  className="text-sm font-medium text-[#0A2342] hover:underline"
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
