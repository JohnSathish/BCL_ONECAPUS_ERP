'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  HandHeart,
  Newspaper,
  Trophy,
} from 'lucide-react';
import { NewsFeaturedMedia } from '@/components/news-featured-media';
import { newsCategoryIcon } from '@/lib/news-media';

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
  const [selected, setSelected] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const sync = useCallback(() => {
    if (!embla) return;
    setCanPrev(embla.canScrollPrev());
    setCanNext(embla.canScrollNext());
    setSelected(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    setScrollSnaps(embla.scrollSnapList());
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
          <span className="news-events-emblem" aria-hidden>
            <Newspaper />
          </span>
          <h2 id="news-events-heading">News &amp; Events</h2>
          <span className="news-events-rule" aria-hidden />
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
                const Icon = newsCategoryIcon(item.category);
                return (
                  <article className="news-events-card" key={item.slug}>
                    <div className="news-events-media">
                      <NewsFeaturedMedia
                        image={item.image}
                        title={item.title}
                        slug={item.slug}
                        category={item.category}
                        sizes="(max-width: 760px) 85vw, 280px"
                      />
                      <time className="news-events-date" dateTime={item.date}>
                        <strong>{day}</strong>
                        <span>
                          {month} {year}
                        </span>
                      </time>
                      <span className="news-events-category">
                        <Icon aria-hidden />
                        {item.category || 'News & Events'}
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

        {scrollSnaps.length > 1 ? (
          <div className="news-events-dots" role="tablist" aria-label="News slides">
            {scrollSnaps.map((_, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={selected === index}
                aria-label={`Go to slide ${index + 1}`}
                className={selected === index ? 'is-active' : undefined}
                onClick={() => embla?.scrollTo(index)}
              />
            ))}
          </div>
        ) : null}

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
