'use client';

import Link from 'next/link';
import type { JournalArticle } from '@/services/journals-portal';
import { FadeUp } from './home-motion';

type Props = { articles: JournalArticle[] };

export function HomeArticles({ articles }: Props) {
  if (!articles.length) return null;

  return (
    <section className="border-y border-[var(--jp-border)] bg-[var(--jp-paper)]">
      <div className="mx-auto max-w-7xl px-4 py-20 lg:px-6">
        <FadeUp className="max-w-2xl">
          <p className="jp-eyebrow">Discover</p>
          <h2 className="jp-serif mt-3 text-3xl font-semibold tracking-tight">Latest articles</h2>
        </FadeUp>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {articles.slice(0, 6).map((a, i) => (
            <FadeUp key={a.id} delay={i * 0.04}>
              <article className="jp-lift jp-card-18 flex h-full flex-col p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--jp-muted)]">
                  {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : 'Published'}
                  {a.keywords?.[0] ? ` · ${a.keywords[0]}` : ''}
                </p>
                <Link
                  href={`/journals-portal/articles/${a.id}`}
                  className="jp-serif mt-3 text-xl font-semibold leading-snug hover:underline"
                >
                  {a.title}
                </Link>
                <p className="mt-2 text-sm text-[var(--jp-muted)]">
                  {(a.authors ?? []).map((x) => x.fullName).join(', ')}
                </p>
                {a.abstract ? (
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--jp-ink)]/70">
                    {a.abstract}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-3 pt-5 text-xs font-semibold">
                  <Link
                    href={`/journals-portal/articles/${a.id}`}
                    className="text-[var(--jp-gold)] hover:underline"
                  >
                    Read more
                  </Link>
                  {a.doi ? <span className="text-[var(--jp-muted)]">DOI {a.doi}</span> : null}
                  {a.pdfUrl ? (
                    <a
                      href={a.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--jp-ink)]/70 hover:underline"
                    >
                      PDF
                    </a>
                  ) : null}
                </div>
              </article>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
