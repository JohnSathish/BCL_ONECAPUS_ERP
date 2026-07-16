'use client';

import { Eye, Globe2, Scale, ShieldCheck, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import { HOME_WHY_PUBLISH } from './transient-home-static';
import { FadeUp } from './home-motion';

const ICONS: Record<string, LucideIcon> = {
  Globe2,
  ShieldCheck,
  Zap,
  Eye,
  Scale,
  Sparkles,
};

export function HomeWhyPublish() {
  const items = HOME_WHY_PUBLISH.slice(0, 6);

  return (
    <section className="bg-[var(--jp-navy)] py-16 text-white lg:py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <FadeUp className="text-center">
          <h2 className="jp-serif text-2xl font-semibold tracking-tight text-[#E4BC3A] sm:text-3xl">
            Why publish with Transient?
          </h2>
        </FadeUp>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {items.map((item, i) => {
            const Icon = ICONS[item.icon] || ShieldCheck;
            return (
              <FadeUp key={item.title} delay={i * 0.04} className="text-center">
                <Icon className="mx-auto h-7 w-7 text-[#E4BC3A]" strokeWidth={1.4} />
                <p className="mt-4 text-sm font-semibold uppercase tracking-[0.06em]">
                  {item.title}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-white/60">{item.description}</p>
              </FadeUp>
            );
          })}
        </div>
      </div>
    </section>
  );
}
