'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { HOME_FAQ } from './transient-home-static';
import { FadeUp } from './home-motion';
import { cn } from '@/utils/cn';

export function HomeFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="border-y border-[var(--jp-border)] bg-[var(--jp-paper)]">
      <div className="mx-auto max-w-3xl px-4 py-20 lg:px-6">
        <FadeUp className="text-center">
          <p className="jp-eyebrow">Help</p>
          <h2 className="jp-serif mt-3 text-3xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
        </FadeUp>
        <div className="mt-10 space-y-3">
          {HOME_FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <FadeUp key={item.q} delay={i * 0.03}>
                <div className="jp-card-18 overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span className="text-sm font-semibold text-[var(--jp-ink)]">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-[var(--jp-muted)] transition',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {isOpen ? (
                    <div className="border-t border-[var(--jp-border)] px-5 py-4 text-sm leading-relaxed text-[var(--jp-muted)]">
                      {item.a}
                    </div>
                  ) : null}
                </div>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}
