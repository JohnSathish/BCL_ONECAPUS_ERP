import type { CSSProperties } from 'react';
import { SchoolBreadcrumbs } from '@/components/school-web/school-breadcrumbs';
import type { SeoCrumb } from '@/lib/school-web/seo';

export type SchoolPageHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  backgroundImage?: string;
  breadcrumbs?: SeoCrumb[];
  overlay?: number;
  decorativeText?: string;
  alignment?: 'left' | 'center';
  imagePosition?: string;
  enabled?: boolean;
  showBreadcrumbs?: boolean;
  host?: string | null;
  priority?: boolean;
};

export type SchoolPageHeroConfig = {
  enabled?: boolean;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  backgroundImage?: string;
  decorativeText?: string;
  overlay?: number;
  alignment?: 'left' | 'center';
  imagePosition?: string;
  showBreadcrumbs?: boolean;
};

const DEFAULT_DECORATIVE = 'Education for a Better Tomorrow';

function isCrestFile(src?: string) {
  const s = (src || '').toLowerCase();
  return !src || s.includes('logo') || s.includes('campus-hero');
}

function usablePhoto(...candidates: Array<string | undefined>) {
  return candidates.find((src) => src && !isCrestFile(src));
}

export const PAGE_HERO_COPY: Record<string, { eyebrow: string; subtitle: string }> = {
  about: { eyebrow: 'ABOUT OUR SCHOOL', subtitle: 'Discover our history, values and vision.' },
  history: {
    eyebrow: 'OUR STORY',
    subtitle: 'From a Walbakgre pre-nursery in 2006 to Class XI in 2026.',
  },
  'vision-mission': {
    eyebrow: 'VISION & MISSION',
    subtitle: 'Knowledge · Service · Light in daily school life.',
  },
  principal: { eyebrow: 'OUR LEADERSHIP', subtitle: 'Guiding today, for a brighter tomorrow.' },
  administration: { eyebrow: 'OUR LEADERSHIP', subtitle: 'The people who steward St. Luke’s.' },
  faculty: {
    eyebrow: 'OUR LEADERSHIP',
    subtitle: 'Teachers and staff who walk with our students.',
  },
  rules: {
    eyebrow: 'SCHOOL LIFE',
    subtitle: 'Expectations that keep our campus safe and respectful.',
  },
  academics: {
    eyebrow: 'ACADEMICS',
    subtitle: 'Building strong foundations for lifelong learning.',
  },
  curriculum: { eyebrow: 'ACADEMICS', subtitle: 'What our students learn at St. Luke’s.' },
  examinations: { eyebrow: 'ACADEMICS', subtitle: 'Assessment, results and examination rules.' },
  timetable: { eyebrow: 'ACADEMICS', subtitle: 'The school day, as published by the office.' },
  admissions: {
    eyebrow: 'ADMISSIONS',
    subtitle: 'Begin the journey at St. Luke’s, mainly from Nursery.',
  },
  fees: { eyebrow: 'ADMISSIONS', subtitle: 'Fee information as recorded by the school office.' },
  apply: { eyebrow: 'ADMISSIONS', subtitle: 'Submit an application when a cycle is open.' },
  'student-life': {
    eyebrow: 'STUDENT LIFE',
    subtitle: 'Sports, culture and growth beyond the classroom.',
  },
  sports: { eyebrow: 'STUDENT LIFE', subtitle: 'Football, basketball, taekwondo and more.' },
  facilities: {
    eyebrow: 'FACILITIES',
    subtitle: 'Academies, classrooms, grounds and campus amenities.',
  },
  'campus-life': { eyebrow: 'CAMPUS', subtitle: 'Moments from life at Walbakgre.' },
  'parent-corner': { eyebrow: 'FAMILIES', subtitle: 'How parents and the school walk together.' },
  faq: { eyebrow: 'GUIDANCE', subtitle: 'Answers families often ask the school office.' },
  contact: { eyebrow: 'VISIT', subtitle: 'Find us at Walbakgre, P.O. Dakopgre, Tura.' },
  notices: {
    eyebrow: 'NEWS & NOTICES',
    subtitle: 'Official announcements from the school office.',
  },
  news: { eyebrow: 'NEWS', subtitle: 'Stories and updates published by the school.' },
  events: { eyebrow: 'EVENTS', subtitle: 'Programmes and dates for the school family.' },
  gallery: { eyebrow: 'GALLERY', subtitle: 'Photographs from school life and celebrations.' },
};

function asHero(value: unknown): SchoolPageHeroConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const overlay = Number(row.overlay);
  return {
    enabled: row.enabled !== false && row.enabled !== 'false',
    eyebrow: String(row.eyebrow || '').trim() || undefined,
    title: String(row.title || '').trim() || undefined,
    subtitle: String(row.subtitle || row.lede || '').trim() || undefined,
    backgroundImage: String(row.backgroundImage || row.image || '').trim() || undefined,
    decorativeText: String(row.decorativeText || '').trim() || undefined,
    overlay: Number.isFinite(overlay) ? overlay : undefined,
    alignment:
      row.alignment === 'center' ? 'center' : row.alignment === 'left' ? 'left' : undefined,
    imagePosition: String(row.imagePosition || '').trim() || undefined,
    showBreadcrumbs: row.showBreadcrumbs !== false && row.showBreadcrumbs !== 'false',
  };
}

export function resolvePageHero(input: {
  slug: string;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  backgroundImage?: string;
  seoJson?: unknown;
  extrasJson?: Record<string, unknown>;
}): SchoolPageHeroProps & { enabled: boolean; showBreadcrumbs: boolean } {
  const seo =
    input.seoJson && typeof input.seoJson === 'object'
      ? (input.seoJson as Record<string, unknown>)
      : {};
  const fromPage = asHero(seo.hero);
  const fromBag =
    input.extrasJson?.innerHeroes && typeof input.extrasJson.innerHeroes === 'object'
      ? asHero((input.extrasJson.innerHeroes as Record<string, unknown>)[input.slug])
      : {};
  const site = asHero(input.extrasJson?.innerHero);
  const copy = PAGE_HERO_COPY[input.slug];
  const overlay = fromPage.overlay ?? fromBag.overlay ?? site.overlay ?? 0.58;
  const campus = String(input.extrasJson?.campusImage || '').trim();
  return {
    enabled: fromPage.enabled !== false && fromBag.enabled !== false && site.enabled !== false,
    eyebrow:
      fromPage.eyebrow ||
      fromBag.eyebrow ||
      copy?.eyebrow ||
      input.eyebrow ||
      'ST. LUKE’S SECONDARY SCHOOL',
    title: fromPage.title || fromBag.title || input.title,
    subtitle: fromPage.subtitle || fromBag.subtitle || input.subtitle || copy?.subtitle,
    backgroundImage: usablePhoto(
      fromPage.backgroundImage,
      fromBag.backgroundImage,
      input.backgroundImage,
      site.backgroundImage,
      campus,
    ),
    decorativeText:
      fromPage.decorativeText ||
      fromBag.decorativeText ||
      site.decorativeText ||
      DEFAULT_DECORATIVE,
    overlay,
    alignment: fromPage.alignment || fromBag.alignment || site.alignment || 'left',
    imagePosition:
      fromPage.imagePosition || fromBag.imagePosition || site.imagePosition || 'center',
    showBreadcrumbs: fromPage.showBreadcrumbs !== false,
  };
}

export function SchoolPageHero({
  eyebrow,
  title,
  subtitle,
  backgroundImage,
  breadcrumbs,
  overlay = 0.58,
  decorativeText,
  alignment = 'left',
  imagePosition = 'center',
  enabled = true,
  showBreadcrumbs = true,
  host,
  priority = true,
}: SchoolPageHeroProps) {
  if (enabled === false) return null;
  const photo = usablePhoto(backgroundImage);
  const strength = Math.min(0.85, Math.max(0.25, overlay));
  const overlayStyle: CSSProperties = photo
    ? {
        background: `linear-gradient(90deg, rgba(15, 39, 72, ${0.88 * strength}) 0%, rgba(15, 39, 72, ${0.55 * strength}) 42%, rgba(15, 39, 72, ${0.22 * strength}) 72%, rgba(15, 39, 72, 0.1) 100%)`,
      }
    : {
        background:
          'linear-gradient(90deg, rgba(15, 39, 72, 0.35) 0%, rgba(15, 39, 72, 0.12) 70%, rgba(15, 39, 72, 0.04) 100%)',
      };
  return (
    <header
      className={`sls-page-hero${alignment === 'center' ? ' sls-page-hero--center' : ''}${photo ? '' : ' sls-page-hero--fallback'}`}
    >
      <div className="sls-page-hero-media">
        {photo ? (
          <img
            className="sls-page-hero-img"
            src={photo}
            alt=""
            aria-hidden
            width={1920}
            height={640}
            decoding="async"
            fetchPriority={priority ? 'high' : 'low'}
            sizes="100vw"
            style={{ objectPosition: imagePosition }}
          />
        ) : null}
        <div className="sls-page-hero-overlay" style={overlayStyle} aria-hidden />
        <div className="sls-wrap sls-page-hero-inner">
          {eyebrow ? <p className="sls-page-hero-eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {subtitle ? <p className="sls-page-hero-sub">{subtitle}</p> : null}
        </div>
        {decorativeText ? (
          <p className="sls-page-hero-deco" aria-hidden>
            {decorativeText}
          </p>
        ) : null}
      </div>
      {showBreadcrumbs && breadcrumbs?.length ? (
        <div className="sls-page-hero-crumbs">
          <div className="sls-wrap">
            <SchoolBreadcrumbs items={breadcrumbs} host={host} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
