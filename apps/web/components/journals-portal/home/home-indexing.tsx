'use client';

import { HOME_INDEXING } from './transient-home-static';
import { FadeUp } from './home-motion';

export function HomeIndexing() {
  return (
    <section className="border-y border-[var(--jp-border)] bg-[var(--jp-paper)]">
      <div className="mx-auto max-w-7xl px-4 py-20 lg:px-6">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <p className="jp-eyebrow">Discovery</p>
          <h2 className="jp-serif mt-3 text-3xl font-semibold tracking-tight">Journal indexing</h2>
          <p className="mt-4 text-sm leading-relaxed text-[var(--jp-muted)]">
            Discoverability pathways supported by the Transient publishing platform. Additional
            indexes may be added as coverage expands.
          </p>
        </FadeUp>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
          {HOME_INDEXING.map((name, i) => (
            <FadeUp key={name} delay={i * 0.03}>
              <div className="jp-glass jp-lift flex h-full items-center justify-center rounded-[18px] px-4 py-6 text-center text-sm font-semibold tracking-wide text-[var(--jp-ink)]">
                {name}
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}
