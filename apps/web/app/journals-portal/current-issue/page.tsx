'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { fetchJournalPortalInfo } from '@/services/journals-portal';

export default function CurrentIssuePage() {
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
  });
  const issue = infoQ.data?.currentIssue;

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-4xl px-4 py-12 lg:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#F4B400]">
          Publications
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#0A2342]">Current Issue</h1>
        {infoQ.isLoading ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">Loading…</p>
        ) : !issue ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">No current issue published yet.</p>
        ) : (
          <div className="mt-8">
            <h2 className="font-serif text-xl font-semibold text-[#0A2342]">
              {issue.title ||
                `Vol. ${issue.volume.volumeNumber} (${issue.volume.year}) — Issue ${issue.issueNumber}`}
            </h2>
            {issue.summary ? (
              <p className="mt-2 text-sm text-[#0A2342]/75">{issue.summary}</p>
            ) : null}
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
                    {article.pageRange ? ` · pp. ${article.pageRange}` : ''}
                  </p>
                  {article.abstract ? (
                    <p className="mt-3 line-clamp-3 text-sm text-[#0A2342]/75">
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
