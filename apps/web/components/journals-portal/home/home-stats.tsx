'use client';

import { JournalAnimatedCounter } from '@/components/journals-portal/journal-animated-counter';
import { HOME_EXTRA_STATS } from './transient-home-static';
import { FadeUp } from './home-motion';

type Props = {
  volumeCount: number;
  articleCount: number;
  authorCount: number;
  boardCount: number;
};

export function HomeStats({ volumeCount, articleCount, authorCount, boardCount }: Props) {
  const items = [
    {
      label: 'Volumes published',
      node: (
        <JournalAnimatedCounter
          value={Math.max(volumeCount, 1)}
          suffix="+"
          className="jp-serif text-4xl font-semibold tracking-tight"
        />
      ),
    },
    {
      label: 'Articles published',
      node: (
        <JournalAnimatedCounter
          value={Math.max(articleCount, 1)}
          suffix="+"
          className="jp-serif text-4xl font-semibold tracking-tight"
        />
      ),
    },
    {
      label: 'Authors',
      node: (
        <JournalAnimatedCounter
          value={Math.max(authorCount, articleCount, 1)}
          suffix="+"
          className="jp-serif text-4xl font-semibold tracking-tight"
        />
      ),
    },
    {
      label: 'Countries',
      node: (
        <JournalAnimatedCounter
          value={HOME_EXTRA_STATS.countries}
          suffix="+"
          className="jp-serif text-4xl font-semibold tracking-tight"
        />
      ),
    },
    {
      label: 'Editorial board',
      node: (
        <JournalAnimatedCounter
          value={Math.max(boardCount, 1)}
          suffix="+"
          className="jp-serif text-4xl font-semibold tracking-tight"
        />
      ),
    },
    {
      label: 'Acceptance rate',
      node: (
        <span className="jp-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {HOME_EXTRA_STATS.acceptanceRateLabel}
        </span>
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 lg:px-6">
      <FadeUp className="max-w-2xl">
        <p className="jp-eyebrow">Credibility</p>
        <h2 className="jp-serif mt-3 text-3xl font-semibold tracking-tight sm:text-[2.5rem]">
          Journal at a glance
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[var(--jp-muted)]">
          Transparent signals authors and readers expect from a serious academic journal.
        </p>
      </FadeUp>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {items.map((item, i) => (
          <FadeUp key={item.label} delay={i * 0.04}>
            <div className="jp-lift jp-card-18 px-4 py-7 text-center">
              <div className="text-[var(--jp-navy)] dark:text-[var(--jp-ink)]">{item.node}</div>
              <p className="jp-stat-label">{item.label}</p>
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}
