import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  FlaskConical,
  GraduationCap,
  HeartHandshake,
  Landmark,
  Trophy,
} from 'lucide-react';
import { AboutCollegeSection } from '@/components/about-college';
import { Gallery } from '@/components/interactive';
import { HeroSlider } from '@/components/hero-slider';
import { InformationHub } from '@/components/information-hub';
import { DepartmentsShowcase } from '@/components/departments-showcase';
import { NewsEventsSection } from '@/components/news-events-section';
import { PrincipalMessageSection } from '@/components/principal-message-section';
import { SisterInstitutions } from '@/components/sister-institutions';
import { StudentSupportSection } from '@/components/student-support-section';
import { ShortTermCoursesSection } from '@/components/short-term-courses-section';
import { VoicesOfBosco } from '@/components/voices-of-bosco';
import { WhyChooseUs } from '@/components/why-choose-us';
import { ImportantLinksSection } from '@/components/important-links';
import type { CollegeContent } from '@/lib/content';
import type { HomepageSectionPayload } from '@/lib/homepage';
import type { DepartmentCard } from '@/lib/academic-types';
import type { HeroSlide } from '@/lib/hero-slides';
import { absolutizeMediaUrl } from '@/lib/media-url';
import type { HubNotice, InformationHubContent } from '@/lib/information-hub';
import { isRecord } from '@/lib/cms-client';

type Props = {
  section: HomepageSectionPayload;
  content: CollegeContent;
  academicDepartments: DepartmentCard[];
  heroSlides: HeroSlide[];
  hub: InformationHubContent;
};

function heroFromPayload(payload: Record<string, unknown>, fallback: HeroSlide[]): HeroSlide[] {
  const slides = payload.slides;
  if (!Array.isArray(slides) || !slides.length) return fallback;
  const mapped: HeroSlide[] = [];
  for (const row of slides) {
    if (!isRecord(row) || typeof row.desktopSrc !== 'string') continue;
    const desktopSrc = absolutizeMediaUrl(row.desktopSrc);
    if (!desktopSrc) continue;
    const mobileSrc =
      typeof row.mobileSrc === 'string' ? absolutizeMediaUrl(row.mobileSrc) : undefined;
    mapped.push({
      id: typeof row.id === 'string' ? row.id : row.desktopSrc,
      desktopSrc,
      mobileSrc,
      alt: typeof row.alt === 'string' && row.alt.trim() ? row.alt : 'Campus',
    });
  }
  return mapped.length ? mapped : fallback;
}

function noticeBadgeFromRow(row: Record<string, unknown>): HubNotice['badge'] {
  if (row.priority === 'URGENT') return 'URGENT';
  if (typeof row.badge === 'string') {
    const badge = row.badge.toUpperCase();
    if (badge === 'URGENT' || badge === 'PDF' || badge === 'HOLIDAY' || badge === 'NEW') {
      return badge;
    }
  }
  const category = typeof row.category === 'string' ? row.category.toUpperCase() : '';
  if (category.includes('HOLIDAY')) return 'HOLIDAY';
  if (typeof row.attachmentUrl === 'string' && row.attachmentUrl.trim()) return 'PDF';
  if (category === 'URGENT') return 'URGENT';
  return 'NEW';
}

function noticesFromPayload(payload: Record<string, unknown>, fallback: HubNotice[]): HubNotice[] {
  const notices = payload.notices;
  // Empty CMS array is intentional — do not resurrect demo seed notices.
  if (Array.isArray(notices)) {
    const mapped: HubNotice[] = [];
    for (const row of notices) {
      if (!isRecord(row) || typeof row.id !== 'string' || typeof row.title !== 'string') continue;
      const badge = noticeBadgeFromRow(row);
      mapped.push({
        id: row.id,
        title: row.title,
        badge,
        publishedAt:
          typeof row.publishAt === 'string'
            ? row.publishAt.slice(0, 10)
            : typeof row.createdAt === 'string'
              ? row.createdAt.slice(0, 10)
              : new Date().toISOString().slice(0, 10),
        href: `/notices/${typeof row.slug === 'string' ? row.slug : row.id}`,
        attachmentHref: typeof row.attachmentUrl === 'string' ? row.attachmentUrl : undefined,
        urgent: row.priority === 'URGENT' || badge === 'URGENT',
      });
    }
    return mapped;
  }
  return fallback;
}

export function HomepageSectionRenderer({
  section,
  content,
  academicDepartments,
  heroSlides,
  hub,
}: Props) {
  switch (section.sectionKey) {
    case 'hero': {
      // Prefer dedicated hero-slides API (absolutized URLs); payload is secondary.
      const fromApi = heroSlides.filter((slide) => !slide.desktopSrc.startsWith('/images/campus-'));
      const slides = fromApi.length ? fromApi : heroFromPayload(section.payload, heroSlides);
      const hero = content.homepageCms.hero;
      const titleLines = hero.title.split('\n');
      return (
        <section className="hero">
          <HeroSlider slides={slides} />
          <div className="hero-overlay" />
          <div className="shell hero-content">
            <div className="hero-copy">
              <span className="eyebrow gold">{hero.eyebrow}</span>
              <h1>
                {titleLines.map((line, index) => (
                  <span key={line}>
                    {line}
                    {index < titleLines.length - 1 ? <br /> : null}
                  </span>
                ))}
              </h1>
              <p>{hero.subtitle}</p>
              <div className="hero-buttons">
                <Link className="button gold-button" href={hero.primaryCtaHref}>
                  {hero.primaryCtaLabel} <ArrowRight />
                </Link>
                <Link className="button outline" href={hero.secondaryCtaHref}>
                  {hero.secondaryCtaLabel}
                </Link>
              </div>
            </div>
          </div>
          <div className="hero-features shell">
            {(
              [
                [GraduationCap, 'Quality Education', 'Student-centred learning', 'blue'],
                [FlaskConical, 'Research', 'Inquiry that serves society', 'teal'],
                [BriefcaseBusiness, 'Placement', 'Career guidance and opportunity', 'violet'],
                [HeartHandshake, 'Character Formation', 'Integrity and compassion', 'orange'],
                [Landmark, 'Infrastructure', 'Spaces for growth', 'indigo'],
                [Trophy, 'Holistic Development', 'Mind, body and spirit', 'rose'],
              ] as const
            ).map(([Icon, title, copy, tone], index) => {
              const feature = hero.features[index];
              return (
                <div key={feature?.label ?? title}>
                  <span className={`feature-icon feature-icon-${tone}`}>
                    <Icon aria-hidden />
                  </span>
                  <p>
                    <strong>{feature?.label ?? title}</strong>
                    <small>{copy}</small>
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      );
    }
    case 'statistics':
      return (
        <section className="section shell" aria-label="Institution statistics">
          <div className="external-links">
            {content.stats.map((stat) => (
              <div key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </section>
      );
    case 'principalMessage':
      // Upcoming Events stays beside Principal only — never as a second full-width block.
      return (
        <section className="home-highlight" aria-label="Principal message and upcoming events">
          <div className="shell home-highlight-grid">
            <PrincipalMessageSection
              leadership={hub.leadership}
              highlights={content.homepageCms.principalHighlights}
            />
            <InformationHub hub={hub} mode="events" />
          </div>
        </section>
      );
    case 'upcomingEvents':
      // Legacy CMS slot: do not render. Events are part of principalMessage.
      return null;
    case 'noticeBoard': {
      const notices = noticesFromPayload(section.payload, hub.notices);
      return <InformationHub hub={{ ...hub, notices }} mode="notices" />;
    }
    case 'aboutCollege':
      // Announcements ticker is rendered once from the homepage shell (above About).
      return <AboutCollegeSection about={content.aboutCollege} />;
    case 'departments':
      return <DepartmentsShowcase departments={academicDepartments} />;
    case 'programmes':
      return (
        <section className="section shell">
          <div className="center-heading">
            <span className="eyebrow">Academics</span>
            <h2 className="display">Programmes</h2>
            <p>Explore undergraduate and postgraduate pathways.</p>
            <Link className="button gold-button" href="/academics/programmes">
              View programmes <ArrowRight />
            </Link>
          </div>
        </section>
      );
    case 'campusLife':
      return <WhyChooseUs content={content.homepageCms.whyChooseUs} />;
    case 'studentSupport':
      return <StudentSupportSection />;
    case 'shortTermCourses':
      return <ShortTermCoursesSection />;
    case 'testimonials':
      return <VoicesOfBosco items={content.testimonials} />;
    case 'gallery': {
      const life = content.homepageCms.lifeAtCampus;
      const images = (life.items?.length ? life.items : content.gallery).map((image) => ({
        src: absolutizeMediaUrl(image.src) || image.src,
        alt: image.alt,
        label: image.label,
      }));
      return (
        <section className="section shell" aria-labelledby="life-at-campus-heading">
          <div className="center-heading">
            <span className="eyebrow">{life.eyebrow || 'Life at Don Bosco'}</span>
            <h2 id="life-at-campus-heading" className="display">
              {life.title || 'A campus full of possibility'}
            </h2>
            {life.subtitle ? <p>{life.subtitle}</p> : null}
          </div>
          <Gallery images={images} />
        </section>
      );
    }
    case 'coatOfArms':
      return <HomepageCoatOfArms content={content.homepageCms.coatOfArms} />;
    case 'researchLinks':
      return <HomepageResearchAndLinks content={content.homepageCms.researchLinks} />;
    case 'placement':
      return <SisterInstitutions content={content.homepageCms.sisterInstitutions} />;
    case 'news':
      return <NewsEventsSection items={content.news} />;
    case 'footer':
      return null;
    default:
      return null;
  }
}

export function HomepageCoatOfArms({
  content,
}: {
  content?: { title: string; body: string; imageSrc: string; imageAlt: string };
} = {}) {
  const coat = {
    title: content?.title?.trim() || 'Coat of Arms',
    body:
      content?.body?.trim() ||
      'The Coat of Arms of the college contains the motto of the college, “In Pursuit of Excellence” and three distinct components – sun, eagle and mountains.',
    imageSrc:
      absolutizeMediaUrl(content?.imageSrc) || content?.imageSrc || '/images/coat-of-arms.png',
    imageAlt: content?.imageAlt?.trim() || 'Coat of Arms of Don Bosco College, Tura',
  };
  return (
    <section className="coat-of-arms" aria-labelledby="coat-of-arms-heading">
      <div className="shell coat-of-arms-grid">
        <div className="coat-of-arms-logo">
          <Image
            src={coat.imageSrc}
            alt={coat.imageAlt}
            width={120}
            height={130}
            priority={false}
            unoptimized={coat.imageSrc.startsWith('http') || coat.imageSrc.startsWith('/uploads/')}
          />
        </div>
        <div className="coat-of-arms-copy">
          <span className="eyebrow gold">Our identity</span>
          <h2 id="coat-of-arms-heading">{coat.title}</h2>
          <p>{coat.body}</p>
        </div>
      </div>
    </section>
  );
}

export function HomepageResearchAndLinks({
  content,
}: {
  content?: {
    title: string;
    subtitle: string;
    links: Array<{ label: string; href: string; description?: string }>;
  };
} = {}) {
  const research = content ?? {
    title: 'Research & important links',
    subtitle:
      'Explore our research cell, college journals Transient and Source, and quality initiatives.',
    links: [
      {
        label: 'Research Cell',
        href: '/research/cell',
        description: 'Faculty and student research',
      },
      {
        label: 'Transient',
        href: 'https://transient.donboscocollege.ac.in',
        description: 'College research journal',
      },
      {
        label: 'Source',
        href: 'https://source.donboscocollege.ac.in',
        description: 'College research journal',
      },
    ],
  };
  const featured = research.links.slice(0, 3);

  const renderCard = (link: { label: string; href: string; description?: string }) => {
    const inner = (
      <>
        <FlaskConical />
        <strong>{link.label}</strong>
        <span>{link.description ?? 'Learn more'} →</span>
      </>
    );
    if (link.href.startsWith('http')) {
      return (
        <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      );
    }
    return (
      <Link key={link.href} href={link.href}>
        {inner}
      </Link>
    );
  };

  return (
    <>
      <section className="section research">
        <div className="shell research-grid">
          <div>
            <span className="eyebrow gold">Research & innovation</span>
            <h2 className="display light">{research.title}</h2>
            <p>{research.subtitle}</p>
            <Link className="button gold-button" href="/research/cell">
              Explore research <ArrowRight />
            </Link>
          </div>
          <div className="research-cards">{featured.map(renderCard)}</div>
        </div>
      </section>
      <ImportantLinksSection />
    </>
  );
}
