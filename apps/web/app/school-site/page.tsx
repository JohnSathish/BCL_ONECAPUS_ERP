import type { Metadata } from 'next';
import { SchoolHeroSlider, type HeroSlide } from '@/components/school-web/school-hero-slider';
import {
  aboutHighlights,
  SchoolAboutPrincipalSection,
} from '@/components/school-web/school-about-principal-section';
import { SchoolExploreSection } from '@/components/school-web/school-explore-section';
import { SchoolFlashNews } from '@/components/school-web/school-flash-news';
import { SchoolNewsEventsSection } from '@/components/school-web/school-news-events-section';
import { SchoolContactSection } from '@/components/school-web/school-contact-section';
import {
  extras,
  fetchSchoolWebBundle,
  fetchSchoolWebPage,
  pageParagraphs,
  schoolWebRequestHost,
  sectionPayload,
} from '@/lib/school-web/public';
import { asSeo, buildSchoolMetadata, schoolPublicOrigin, seoBag } from '@/lib/school-web/seo';

export async function generateMetadata(): Promise<Metadata> {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return {};
  const extrasJson = extras(bundle);
  const origin = schoolPublicOrigin(extrasJson, host);
  const logo = String(extrasJson.logoUrl || '/school-sis/st-lukes-logo.png');
  const homeSeo = asSeo(seoBag(extrasJson).home);
  return buildSchoolMetadata({
    origin,
    path: '/',
    siteName: bundle.site.displayName,
    title:
      homeSeo.title ||
      bundle.site.seoTitle ||
      "St. Luke's Secondary School, Tura | Official Website",
    description:
      homeSeo.description ||
      bundle.site.seoDescription ||
      "Official website of St. Luke's Secondary School, Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya. Academic information, admissions, notices, events and contact for the school office.",
    seo: homeSeo,
    logo,
    ogImage: String(homeSeo.ogImage || seoBag(extrasJson).defaultOgImage || logo),
    googleVerification: String(seoBag(extrasJson).googleSiteVerification || ''),
  });
}

export default async function SchoolSiteHomePage() {
  const [bundle, host] = await Promise.all([fetchSchoolWebBundle(), schoolWebRequestHost()]);
  if (!bundle) return null;
  const hero = sectionPayload(bundle, 'hero');
  const about = sectionPayload(bundle, 'about');
  const pillars = sectionPayload(bundle, 'pillars') as {
    items?: Array<{ n: string; title: string }>;
    footer?: string;
  };
  const explore = sectionPayload(bundle, 'explore');
  const campus = extras(bundle).campusImage as string | undefined;
  const slides = (
    (hero.slides as HeroSlide[] | undefined) ?? [
      {
        enabled: true,
        kicker: 'PARENTS’ DAY & SCHOOL DAY',
        title: bundle.site.displayName,
        text: String(hero.lede || ''),
        image: '/school-sis/slider/sl1.jpg',
        ctaLabel: 'Apply Now',
        ctaHref: bundle.site.applyCtaUrl || '/apply',
      },
      { enabled: true, image: '/school-sis/slider/sl2.jpg' },
      { enabled: true, image: '/school-sis/slider/sl3.jpg' },
      { enabled: true, image: '/school-sis/slider/sl4.jpg' },
      {
        enabled: true,
        image: '/school-sis/slider/sl5.jpg',
        title: 'St. Luke’s Secondary School, Walbakgre.',
      },
    ]
  ).filter((s) => s.enabled !== false);
  const principalPage = await fetchSchoolWebPage('principal');
  const principalParas = principalPage ? pageParagraphs(principalPage) : [];

  return (
    <>
      <SchoolHeroSlider
        slides={slides}
        fallbackImage={campus || '/school-sis/campus-hero.jpg'}
        schoolName={bundle.site.displayName}
        motto={bundle.site.motto}
        applyHref={bundle.site.applyCtaUrl || '/apply'}
        exploreHref="/about"
        quickLinks={[
          { href: '/admissions', label: 'Admissions', icon: 'admissions' },
          { href: '/academics', label: 'Academic Programmes', icon: 'academics' },
          { href: '/facilities', label: 'Facilities', icon: 'facilities' },
          { href: '/student-life', label: 'Student Life', icon: 'student-life' },
          { href: '/notices', label: 'Events & Activities', icon: 'events' },
          { href: '/gallery', label: 'Photo Gallery', icon: 'gallery' },
        ]}
      />
      {bundle.homepage.some((s) => s.key === 'flashNews') ? (
        <SchoolFlashNews payload={sectionPayload(bundle, 'flashNews')} />
      ) : null}
      {bundle.homepage.some((s) => s.key === 'about') ? (
        <SchoolAboutPrincipalSection
          about={about}
          extrasJson={extras(bundle)}
          motto={bundle.site.motto}
          displayName={bundle.site.displayName}
          paragraphs={principalParas}
          highlights={aboutHighlights(about, pillars)}
          host={host}
        />
      ) : null}
      {bundle.homepage.some((s) => s.key === 'explore') ? (
        <SchoolExploreSection payload={explore} motto={bundle.site.motto} host={host} />
      ) : null}
      {bundle.homepage.some((s) => s.key === 'notices') ? (
        <SchoolNewsEventsSection
          payload={sectionPayload(bundle, 'notices')}
          notices={bundle.notices}
          events={bundle.events}
          displayName={bundle.site.displayName}
          host={host}
        />
      ) : null}
      {bundle.homepage.some((s) => s.key === 'contact' && s.enabled !== false) ? (
        <SchoolContactSection
          payload={sectionPayload(bundle, 'contact')}
          site={bundle.site}
          extrasJson={extras(bundle)}
          host={host}
        />
      ) : null}
    </>
  );
}
