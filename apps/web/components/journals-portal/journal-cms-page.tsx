'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJournalPage } from '@/services/journals-portal';
import { JournalPublicShell } from './journal-public-shell';

type Props = {
  pageKey: string;
  fallbackTitle: string;
};

export function JournalCmsPage({ pageKey, fallbackTitle }: Props) {
  const pageQ = useQuery({
    queryKey: ['journal-page', pageKey],
    queryFn: () => fetchJournalPage(pageKey),
  });

  return (
    <JournalPublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
        <p className="jp-eyebrow">Journal</p>
        <h1 className="jp-serif mt-2 text-3xl font-semibold text-[#0A2342]">
          {pageQ.data?.title || fallbackTitle}
        </h1>
        {pageQ.isLoading ? (
          <p className="mt-6 text-sm text-[#0A2342]/60">Loading…</p>
        ) : pageQ.isError ? (
          <p className="mt-6 text-sm text-red-700">Page content is not available yet.</p>
        ) : pageQ.data?.bodyHtml ? (
          <div
            className="jp-cms-prose mt-8 max-w-none"
            dangerouslySetInnerHTML={{ __html: pageQ.data.bodyHtml }}
          />
        ) : (
          <p className="mt-6 text-sm text-[#0A2342]/60">Content coming soon.</p>
        )}
      </div>
    </JournalPublicShell>
  );
}
