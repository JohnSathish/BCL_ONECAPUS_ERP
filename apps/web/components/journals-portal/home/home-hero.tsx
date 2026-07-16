'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Calendar, ChevronLeft, ChevronRight, Send, Unlock, Users } from 'lucide-react';
import type { JournalIssue, JournalInfo } from '@/services/journals-portal';
import { FadeUp } from './home-motion';

type HeroSlide = {
  src: string;
  caption: string;
  effect?: 'none' | 'ken' | 'ken-alt';
};

const TRANSIENT_HERO_SLIDES: HeroSlide[] = [
  {
    src: '/branding/transient-hero-books.png',
    caption: 'Scholarship in focus',
    effect: 'none',
  },
  {
    src: '/branding/transient-hero-01-light.png',
    caption: 'Fleeting light',
    effect: 'ken',
  },
  {
    src: '/branding/transient-hero-03-moment.png',
    caption: 'A momentary science',
    effect: 'ken-alt',
  },
];

const FEATURES = [
  {
    icon: Users,
    title: 'Peer Reviewed',
    description: 'Rigorous peer review ensures quality',
  },
  {
    icon: Unlock,
    title: 'Open Access',
    description: 'Free and open access to all readers',
  },
  {
    icon: Calendar,
    title: 'Annual Publication',
    description: 'Published once every year',
  },
] as const;

type Props = {
  journal: JournalInfo;
  issue: JournalIssue | null;
  banner: string;
  cover: string;
};

export function HomeHero({ journal, issue }: Props) {
  const slides = TRANSIENT_HERO_SLIDES;
  const [index, setIndex] = useState(0);
  const institution = journal.institution || 'Don Bosco College, Tura';
  const blurb =
    journal.description?.trim() ||
    `${journal.name} is an annual peer-reviewed journal published by ${institution}. The journal aims to promote quality research and scholarly work in multidisciplinary fields.`;

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
      ? 'jp-hero-slide-ken h-full w-full object-cover object-center'
      : slide?.effect === 'ken-alt'
        ? 'jp-hero-slide-ken-alt h-full w-full object-cover object-center'
        : 'h-full w-full object-cover object-center';

  return (
    <section className="relative min-h-[70vh] overflow-hidden text-white sm:min-h-[74vh] lg:min-h-[78vh]">
      {/* Full-bleed background slider */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide?.src} alt={slide?.caption || 'Transient'} className={imgClass} />
          </motion.div>
        </AnimatePresence>
        <div className="jp-hero-unified-overlay absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-center gap-10 px-4 py-16 sm:min-h-[74vh] sm:px-6 sm:py-20 lg:min-h-[78vh] lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-8 lg:py-24">
        <FadeUp className="max-w-xl lg:max-w-2xl">
          <h1 className="jp-serif text-5xl font-semibold uppercase tracking-tight sm:text-6xl lg:text-[4.75rem] lg:leading-[1.02]">
            {journal.name}
          </h1>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E4BC3A] sm:text-xs">
            A Peer Reviewed Annual Journal
          </p>
          <div className="mt-4 h-px w-14 bg-[#C9A227]" />
          <p className="mt-5 max-w-lg text-sm leading-relaxed text-white/90 sm:text-[15px]">
            {blurb}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/journals-portal/current-issue"
              className="jp-btn jp-btn-gold inline-flex items-center gap-2 rounded-sm px-5 py-3"
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.75} />
              View Current Issue
            </Link>
            <Link
              href="/journals-portal/author"
              className="jp-btn inline-flex items-center gap-2 rounded-sm border border-white/60 bg-transparent px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-white/10"
            >
              <Send className="h-4 w-4" strokeWidth={1.75} />
              Submit Your Paper
            </Link>
          </div>

          {issue ? (
            <p className="mt-6 text-xs text-white/45">
              Latest · Vol. {issue.volume.volumeNumber} ({issue.volume.year}) · Issue{' '}
              {issue.issueNumber}
            </p>
          ) : null}
        </FadeUp>

        <FadeUp delay={0.12} className="w-full max-w-sm lg:shrink-0">
          <aside className="rounded-xl border border-white/15 bg-[rgba(8,22,42,0.55)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-6">
            <ul className="space-y-5">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#C9A227]/35 bg-[#C9A227]/10 text-[#E4BC3A]">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/65">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </FadeUp>
      </div>

      {slides.length > 1 ? (
        <>
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
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
            className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/30 bg-black/25 p-2 text-white backdrop-blur-sm transition hover:bg-black/40 sm:inline-flex lg:left-5"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(1)}
            className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/30 bg-black/25 p-2 text-white backdrop-blur-sm transition hover:bg-black/40 sm:inline-flex lg:right-5"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}
    </section>
  );
}
