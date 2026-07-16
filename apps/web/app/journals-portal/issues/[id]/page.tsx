'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { fetchJournalIssue } from '@/services/journals-portal';

export default function IssueDetailPage() {
  const params = useParams<{ id: string }>();
  const issueQ = useQuery({
    queryKey: ['journal-issue', params.id],
    queryFn: () => fetchJournalIssue(params.id),
    enabled: Boolean(params.id),
  });
  const issue = issueQ.data;

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        {issueQ.isLoading ? (
          <p className="text-sm text-[#0A2342]/60">Loading…</p>
        ) : !issue ? (
          <p className="text-sm text-red-700">Issue not found.</p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">Issue</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">
              {issue.title ||
                `Vol. ${issue.volume.volumeNumber} (${issue.volume.year}) — Issue ${issue.issueNumber}`}
            </h1>
            <ul className="mt-8 space-y-4">
              {(issue.articles ?? []).map((article) => (
                <li
                  key={article.id}
                  className="rounded-lg border border-[#0A2342]/10 bg-white p-5 shadow-sm"
                >
                  <Link
                    href={`/journals-portal/articles/${article.id}`}
                    className="font-serif text-lg font-semibold text-[#0A2342] hover:underline"
                  >
                    {article.title}
                  </Link>
                  <p className="mt-1 text-xs text-[#0A2342]/60">
                    {(article.authors ?? []).map((a) => a.fullName).join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </JournalPublicShell>
  );
}
