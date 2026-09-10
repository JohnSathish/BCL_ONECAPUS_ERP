import type { ReactNode } from 'react';
import { resolvePageHero, SchoolPageHero } from '@/components/school-web/school-page-hero';
import { schoolWebPath } from '@/lib/school-web/paths';
import type { SchoolWebBundle } from '@/lib/school-web/public';
import { RELATED_LINKS, type SeoCrumb } from '@/lib/school-web/seo';

export type SchoolInteriorSite = SchoolWebBundle['site'];

export const PAGE_KICKERS: Record<string, string> = {
  about: 'ABOUT THE SCHOOL',
  history: 'OUR STORY',
  'vision-mission': 'VISION & MISSION',
  administration: 'LEADERSHIP',
  faculty: 'FACULTY & STAFF',
  rules: 'SCHOOL HANDBOOK',
  academics: 'ACADEMICS',
  curriculum: 'ACADEMICS',
  examinations: 'ACADEMICS',
  timetable: 'ACADEMICS',
  admissions: 'ADMISSIONS',
  fees: 'ADMISSIONS',
  apply: 'ADMISSIONS',
  'student-life': 'STUDENT LIFE',
  sports: 'SPORTS',
  facilities: 'FACILITIES',
  'campus-life': 'CAMPUS',
  'parent-corner': 'FAMILIES',
  faq: 'GUIDANCE',
  principal: 'FROM THE PRINCIPAL',
  contact: 'VISIT',
  notices: 'NEWS & NOTICES',
  news: 'NEWS',
  events: 'EVENTS',
  gallery: 'GALLERY',
};

export function pageKicker(slug: string, fallback = 'ST. LUKE’S SECONDARY SCHOOL') {
  return PAGE_KICKERS[slug] || fallback;
}

function str(value: unknown, fallback = '') {
  return String(value || fallback).trim();
}

const RELATED_BLURB: Record<string, string> = {
  '/about': 'Who we are, and why families choose St. Luke’s.',
  '/history': 'From a Holy Cross pre-nursery in 2006 to St. Luke’s School in 2010.',
  '/vision-mission': 'Knowledge, service and light in daily school life.',
  '/principal': 'A word from Fr. Bromith Bernard G. Sangma.',
  '/faculty': 'The teachers who walk with our students.',
  '/academics': 'Classes, curriculum and the school day.',
  '/curriculum': 'What our students learn at St. Luke’s.',
  '/examinations': 'How we assess honestly and fairly.',
  '/timetable': 'When the school day begins and ends.',
  '/notices': 'Dates and circulars from the school office.',
  '/student-life': 'Sports, academies and life beyond the classroom.',
  '/sports': 'Football, basketball, taekwondo and more.',
  '/facilities': 'Academies, classrooms, grounds and campus amenities.',
  '/gallery': 'Photographs from school life and celebrations.',
  '/events': 'Programmes and dates for the school family.',
  '/admissions': 'Begin the journey, mainly from Nursery.',
  '/apply': 'Submit an application when a cycle is open.',
  '/fees': 'Fee information from the school office.',
  '/contact': 'Find us at Walbakgre, Tura.',
  '/news': 'Stories published by the school.',
};

function relatedBlurb(href: string, label: string) {
  return RELATED_BLURB[href] || `Continue exploring ${label} at St. Luke’s.`;
}

export function SchoolPrideStrip({ motto, year }: { motto: string; year?: string }) {
  return (
    <div className="sls-pride">
      <div className="sls-wrap sls-pride-inner">
        <p className="sls-pride-motto">{motto.replace(/·/g, ' • ')}</p>
        <ul>
          <li>Nursery to Class XI</li>
          <li>Walbakgre, Tura</li>
          {year ? <li>Since {year}</li> : <li>A Catholic school family</li>}
        </ul>
      </div>
    </div>
  );
}

export function SchoolInteriorPage({
  kicker,
  title,
  lede,
  facts,
  slug,
  site,
  extrasJson,
  seoJson,
  crumbs,
  backgroundImage,
  host,
  children,
  showExplore = true,
}: {
  kicker: string;
  title: string;
  lede?: string;
  facts?: Array<{ value: string; label: string }>;
  slug: string;
  site: SchoolInteriorSite;
  extrasJson: Record<string, unknown>;
  seoJson?: unknown;
  crumbs?: SeoCrumb[];
  backgroundImage?: string;
  host?: string | null;
  children: ReactNode;
  showExplore?: boolean;
}) {
  const logo = str(extrasJson.logoUrl, '/school-sis/st-lukes-logo.png');
  const hours = str(extrasJson.officeHours, '9:00 a.m. to 2:30 p.m.');
  const motto = site.motto || 'Knowledge · Service · Light';
  const related = RELATED_LINKS[slug] ?? [];
  const address = [
    site.addressLine,
    site.city && !site.addressLine.includes(site.city) ? site.city : '',
  ]
    .filter(Boolean)
    .join(', ');
  const year = str(extrasJson.establishedYear, '2009');
  const quote = str(extrasJson.scriptureQuote, 'Let your light shine before others.');
  const quoteBy = str(extrasJson.scriptureAttribution, 'Matthew 5:16');
  const listing = ['notices', 'news', 'events', 'gallery', 'contact', 'apply'].includes(slug);
  const prideFacts = facts?.length
    ? facts
    : listing
      ? []
      : [
          { value: year, label: 'Founded at Walbakgre' },
          { value: '~800', label: 'Students in our family' },
          { value: 'XI', label: 'Higher Secondary from 2026' },
        ];
  const hero = resolvePageHero({
    slug,
    title,
    eyebrow: kicker,
    extrasJson,
    seoJson,
    backgroundImage,
  });

  return (
    <div className="sls-interior">
      {hero.enabled ? (
        <SchoolPageHero {...hero} breadcrumbs={crumbs} host={host} />
      ) : (
        <div className="sls-wrap">
          <header className="sls-about-hero">
            <div>
              <p className="sls-kicker sls-kicker-line">{kicker}</p>
              <h1>{title}</h1>
              {lede ? <p className="sls-about-hero-lede">{lede}</p> : null}
            </div>
            <figure className="sls-about-hero-mark">
              <img src={logo} alt={`Official emblem of ${site.displayName}`} />
              <figcaption>{motto}</figcaption>
            </figure>
          </header>
        </div>
      )}

      <SchoolPrideStrip motto={motto} year={year} />

      <div className="sls-wrap sls-interior-body">
        {prideFacts.length ? (
          <ul className="sls-about-facts">
            {prideFacts.map((fact) => (
              <li key={fact.label}>
                <strong>{fact.value}</strong>
                <span>{fact.label}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="sls-about-layout">
          <div className="sls-about-main">
            {children}
            {showExplore && related.length ? (
              <section className="sls-about-explore" aria-labelledby="sls-interior-explore">
                <p className="sls-kicker sls-kicker-line">KEEP EXPLORING</p>
                <h2 id="sls-interior-explore">More from school life</h2>
                <div className="sls-about-explore-grid">
                  {related.map((item) => (
                    <a
                      key={item.href}
                      className="sls-about-explore-card"
                      href={schoolWebPath(item.href, host)}
                    >
                      <strong>{item.label}</strong>
                      <span>{relatedBlurb(item.href, item.label)}</span>
                      <em>Open page →</em>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="sls-about-aside">
            <div className="sls-about-panel sls-about-panel-pride">
              <p className="sls-kicker">PROUD TO BE LUKE’S</p>
              <h2>A school family of nearly 800</h2>
              <p>
                Class XI opened in 2026. Our Taekwondo Academy is among the strongest in Garo Hills,
                and every child receives football coaching.
              </p>
              <blockquote>
                <p>“{quote}”</p>
                <cite>{quoteBy}</cite>
              </blockquote>
              <a className="sls-btn sls-btn-navy" href={schoolWebPath('/student-life', host)}>
                Explore student life
              </a>
            </div>
            <div className="sls-about-panel">
              <p className="sls-kicker">THE SCHOOL</p>
              <h2>{site.displayName}</h2>
              <p>{address || 'Walbakgre, Tura'}</p>
              <p>
                <strong>Office hours</strong>
                <br />
                {hours}
              </p>
              <a className="sls-btn sls-btn-navy" href={schoolWebPath('/contact', host)}>
                Visit & contact
              </a>
            </div>
            <div className="sls-about-panel sls-about-panel-gold">
              <p className="sls-kicker">ADMISSIONS</p>
              <h2>Begin at Nursery</h2>
              <p>
                New admissions are made mainly to Nursery. Other classes depend on vacant seats.
                Meet the office during school hours.
              </p>
              <a
                className="sls-btn sls-btn-gold"
                href={schoolWebPath(site.applyCtaUrl || '/apply', host)}
              >
                Apply Now
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function SchoolCmsBody({
  paragraphs,
  variant = 'auto',
}: {
  paragraphs: string[];
  variant?: 'auto' | 'rules' | 'prose';
}) {
  const titled = paragraphs.length >= 3 && paragraphs.every((p) => /^[^:]{2,56}:\s+\S/.test(p));
  if (titled) {
    return (
      <ul className="sls-point-cards">
        {paragraphs.map((p) => {
          const idx = p.indexOf(':');
          return (
            <li key={p}>
              <strong>{p.slice(0, idx)}</strong>
              <span>{p.slice(idx + 1).trim()}</span>
            </li>
          );
        })}
      </ul>
    );
  }
  const asRules =
    variant === 'rules' ||
    (variant === 'auto' &&
      paragraphs.length >= 3 &&
      paragraphs.length <= 10 &&
      paragraphs.every((p) => p.length < 320));
  if (asRules && variant !== 'prose') {
    return (
      <ol className="sls-rule-cards">
        {paragraphs.map((p, i) => (
          <li key={p}>
            <span aria-hidden>{String(i + 1).padStart(2, '0')}</span>
            <p>{p}</p>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="sls-prose sls-prose-wide">
      {paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}
