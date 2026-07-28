'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowRight,
  Award,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FlaskConical,
  GraduationCap,
  Landmark,
  Library,
  MonitorUp,
  PlayCircle,
  Quote,
  Trophy,
  Users,
} from 'lucide-react';
import type { NewsItem } from '@/lib/content';
import {
  newsBadgeStyles,
  normalizeNewsCategory,
  type HomepageSpotlightContent,
} from '@/lib/homepage-spotlight';
import '../app/homepage-spotlight.css';

type Props = {
  spotlight: HomepageSpotlightContent;
  news: NewsItem[];
};

function useInViewOnce() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function AnimatedStat({
  value,
  suffix = '',
  label,
  active,
}: {
  value: number;
  suffix?: string;
  label: string;
  active: boolean;
}) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setCurrent(Math.floor(progress * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value]);
  return (
    <div className="spotlight-stat">
      <strong>
        {current.toLocaleString('en-IN')}
        {suffix}
      </strong>
      <span>{label}</span>
    </div>
  );
}

function newsDateParts(isoDate: string) {
  const date = new Date(isoDate);
  return {
    day: date.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
  };
}

const quickIcons = {
  admissions: GraduationCap,
  results: Award,
  erp: MonitorUp,
  library: Library,
  calendar: CalendarDays,
  downloads: Download,
} as const;

const highlightIcons = {
  nep: BookOpen,
  cbcs: CalendarDays,
  research: FlaskConical,
  placement: BriefcaseBusiness,
  scholarships: Trophy,
  innovation: Landmark,
} as const;

export function HomepageSpotlight({ spotlight, news }: Props) {
  const { ref: statsRef, visible: statsVisible } = useInViewOnce();
  const [successIndex, setSuccessIndex] = useState(0);
  const [emblaRef, embla] = useEmblaCarousel({
    loop: true,
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: false,
  });
  const [updateIndex, setUpdateIndex] = useState(0);
  const latestNews = news.slice(0, 4);

  useEffect(() => {
    if (!embla) return;
    const select = () => setUpdateIndex(embla.selectedScrollSnap());
    embla.on('select', select);
    select();
    return () => {
      embla.off('select', select);
    };
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    const timer = window.setInterval(() => embla.scrollNext(), 4200);
    return () => window.clearInterval(timer);
  }, [embla]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSuccessIndex((current) => (current + 1) % spotlight.studentSuccess.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [spotlight.studentSuccess.length]);

  const success = spotlight.studentSuccess[successIndex];

  return (
    <section className="premium-spotlight" aria-label="Leadership, news and campus highlights">
      <div className="premium-spotlight-bg" aria-hidden />
      <div className="premium-spotlight-shell">
        <div className="spotlight-top-row">
          <div className="spotlight-updates" role="region" aria-label="Latest updates">
            <div className="spotlight-updates-head">
              <span className="spotlight-kicker">Latest Updates</span>
              <Link className="spotlight-link" href="/news">
                View all <ArrowRight aria-hidden />
              </Link>
            </div>
            <div className="spotlight-updates-carousel">
              <div className="spotlight-updates-viewport" ref={emblaRef}>
                <div className="spotlight-updates-track">
                  {spotlight.updateCards.map((card) => (
                    <div key={card.id} className="spotlight-update-slide">
                      <Link href={card.href} className="spotlight-update-card">
                        {card.label}
                        <ArrowRight aria-hidden />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
              <div className="spotlight-updates-nav">
                <button
                  type="button"
                  aria-label="Previous update"
                  onClick={() => embla?.scrollPrev()}
                >
                  <ChevronLeft aria-hidden />
                </button>
                <span>
                  {updateIndex + 1} / {spotlight.updateCards.length}
                </span>
                <button type="button" aria-label="Next update" onClick={() => embla?.scrollNext()}>
                  <ChevronRight aria-hidden />
                </button>
              </div>
            </div>
          </div>

          <aside className="spotlight-accreditations" aria-label="Accreditations">
            {spotlight.accreditations.map((badge) => (
              <div key={badge.id} className="spotlight-accreditation">
                <strong>{badge.label}</strong>
                <span>{badge.value}</span>
              </div>
            ))}
          </aside>
        </div>

        <div className="spotlight-stats-band">
          <div className="spotlight-stats" ref={statsRef}>
            {spotlight.spotlightStats.map((stat) => (
              <AnimatedStat
                key={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                label={stat.label}
                active={statsVisible}
              />
            ))}
          </div>
        </div>

        <div className="spotlight-main-grid">
          <article className="leadership-spotlight">
            <p className="spotlight-kicker gold">{spotlight.leadership.eyebrow}</p>
            <h2 className="leadership-title">{spotlight.leadership.title}</h2>
            <div className="leadership-body">
              <div className="leadership-portrait-wrap">
                <div className="leadership-portrait-ring">
                  <Image
                    src={spotlight.leadership.portraitSrc}
                    alt={spotlight.leadership.portraitAlt}
                    fill
                    sizes="(max-width: 760px) 140px, 180px"
                    className="leadership-portrait"
                  />
                </div>
                <div className="leadership-meta">
                  <strong>{spotlight.leadership.name}</strong>
                  <span>{spotlight.leadership.role}</span>
                  <small>{spotlight.leadership.tenure}</small>
                </div>
              </div>
              <div className="leadership-copy">
                <p className="leadership-welcome">{spotlight.leadership.welcome}</p>
                <blockquote className="leadership-quote">
                  <Quote aria-hidden className="leadership-quote-icon" />
                  <span>{spotlight.leadership.quote}</span>
                </blockquote>
                <p className="leadership-signature">{spotlight.leadership.name}</p>
                <div className="leadership-actions">
                  <Link
                    className="button gold-button compact"
                    href={spotlight.leadership.messageHref}
                  >
                    Read message <ArrowRight aria-hidden />
                  </Link>
                  <Link
                    className="button outline compact leadership-outline"
                    href={spotlight.leadership.leadershipHref}
                  >
                    Meet leadership
                  </Link>
                  <Link
                    className="button outline compact leadership-outline"
                    href={spotlight.leadership.prospectusHref}
                  >
                    Download prospectus
                  </Link>
                  {spotlight.leadership.tourHref ? (
                    <Link
                      className="button outline compact leadership-outline"
                      href={spotlight.leadership.tourHref}
                    >
                      Virtual campus tour
                    </Link>
                  ) : null}
                  {spotlight.leadership.videoHref ? (
                    <Link className="spotlight-video-link" href={spotlight.leadership.videoHref}>
                      <PlayCircle aria-hidden /> Watch welcome video
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </article>

          <div className="spotlight-side">
            <section
              className="spotlight-card spotlight-news"
              aria-labelledby="spotlight-news-heading"
            >
              <div className="spotlight-card-head">
                <div>
                  <p className="spotlight-kicker">Campus pulse</p>
                  <h3 id="spotlight-news-heading">Latest News &amp; Events</h3>
                </div>
                <Link className="spotlight-link" href="/news">
                  View all <ArrowRight aria-hidden />
                </Link>
              </div>
              <ul className="spotlight-news-list">
                {latestNews.map((item) => {
                  const category = normalizeNewsCategory(item.category);
                  const badge = newsBadgeStyles[category] ?? newsBadgeStyles.Campus;
                  const { day, month } = newsDateParts(item.date);
                  return (
                    <li key={item.slug}>
                      <Link href={`/news/${item.slug}`} className="spotlight-news-item">
                        <span className="spotlight-news-date" aria-hidden>
                          <strong>{day}</strong>
                          <small>{month}</small>
                        </span>
                        <span className="spotlight-news-copy">
                          <span
                            className="spotlight-news-badge"
                            style={{ background: badge.bg, color: badge.color }}
                          >
                            {category}
                          </span>
                          <strong>{item.title}</strong>
                          <span>{item.excerpt}</span>
                          <em>
                            Read story <ArrowRight aria-hidden />
                          </em>
                        </span>
                        <span className="spotlight-news-preview" aria-hidden>
                          <Image src={item.image} alt="" fill sizes="120px" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>

        <div className="spotlight-highlights">
          {spotlight.academicHighlights.map((item) => {
            const Icon = highlightIcons[item.id as keyof typeof highlightIcons] ?? BookOpen;
            return (
              <Link key={item.id} href={item.href} className="spotlight-highlight-card">
                <Icon aria-hidden />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>

        <div className="spotlight-secondary-grid">
          <section
            className="spotlight-card spotlight-success"
            aria-labelledby="spotlight-success-heading"
          >
            <p className="spotlight-kicker">Student success</p>
            <h3 id="spotlight-success-heading">{success.title}</h3>
            <p>
              <strong>{success.name}</strong> — {success.detail}
            </p>
            {success.href ? (
              <Link className="spotlight-link" href={success.href}>
                Discover more <ArrowRight aria-hidden />
              </Link>
            ) : null}
            <div className="spotlight-success-dots" aria-hidden>
              {spotlight.studentSuccess.map((story, index) => (
                <button
                  key={story.id}
                  type="button"
                  className={index === successIndex ? 'active' : ''}
                  aria-label={`Show ${story.title}`}
                  onClick={() => setSuccessIndex(index)}
                />
              ))}
            </div>
          </section>

          <section
            className="spotlight-card spotlight-quick"
            aria-labelledby="spotlight-quick-heading"
          >
            <p className="spotlight-kicker">Quick access</p>
            <h3 id="spotlight-quick-heading">At your fingertips</h3>
            <div className="spotlight-quick-grid">
              {spotlight.quickAccess.map((item) => {
                const Icon = quickIcons[item.id as keyof typeof quickIcons] ?? Users;
                return (
                  <Link key={item.id} href={item.href} className="spotlight-quick-item">
                    <Icon aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <section className="spotlight-campus" aria-labelledby="spotlight-campus-heading">
          <div className="spotlight-card-head">
            <div>
              <p className="spotlight-kicker">Campus life</p>
              <h3 id="spotlight-campus-heading">Experience Don Bosco</h3>
            </div>
          </div>
          <div className="spotlight-campus-grid">
            {spotlight.campusLife.map((item) => (
              <Link key={item.id} href={item.href} className="spotlight-campus-card">
                <Image src={item.image} alt={item.alt} fill sizes="(max-width: 760px) 50vw, 20vw" />
                <span>{item.title}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
