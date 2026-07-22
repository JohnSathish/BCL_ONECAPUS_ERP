'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HandHeart,
  Trophy,
  Users,
} from 'lucide-react';

type NewsItem = {
  slug: string;
  title: string;
  date: string;
  category: string;
  excerpt: string;
  image: string;
};

type Props = {
  items: NewsItem[];
};

const categoryIcons: Record<string, LucideIcon> = {
  Campus: Users,
  'College Life': Users,
  Admissions: GraduationCap,
  Academic: BookOpen,
  Examination: BookOpen,
  Achievements: Trophy,
  Service: HandHeart,
  'Field Visit': CalendarDays,
};

const highlights = [
  { icon: CalendarDays, label: 'Active Campus Life' },
  { icon: Trophy, label: 'Excellence in Academics' },
  { icon: HandHeart, label: 'Nurturing Values & Leadership' },
  { icon: BookOpen, label: 'Holistic Education for a Better Tomorrow' },
] as const;

function dateParts(iso: string) {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    year: date.toLocaleDateString('en-IN', { year: 'numeric' }),
  };
}

export function NewsEventsSection({ items }: Props) {
  const [emblaRef, embla] = useEmblaCarousel({
    align: 'start',
    loop: items.length > 4,
    skipSnaps: false,
    dragFree: false,
    containScroll: 'trimSnaps',
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    if (!embla) return;
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    sync();
    embla.on('select', sync);
    embla.on('reInit', sync);
    return () => {
      embla.off('select', sync);
      embla.off('reInit', sync);
    };
  }, [embla, sync]);

  if (!items.length) return null;

  return (
    <section className="news-events" aria-labelledby="news-events-heading">
      <div className="shell news-events-inner">
        <header className="news-events-head">
          <span className="news-events-kicker">Stay updated</span>
          <h2 id="news-events-heading">News &amp; Events</h2>
          <p>
            Discover the latest happenings, achievements, and activities at Don Bosco College, Tura.
          </p>
        </header>

        <div className="news-events-carousel">
          <button
            type="button"
            className="news-events-arrow is-prev"
            aria-label="Previous news"
            disabled={!canPrev && !items.length}
            onClick={() => embla?.scrollPrev()}
          >
            <ChevronLeft aria-hidden />
          </button>

          <div className="news-events-viewport" ref={emblaRef}>
            <div className="news-events-track">
              {items.map((item) => {
                const { day, month, year } = dateParts(item.date);
                const Icon = categoryIcons[item.category] ?? CalendarDays;
                return (
                  <article className="news-events-card" key={item.slug}>
                    <div className="news-events-media">
                      <Image src={item.image} alt="" fill sizes="(max-width: 760px) 85vw, 280px" />
                      <time className="news-events-date" dateTime={item.date}>
                        <strong>{day}</strong>
                        <span>
                          {month}
                          <br />
                          {year}
                        </span>
                      </time>
                      <span className="news-events-category">
                        <Icon aria-hidden />
                        {item.category}
                      </span>
                    </div>
                    <div className="news-events-body">
                      <h3>{item.title}</h3>
                      <p>{item.excerpt}</p>
                      <Link href={`/news/${item.slug}`}>
                        Read More <ArrowRight aria-hidden />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="news-events-arrow is-next"
            aria-label="Next news"
            disabled={!canNext && !items.length}
            onClick={() => embla?.scrollNext()}
          >
            <ChevronRight aria-hidden />
          </button>
        </div>

        <div className="news-events-cta">
          <Link className="news-events-all" href="/news">
            View all news &amp; events <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>

      <div className="news-events-bar" aria-label="Campus highlights">
        <div className="shell news-events-bar-grid">
          {highlights.map(({ icon: Icon, label }) => (
            <div className="news-events-bar-item" key={label}>
              <span aria-hidden>
                <Icon />
              </span>
              <p>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
