'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Download, Send, ShieldCheck } from 'lucide-react';
import { fetchJournalPage } from '@/services/journals-portal';
import { JournalPublicShell } from './journal-public-shell';
import { JournalPageHero } from './journal-page-hero';

type Props = {
  pageKey: string;
  fallbackTitle: string;
  eyebrow?: string;
};

const CMS_META: Record<string, { eyebrow: string }> = {
  about: { eyebrow: 'Journal' },
  'aim-scope': { eyebrow: 'Journal' },
  'peer-review': { eyebrow: 'For authors' },
  ethics: { eyebrow: 'Policies' },
  indexing: { eyebrow: 'Discovery' },
  contact: { eyebrow: 'Journal' },
};

export function JournalCmsPage({ pageKey, fallbackTitle, eyebrow }: Props) {
  const pageQ = useQuery({
    queryKey: ['journal-page', pageKey],
    queryFn: () => fetchJournalPage(pageKey),
  });
  const title = pageQ.data?.title || fallbackTitle;
  const band = eyebrow || CMS_META[pageKey]?.eyebrow || 'Journal';

  const actions =
    pageKey === 'peer-review' ? (
      <>
        <Link
          href="/journals-portal/author/submissions/new"
          className="jp-btn jp-btn-gold inline-flex items-center gap-2 rounded-sm px-5 py-3"
        >
          <Send className="h-4 w-4" />
          Start a new submission
        </Link>
        <Link
          href="/journals-portal/author-guidelines"
          className="jp-btn inline-flex items-center gap-2 rounded-sm border border-white/35 bg-transparent px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/10"
        >
          <ShieldCheck className="h-4 w-4" />
          Author guidelines
        </Link>
        <Link
          href="/journals-portal/downloads"
          className="jp-btn inline-flex items-center gap-2 rounded-sm border border-white/35 bg-transparent px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
          Downloads / templates
        </Link>
      </>
    ) : undefined;

  return (
    <JournalPublicShell>
      <JournalPageHero eyebrow={band} title={title} actions={actions} />
      <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
        {pageQ.isLoading ? (
          <p className="text-sm text-[var(--jp-muted)]">Loading…</p>
        ) : pageQ.isError ? (
          <p className="text-sm text-red-700">Page content is not available yet.</p>
        ) : pageQ.data?.bodyHtml ? (
          <div
            className="jp-cms-prose max-w-none"
            dangerouslySetInnerHTML={{ __html: pageQ.data.bodyHtml }}
          />
        ) : (
          <p className="text-sm text-[var(--jp-muted)]">Content coming soon.</p>
        )}
      </div>
    </JournalPublicShell>
  );
}
