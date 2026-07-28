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
import { COMPANY_INFO } from '@/lib/company-info';

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

/** Keep honorific + name on one line (avoid "St." wrapping alone). */
function keepSaintNameTogether(text: string) {
  return text.replace(/St\.\s+John\s+Bosco/gi, 'St.\u00A0John\u00A0Bosco');
}

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

function YearsExperienceSeal({ years }: { years: number }) {
  const ringText = 'YEARS OF EXPERIENCE • YEARS OF EXPERIENCE • ';
  return (
    <div className="about-experience-seal" aria-label={`${years}+ years of experience`}>
      <div className="about-experience-seal-core" aria-hidden>
        <strong>
          {years}
          <span>+</span>
        </strong>
      </div>
      <svg className="about-experience-seal-ring" viewBox="0 0 200 200" aria-hidden>
        <defs>
          <linearGradient id="about-exp-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e4c15a" />
            <stop offset="45%" stopColor="#c79a2b" />
            <stop offset="100%" stopColor="#8a650f" />
          </linearGradient>
          <path
            id="about-exp-circle"
            d="M 100,100 m -78,0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0"
          />
        </defs>
        <circle cx="100" cy="100" r="96" className="about-experience-seal-disk" />
        <text className="about-experience-seal-text">
          <textPath href="#about-exp-circle" startOffset="0%">
            {ringText}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

export function AboutCollegeSection({ about }: Props) {
  const { ref, visible } = useInViewOnce();
  const founded =
    about.stats.find((stat) => stat.id === 'founded')?.value ?? COMPANY_INFO.establishedYear;
  const years = Math.max(0, new Date().getFullYear() - founded);

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
              <h2 id="about-college-heading">{keepSaintNameTogether(about.subtitle)}</h2>
              <AboutDescription text={about.description} />
              <blockquote className="about-college-quote">
                <Quote aria-hidden />
                <p>“{about.quote}”</p>
                <cite>— {keepSaintNameTogether(about.quoteAttribution)}</cite>
              </blockquote>
            </div>

            <div className="about-college-aside" ref={ref}>
              <div className="about-college-stats">
                {about.stats.map((stat) => (
                  <AnimatedStat key={stat.id} stat={stat} active={visible} />
                ))}
              </div>
              <YearsExperienceSeal years={years} />
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
