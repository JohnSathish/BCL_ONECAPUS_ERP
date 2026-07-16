'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import type { JournalPortalInfo } from '@/services/journals-portal';
import { FadeUp } from './home-motion';

type Props = { members: JournalPortalInfo['boardPreview'] };

const PER_PAGE = 4;

export function HomeBoard({ members }: Props) {
  const pages = useMemo(() => {
    const list = members.slice(0, 12);
    if (!list.length) return [];
    const chunks: (typeof list)[] = [];
    for (let i = 0; i < list.length; i += PER_PAGE) {
      chunks.push(list.slice(i, i + PER_PAGE));
    }
    return chunks;
  }, [members]);

  const [page, setPage] = useState(0);
  if (!pages.length) return null;

  const current = pages[Math.min(page, pages.length - 1)] ?? [];

  return (
    <section className="bg-white px-4 py-16 dark:bg-transparent lg:px-6 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <FadeUp className="relative flex items-center justify-center">
          <h2 className="jp-serif text-center text-3xl font-semibold tracking-tight">
            Editorial Board
          </h2>
          <Link
            href="/journals-portal/editorial-board"
            className="absolute right-0 top-1/2 hidden -translate-y-1/2 rounded-sm border border-[var(--jp-border)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--jp-muted)] transition hover:border-[var(--jp-gold)]/50 hover:text-[var(--jp-ink)] sm:inline-flex"
          >
            View All
          </Link>
        </FadeUp>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {current.map((m, i) => (
            <FadeUp key={m.id} delay={i * 0.05}>
              <div className="jp-lift overflow-hidden rounded-md border border-[var(--jp-border)] bg-[var(--jp-card)] text-center shadow-sm">
                <div className="mx-auto mt-6 flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-[var(--jp-paper)] ring-2 ring-[rgba(201,162,39,0.35)]">
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photoUrl} alt={m.fullName} className="h-full w-full object-cover" />
                  ) : (
                    <Users className="h-10 w-10 text-[var(--jp-ink)]/20" />
                  )}
                </div>
                <div className="px-4 pb-6 pt-4">
                  <p className="jp-serif text-lg font-semibold leading-snug">{m.fullName}</p>
                  <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--jp-gold)]">
                    {m.roleTitle}
                  </p>
                  <p className="mt-2 text-xs text-[var(--jp-muted)]">
                    {m.institution || 'Don Bosco College, Tura'}
                  </p>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>

        {pages.length > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-2">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Board page ${i + 1}`}
                onClick={() => setPage(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === page
                    ? 'w-6 bg-[var(--jp-gold)]'
                    : 'w-2.5 bg-[var(--jp-ink)]/20 hover:bg-[var(--jp-ink)]/35'
                }`}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/journals-portal/editorial-board"
            className="text-sm font-medium text-[var(--jp-muted)] hover:text-[var(--jp-ink)]"
          >
            View all →
          </Link>
        </div>
      </div>
    </section>
  );
}
