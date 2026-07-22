'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CalendarRange,
  GraduationCap,
  PlayCircle,
  Quote,
  Users,
} from 'lucide-react';
import { Reveal } from '@/components/ui/reveal';
import type { AboutCollegeContent, AboutStat } from '@/lib/about-college';

type Props = {
  about: AboutCollegeContent;
};

const statIcons = {
  founded: CalendarRange,
  programmes: BookOpen,
  students: GraduationCap,
  faculty: Users,
  departments: Building2,
  naac: Award,
} as const;

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
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function AnimatedStat({ stat, active }: { stat: AboutStat; active: boolean }) {
  const [current, setCurrent] = useState(0);
  const isTextOnly = Boolean(stat.prefix && !stat.value);
  const Icon = statIcons[stat.id as keyof typeof statIcons] ?? Award;

  useEffect(() => {
    if (!active || isTextOnly) return;
    if (stat.value >= 1900) {
      setCurrent(stat.value);
      return;
    }
    let frame = 0;
    const duration = 1300;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setCurrent(Math.floor(progress * stat.value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, isTextOnly, stat.value]);

  return (
    <div className="about-stat">
      <span className="about-stat-icon" aria-hidden>
        <Icon />
      </span>
      <strong>
        {stat.prefix && !stat.value ? stat.prefix : null}
        {!isTextOnly
          ? `${stat.prefix && stat.value ? stat.prefix : ''}${
              stat.value >= 1900 ? String(stat.value) : current.toLocaleString('en-IN')
            }${stat.suffix ?? ''}`
          : null}
      </strong>
      <span className="about-stat-label">{stat.label}</span>
    </div>
  );
}

function AboutDescription({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const [expanded, setExpanded] = useState(false);
  const needsToggle = paragraphs.length > 1 || text.length > 320;
  const visibleParagraphs = !needsToggle || expanded ? paragraphs : paragraphs.slice(0, 1);

  return (
    <div className="about-college-description-block">
      {visibleParagraphs.map((paragraph) => (
        <p className="about-college-description" key={paragraph.slice(0, 48)}>
          {paragraph}
        </p>
      ))}
      {needsToggle ? (
        <button
          type="button"
          className="about-read-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Read less' : 'Read more'} <ArrowRight aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function AboutCollegeSection({ about }: Props) {
  const { ref, visible } = useInViewOnce();

  return (
    <Reveal>
      <section className="about-college" aria-labelledby="about-college-heading">
        <div className="shell">
          <div className="about-college-panel">
            <div className="about-college-media">
              <div className="about-college-watermark" aria-hidden />
              <div className="about-college-portrait">
                <Image
                  src={about.portraitSrc}
                  alt={about.portraitAlt}
                  fill
                  sizes="(max-width: 900px) 70vw, 280px"
                  loading="lazy"
                />
              </div>
            </div>

            <div className="about-college-copy">
              <p className="about-college-kicker">{about.eyebrow}</p>
              <h2 id="about-college-heading">{about.subtitle}</h2>
              <AboutDescription text={about.description} />
              <blockquote className="about-college-quote">
                <Quote aria-hidden />
                <p>“{about.quote}”</p>
                <cite>— {about.quoteAttribution}</cite>
              </blockquote>
            </div>

            <div className="about-college-aside" ref={ref}>
              <div className="about-college-stats">
                {about.stats.map((stat) => (
                  <AnimatedStat key={stat.id} stat={stat} active={visible} />
                ))}
              </div>
              <div className="about-college-actions">
                <Link className="button gold-button" href={about.readMoreHref}>
                  Discover more <ArrowRight aria-hidden />
                </Link>
                <Link className="button outline about-tour-btn" href={about.tourHref}>
                  <PlayCircle aria-hidden /> Virtual tour
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
