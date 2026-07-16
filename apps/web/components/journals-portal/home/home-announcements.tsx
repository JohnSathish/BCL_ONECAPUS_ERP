'use client';

import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import type { JournalPortalInfo } from '@/services/journals-portal';
import { FadeUp } from './home-motion';

type Props = {
  announcements: JournalPortalInfo['announcements'];
  featuredImageUrl?: string | null;
  featuredHeadline?: string | null;
  featuredSubtext?: string | null;
};

export function HomeAnnouncements({
  announcements,
  featuredImageUrl,
  featuredHeadline,
  featuredSubtext,
}: Props) {
  const item = announcements[0] ?? null;
  const image = featuredImageUrl || '/branding/transient-science-hero.png';
  const headline = featuredHeadline || 'Scholarship in print & open access';
  const subtext = featuredSubtext || 'Peer-reviewed research from Don Bosco College, Tura';

  return (
    <section className="bg-[var(--jp-paper)] px-4 py-16 lg:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <FadeUp className="relative flex items-center justify-center">
          <h2 className="jp-serif text-center text-3xl font-semibold tracking-tight">
            Latest Announcements
          </h2>
          <Link
            href="/journals-portal/announcements"
            className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-sm border border-[var(--jp-border)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--jp-muted)] transition hover:border-[var(--jp-gold)]/50 hover:text-[var(--jp-ink)] sm:inline-flex"
          >
            View All
          </Link>
        </FadeUp>

        <div className="mt-12 grid items-stretch gap-8 lg:grid-cols-2">
          <FadeUp>
            <article className="flex h-full flex-col rounded-md border border-[var(--jp-border)] bg-[#FBF7EF] p-7 dark:bg-[var(--jp-card)]">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-md bg-[rgba(201,162,39,0.15)] p-2.5 text-[var(--jp-gold)]">
                  <Megaphone className="h-5 w-5" strokeWidth={1.5} />
                </span>
                {item?.isPinned || !item ? (
                  <span className="rounded-sm bg-[var(--jp-gold)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--jp-navy)]">
                    New
                  </span>
                ) : null}
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--jp-muted)]">
                {item?.publishedAt
                  ? new Date(item.publishedAt).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Announcement'}
              </p>
              <h3 className="jp-serif mt-3 text-2xl font-semibold leading-snug">
                {item?.title || 'Call for Papers — Next Annual Issue'}
              </h3>
              {item?.bodyHtml ? (
                <div
                  className="prose prose-sm mt-3 line-clamp-4 max-w-none text-[var(--jp-muted)] dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
                />
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-[var(--jp-muted)]">
                  Submissions are invited for the forthcoming annual volume. See author guidelines
                  for scope, formatting, and deadlines.
                </p>
              )}
              <Link
                href={
                  item ? '/journals-portal/announcements' : '/journals-portal/author-guidelines'
                }
                className="mt-6 inline-flex text-sm font-semibold text-[var(--jp-gold)] hover:underline"
              >
                Read More →
              </Link>
            </article>
          </FadeUp>

          <FadeUp delay={0.08} className="relative min-h-[280px] overflow-hidden rounded-md">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('${image}'), linear-gradient(135deg, #0B1F3A 0%, #1a3a5c 55%, #C9A227 140%)`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-[rgba(11,31,58,0.55)] via-transparent to-[rgba(201,162,39,0.25)]" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <p className="jp-serif text-xl font-semibold">{headline}</p>
              <p className="mt-1 text-sm text-white/75">{subtext}</p>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
