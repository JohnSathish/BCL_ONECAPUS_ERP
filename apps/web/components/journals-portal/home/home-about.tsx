'use client';

import type { JournalInfo } from '@/services/journals-portal';
import { FadeUp } from './home-motion';

type Props = { journal: JournalInfo };

export function HomeAbout({ journal }: Props) {
  const name = journal.name || 'Transient';
  return (
    <section className="bg-[var(--jp-card)] px-4 py-16 lg:px-6 lg:py-20">
      <FadeUp className="mx-auto max-w-3xl text-center">
        <h2 className="jp-eyebrow">About {name}</h2>
        <p className="mt-5 text-base leading-relaxed text-[var(--jp-muted)] sm:text-[1.05rem]">
          {journal.description ||
            `${name} is an annual peer-reviewed multi-discipline research science journal published by Don Bosco College, Tura, Meghalaya, India. It provides a rigorous forum for experiment-based ideas and beneficial applications of modern science.`}
        </p>
        <p className="mt-4 text-base leading-relaxed text-[var(--jp-muted)] sm:text-[1.05rem]">
          The journal widens avenues for young scholars to publish carefully reviewed findings
          across the natural sciences and allied subjects — including strategy papers, reviews,
          research articles, short communications, and maiden reports.
        </p>
      </FadeUp>
    </section>
  );
}
