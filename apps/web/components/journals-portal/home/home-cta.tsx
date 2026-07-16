'use client';

import Link from 'next/link';
import { FadeUp } from './home-motion';

export function HomeCta() {
  return (
    <section className="relative overflow-hidden bg-[var(--jp-navy)] py-20 text-white">
      <div
        className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #C9A227, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #4a7ab5, transparent 70%)' }}
      />
      <FadeUp className="relative mx-auto max-w-3xl px-4 text-center lg:px-6">
        <p className="jp-eyebrow text-[#E4BC3A]">Call to action</p>
        <h2 className="jp-serif mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Ready to publish?
        </h2>
        <p className="mt-4 text-base text-white/70">
          Submit your manuscript to Transient and join a peer-reviewed community advancing natural
          sciences and allied subjects.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/journals-portal/author" className="jp-btn jp-btn-gold rounded-md px-6 py-3">
            Submit Paper
          </Link>
          <Link
            href="/journals-portal/author-guidelines"
            className="jp-btn rounded-md border border-white/35 bg-white/5 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white"
          >
            Author Guidelines
          </Link>
        </div>
      </FadeUp>
    </section>
  );
}
