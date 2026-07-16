'use client';

import { Star } from 'lucide-react';
import { HOME_TESTIMONIALS } from './transient-home-static';
import { FadeUp } from './home-motion';

export function HomeTestimonials() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 lg:px-6">
      <FadeUp className="max-w-2xl">
        <p className="jp-eyebrow">Community</p>
        <h2 className="jp-serif mt-3 text-3xl font-semibold tracking-tight">
          Voices from researchers
        </h2>
      </FadeUp>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {HOME_TESTIMONIALS.map((t, i) => (
          <FadeUp key={t.name} delay={i * 0.05}>
            <blockquote className="jp-lift jp-card-18 flex h-full flex-col p-6">
              <div className="flex gap-0.5 text-[var(--jp-gold)]">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--jp-ink)]/80">
                “{t.quote}”
              </p>
              <footer className="mt-5 border-t border-[var(--jp-border)] pt-4">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-[var(--jp-muted)]">
                  {t.university} · {t.country}
                </p>
              </footer>
            </blockquote>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}
