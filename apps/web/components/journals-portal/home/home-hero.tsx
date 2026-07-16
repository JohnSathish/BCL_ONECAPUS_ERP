'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import type { JournalIssue, JournalInfo } from '@/services/journals-portal';
import { FadeUp } from './home-motion';

type HeroSlide = {
  src: string;
  caption: string;
  effect?: 'none' | 'ken' | 'ken-alt';
};

type Props = {
  journal: JournalInfo;
  issue: JournalIssue | null;
  banner: string;
  cover: string;
};

export function HomeHero({ journal, issue, banner, cover }: Props) {
  const issn = journal.issn;
  const slides = useMemo((): HeroSlide[] => {
    const urls = [banner, cover].filter(Boolean);
    const unique = [...new Set(urls)];
    if (unique.length === 1) {
      return [
        { src: unique[0], caption: 'Campus', effect: 'none' },
        { src: unique[0], caption: 'Campus', effect: 'ken' },
        { src: unique[0], caption: 'Campus', effect: 'ken-alt' },
      ];
    }
    return unique.map((src, i) => ({
      src,
      caption: i === 0 ? 'Campus' : 'Journal',
      effect: 'none' as const,
    }));
  }, [banner, cover]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const go = (dir: -1 | 1) => {
    setIndex((i) => (i + dir + slides.length) % slides.length);
  };

  const slide = slides[index];
  const imgClass =
    slide?.effect === 'ken'
      ? 'jp-hero-slide-ken h-full w-full object-cover'
      : slide?.effect === 'ken-alt'
        ? 'jp-hero-slide-ken-alt h-full w-full object-cover'
        : 'h-full w-full object-cover';

  return (
    <section className="relative pb-12 text-white sm:pb-14">
      <div className="grid min-h-[72vh] lg:min-h-[78vh] lg:grid-cols-2">
        <div className="jp-hero-mesh relative flex items-center px-6 py-16 sm:px-10 lg:px-14 xl:px-16">
          <FadeUp className="relative z-10 max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E4BC3A]">
              Advancing knowledge. Inspiring discovery.
            </p>
            <h1 className="jp-serif mt-5 text-5xl font-semibold uppercase tracking-tight sm:text-6xl lg:text-[4.5rem] lg:leading-[1.02]">
              {journal.name}
            </h1>
            <p className="mt-4 text-base font-medium text-white/90 sm:text-lg">
              {journal.tagline || 'A Journal of Natural Sciences and Allied Subjects'}
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {issn ? (
                <>
                  <span className="rounded-md border border-white/15 bg-black/25 px-3.5 py-2.5 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur-sm">
                    ISSN (Print): {issn}
                  </span>
                  <span className="rounded-md border border-white/15 bg-black/25 px-3.5 py-2.5 text-[11px] font-medium tracking-wide text-white/90 backdrop-blur-sm">
                    ISSN (Online): {issn}
                  </span>
                </>
              ) : null}
            </div>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/85">
              <Lock className="h-3.5 w-3.5 text-[#E4BC3A]" />
              Peer Reviewed / Open Access
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/journals-portal/current-issue"
                className="jp-btn jp-btn-gold rounded-sm px-6 py-3"
              >
                Current Issue
              </Link>
              <Link
                href="/journals-portal/author"
                className="jp-btn rounded-sm border border-white/55 bg-transparent px-6 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/10"
              >
                Submit Paper
              </Link>
            </div>

            {issue ? (
              <p className="mt-8 text-xs text-white/45">
                Latest · Vol. {issue.volume.volumeNumber} ({issue.volume.year}) · Issue{' '}
                {issue.issueNumber}
              </p>
            ) : null}
          </FadeUp>
        </div>

        <div className="relative min-h-[42vh] overflow-hidden lg:min-h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide?.src} alt={slide?.caption || 'Campus'} className={imgClass} />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[rgba(11,31,58,0.15)] lg:hidden" />
            </motion.div>
          </AnimatePresence>

          {slides.length > 1 ? (
            <>
              <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === index ? 'w-6 bg-[#C9A227]' : 'w-2 bg-white/55 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => go(-1)}
                className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/30 bg-black/25 p-2 text-white backdrop-blur-sm transition hover:bg-black/40 sm:inline-flex"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => go(1)}
                className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/30 bg-black/25 p-2 text-white backdrop-blur-sm transition hover:bg-black/40 sm:inline-flex"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
