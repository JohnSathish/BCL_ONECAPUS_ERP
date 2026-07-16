'use client';

import Link from 'next/link';
import { BookOpen, Download, Library, Mail, Send, Users, type LucideIcon } from 'lucide-react';
import { HOME_QUICK_ACCESS } from './transient-home-static';
import { FadeUp } from './home-motion';

const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Send,
  Library,
  Download,
  Users,
  Mail,
};

/** Overlaps the bottom edge of the hero. */
export function HomeQuickAccess() {
  return (
    <section className="relative z-20 -mt-14 px-4 pb-4 sm:-mt-16 lg:px-6">
      <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {HOME_QUICK_ACCESS.map((item, i) => {
          const Icon = ICONS[item.icon] || BookOpen;
          return (
            <FadeUp key={item.href} delay={i * 0.04}>
              <Link
                href={item.href}
                className="jp-lift group flex h-full flex-col items-start gap-2.5 rounded-md border border-[var(--jp-border)] bg-[var(--jp-card)] p-4 shadow-[0_12px_32px_rgba(11,31,58,0.12)] dark:bg-[var(--jp-card)]"
              >
                <span className="text-[var(--jp-gold)]">
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--jp-ink)]">
                  {item.label}
                </span>
                <span className="text-[11px] text-[var(--jp-muted)]">{item.description}</span>
              </Link>
            </FadeUp>
          );
        })}
      </div>
    </section>
  );
}
