'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSchoolWebHref } from '@/components/school-web/school-web-host';
import { schoolPublicPath } from '@/lib/school-web/paths';

export type HeroSlide = {
  enabled?: boolean;
  kicker?: string;
  title?: string;
  text?: string;
  image?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type HeroQuickLink = {
  href: string;
  label: string;
  icon?: QuickIcon;
};

type QuickIcon = 'admissions' | 'academics' | 'facilities' | 'student-life' | 'events' | 'gallery';

function isCrestFile(src?: string) {
  const s = (src || '').toLowerCase();
  return s.includes('logo') || s.includes('campus-hero');
}

function iconFor(href: string, explicit?: QuickIcon): QuickIcon {
  if (explicit) return explicit;
  if (href.includes('admissions') || href.includes('apply')) return 'admissions';
  if (href.includes('academ')) return 'academics';
  if (href.includes('facilit')) return 'facilities';
  if (href.includes('student') || href.includes('campus-life')) return 'student-life';
  if (href.includes('notice') || href.includes('event')) return 'events';
  if (href.includes('gallery')) return 'gallery';
  return 'academics';
}

function pathMatches(current: string, href: string) {
  const here = schoolPublicPath(current || '/');
  const target = schoolPublicPath(href);
  if (target === '/') return here === '/' || here === '/school-site';
  return here === target || here.startsWith(`${target}/`);
}

export function SchoolHeroSlider({
  slides,
  fallbackImage,
  schoolName,
  motto,
  applyHref,
  exploreHref,
  quickLinks = [],
}: {
  slides: HeroSlide[];
  fallbackImage: string;
  schoolName: string;
  motto: string;
  applyHref: string;
  exploreHref: string;
  quickLinks?: HeroQuickLink[];
}) {
  const hrefFor = useSchoolWebHref();
  const pathname = usePathname() || '/';
  const list = slides.filter((s) => s.enabled !== false);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % list.length), 7000);
    return () => window.clearInterval(t);
  }, [list.length]);
  const slide = list[i] ?? list[0];
  if (!slide) return null;
  const { lead, rest } = splitSchoolName(schoolName);
  const go = (dir: number) => setI((n) => (n + dir + list.length) % list.length);
  const isWelcome = i === 0;
  const caption = String(slide.title || '').trim();
  const photo = [slide.image, fallbackImage].find((src) => src && !isCrestFile(src));

  return (
    <section className={isWelcome ? 'sls-hero' : 'sls-hero is-bright'}>
      {photo ? (
        <img key={photo} className="sls-hero-photo is-on" src={photo} alt={caption || schoolName} />
      ) : null}
      {isWelcome ? <div className="sls-hero-mask" /> : null}
      {isWelcome ? <div className="sls-hero-navfade" aria-hidden /> : null}
      {isWelcome ? (
        <div className="sls-hero-frame">
          <div className="sls-hero-copy">
            <p className="sls-hero-welcome">Welcome to</p>
            <h1>
              <span>{lead}</span>
              {rest ? <em>{rest}</em> : null}
            </h1>
            <p className="sls-hero-motto">{motto.replace(/·/g, ' • ')}</p>
            <div className="sls-actions">
              <a className="sls-btn sls-btn-gold" href={hrefFor(slide.ctaHref || applyHref)}>
                {slide.ctaLabel || 'Student life'} <span aria-hidden>→</span>
              </a>
              <a className="sls-btn sls-btn-ghost" href={hrefFor(exploreHref)}>
                Explore Our School
              </a>
            </div>
          </div>
        </div>
      ) : caption ? (
        <p className="sls-hero-caption">{caption}</p>
      ) : null}
      {list.length > 1 ? (
        <>
          <button
            type="button"
            className="sls-hero-arrow sls-hero-prev"
            aria-label="Previous slide"
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="sls-hero-arrow sls-hero-next"
            aria-label="Next slide"
            onClick={() => go(1)}
          >
            ›
          </button>
          <div className="sls-dots">
            {list.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={idx === i ? 'is-on' : ''}
                aria-label={`Show slide ${idx + 1}`}
                onClick={() => setI(idx)}
              />
            ))}
          </div>
        </>
      ) : null}
      {quickLinks.length ? (
        <nav className="sls-quick" aria-label="Explore St. Luke's">
          {quickLinks.map((link) => {
            const current = pathMatches(pathname, link.href);
            return (
              <a
                key={link.href}
                href={hrefFor(link.href)}
                className={current ? 'is-current' : undefined}
                aria-current={current ? 'page' : undefined}
              >
                <span className="sls-quick-icon" aria-hidden>
                  <QuickNavIcon name={iconFor(link.href, link.icon)} />
                </span>
                <span className="sls-quick-label">{link.label}</span>
              </a>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}

function splitSchoolName(name: string) {
  const match = name.match(/^(St\.?\s*Luke['’]s)(.*)$/i);
  if (match) return { lead: match[1].replace(/\s+$/, ''), rest: match[2].replace(/^[\s,]+/, '') };
  return { lead: name, rest: '' };
}

function QuickNavIcon({ name }: { name: QuickIcon }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
  };
  if (name === 'admissions') {
    return (
      <svg {...common} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10 12 5l9 5-9 5-9-5z" />
        <path d="M7 12.5v4.2c2.2 1.4 7.8 1.4 10 0V12.5" />
        <path d="M21 10.2v5.2" />
      </svg>
    );
  }
  if (name === 'academics') {
    return (
      <svg {...common} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6.5c3.2-1.6 6.4-1.6 8 0 1.6-1.6 4.8-1.6 8 0v11c-3.2-1.6-6.4-1.6-8 0-1.6-1.6-4.8-1.6-8 0z" />
        <path d="M12 6.5v11" />
      </svg>
    );
  }
  if (name === 'facilities') {
    return (
      <svg {...common} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V9l8-5 8 5v11" />
        <path d="M9 20v-6h6v6" />
      </svg>
    );
  }
  if (name === 'student-life') {
    return (
      <svg {...common} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="2.4" />
        <path d="M4.5 18a4.5 4.5 0 0 1 9 0" />
        <circle cx="16.5" cy="9" r="2" />
        <path d="M14.2 18a4 4 0 0 1 6.3-2.4" />
      </svg>
    );
  }
  if (name === 'events') {
    return (
      <svg {...common} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
      </svg>
    );
  }
  return (
    <svg {...common} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5h3l1.4-2h7.2l1.4 2H20v10.2H4z" />
      <circle cx="12" cy="13.2" r="3.1" />
    </svg>
  );
}
