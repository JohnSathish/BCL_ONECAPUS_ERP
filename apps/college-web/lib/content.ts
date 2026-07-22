import 'server-only';

import { mergeAboutCollege, type AboutCollegeContent, seedAboutCollege } from '@/lib/about-college';
import { fetchCms, isRecord } from '@/lib/cms-client';
import {
  mergeHomepageSpotlight,
  type HomepageSpotlightContent,
  seedHomepageSpotlight,
} from '@/lib/homepage-spotlight';
import {
  mergeInformationHub,
  normalizePrincipalMessageHref,
  type InformationHubContent,
  seedInformationHub,
} from '@/lib/information-hub';
import { getPublicNews } from '@/lib/news';
import { getPublicNotices } from '@/lib/notices';
import {
  mergeHomepageCmsContent,
  seedHomepageCmsContent,
  type HomepageCmsContent,
} from '@/lib/homepage-cms-content';
import { PRINCIPAL_FULL_MESSAGE } from '@/lib/principal-message';
import { seedTestimonials, type Testimonial } from '@/lib/testimonials';

export type NewsItem = {
  slug: string;
  title: string;
  date: string;
  category: string;
  excerpt: string;
  image: string;
  body: string[];
};
export type CollegeContent = {
  stats: { value: string; label: string }[];
  news: NewsItem[];
  departments: { name: string; description: string; href: string }[];
  testimonials: Testimonial[];
  gallery: { src: string; alt: string; label: string }[];
  principalIntroduction: string;
  spotlight: HomepageSpotlightContent;
  informationHub: InformationHubContent;
  aboutCollege: AboutCollegeContent;
  homepageCms: HomepageCmsContent;
};

function normalizeTestimonials(value: unknown): Testimonial[] | undefined {
  if (!Array.isArray(value) || !value.length) return undefined;
  const rows: Testimonial[] = [];
  value.forEach((row, index) => {
    if (!isRecord(row) || typeof row.quote !== 'string' || typeof row.name !== 'string') return;
    const role = typeof row.role === 'string' ? row.role : '';
    const yearMatch = role.match(/Class of\s+(\d{4})/i);
    const department =
      typeof row.department === 'string'
        ? row.department
        : role.replace(/,?\s*Class of\s+\d{4}/i, '').trim() || 'Don Bosco College';
    rows.push({
      id: typeof row.id === 'string' ? row.id : `cms-${index}-${row.name}`,
      quote: row.quote,
      name: row.name,
      department,
      graduationYear:
        typeof row.graduationYear === 'number'
          ? row.graduationYear
          : yearMatch
            ? Number(yearMatch[1])
            : new Date().getFullYear(),
      status: typeof row.status === 'string' ? row.status : role || undefined,
      photoSrc: typeof row.photoSrc === 'string' ? row.photoSrc : null,
      photoAlt: typeof row.photoAlt === 'string' ? row.photoAlt : undefined,
      rating: typeof row.rating === 'number' ? row.rating : 5,
    });
  });
  return rows.length ? rows : undefined;
}
export type CmsPage = {
  title: string;
  excerpt?: string | null;
  bodyHtml?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string[];
  sections?: unknown[];
};

const img = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;

export const seedContent: CollegeContent = {
  stats: [
    { value: '2200+', label: 'Students' },
    { value: '140+', label: 'Faculty members' },
    { value: '35+', label: 'Departments' },
    { value: '39+', label: 'Years of excellence' },
  ],
  news: [
    {
      slug: 'college-week-2026',
      title: 'College Week 2026 – “In Pursuit of Excellence”',
      date: '2026-05-24',
      category: 'College Life',
      excerpt: 'A week of culture, sport and fellowship from 10–15 August 2026.',
      image: img('photo-1523580846011-d3a5bc25702b'),
      body: [
        'College Week brings together students across disciplines for cultural, literary and sporting events.',
        'The celebrations reflect our Salesian values of joyful learning, service and fellowship.',
      ],
    },
    {
      slug: 'admissions-open-2026',
      title: 'Online Admission for UG Programmes',
      date: '2026-05-20',
      category: 'Admissions',
      excerpt: 'Applications are open for the Academic Year 2026–27.',
      image: img('photo-1523240795612-9a054b0db644'),
      body: [
        'Prospective students can now submit applications for undergraduate programmes.',
        'Explore programme details and prepare the required documents before applying.',
      ],
    },
    {
      slug: 'internal-assessment',
      title: 'Internal Assessment Schedule for Even Semester',
      date: '2026-05-15',
      category: 'Academic',
      excerpt: 'The examination cell has published the latest assessment timetable.',
      image: img('photo-1434030216411-0b793f4b4173'),
      body: [
        'The examination cell has published the internal assessment schedule.',
        'Students should contact their departments for subject-specific guidance.',
      ],
    },
    {
      slug: 'community-outreach',
      title: 'Students Lead Community Outreach Drive',
      date: '2026-04-28',
      category: 'Service',
      excerpt: 'NSS volunteers worked with neighbourhood communities across Tura.',
      image: img('photo-1559027615-cd4628902d4a'),
      body: [
        'Volunteers conducted awareness sessions and community activities.',
        'The initiative strengthens the college commitment to socially responsible education.',
      ],
    },
    {
      slug: 'debate-championship',
      title: 'Bosco Debaters Win Inter-College Championship',
      date: '2026-04-12',
      category: 'Achievements',
      excerpt: 'Our team brought home the trophy after a closely contested final.',
      image: img('photo-1475721027785-f74eccf877e2'),
      body: [
        'Students represented the college with clarity, confidence and conviction.',
        'The win affirms our commitment to communication and critical thinking.',
      ],
    },
    {
      slug: 'ecology-field-visit',
      title: 'Ecology Students Visit Community Conservation Site',
      date: '2026-03-30',
      category: 'Field Visit',
      excerpt: 'A learning journey connecting classroom science with local ecosystems.',
      image: img('photo-1441974231531-c6227db76b6e'),
      body: [
        'Students observed conservation practices and interacted with local facilitators.',
        'Field learning remains central to our academic experience.',
      ],
    },
  ],
  departments: [
    ['Education', 'Prepare reflective educators who transform communities.'],
    ['Computer Science', 'Build practical digital skills for a connected world.'],
    ['Economics', 'Understand markets, policy and sustainable development.'],
    ['History', 'Study the past to engage thoughtfully with the present.'],
    ['Political Science', 'Examine governance, citizenship and public life.'],
  ].map(([name, description]) => ({
    name,
    description,
    href: `/academics/departments/${name.toLowerCase().replaceAll(' ', '-')}`,
  })),
  testimonials: seedTestimonials,
  gallery: [
    {
      src: img('photo-1523580846011-d3a5bc25702b'),
      alt: 'NCC cadets participating in a college programme',
      label: 'NCC',
    },
    {
      src: img('photo-1559027615-cd4628902d4a'),
      alt: 'NSS student volunteers serving the community',
      label: 'NSS',
    },
    {
      src: img('photo-1461896836934-ffe607ba8211'),
      alt: 'Students participating in college sports',
      label: 'Sports',
    },
    {
      src: img('photo-1529390079861-591de354faf5'),
      alt: 'Students performing during a cultural event',
      label: 'Cultural Events',
    },
    {
      src: img('photo-1532094349884-543bc11b234d'),
      alt: 'Students learning in a science laboratory',
      label: 'Labs',
    },
    {
      src: img('photo-1571260899304-425eee4c7efc'),
      alt: 'Students studying in the college library',
      label: 'Library',
    },
    {
      src: img('photo-1555854877-bab0e564b8d5'),
      alt: 'Comfortable student hostel facilities',
      label: 'Hostel',
    },
  ],
  principalIntroduction: PRINCIPAL_FULL_MESSAGE,
  spotlight: seedHomepageSpotlight,
  informationHub: seedInformationHub,
  aboutCollege: seedAboutCollege,
  homepageCms: seedHomepageCmsContent,
};

function readContentCandidate(value: unknown): Partial<CollegeContent> {
  if (!isRecord(value)) return {};
  let source = value;
  if (isRecord(source.settings)) source = source.settings;
  if (isRecord(source.content)) source = source.content;
  return {
    stats: Array.isArray(source.stats) ? (source.stats as CollegeContent['stats']) : undefined,
    news: Array.isArray(source.news) ? (source.news as NewsItem[]) : undefined,
    departments: Array.isArray(source.departments)
      ? (source.departments as CollegeContent['departments'])
      : undefined,
    testimonials: normalizeTestimonials(source.testimonials),
    gallery: Array.isArray(source.gallery)
      ? (source.gallery as CollegeContent['gallery'])
      : undefined,
    principalIntroduction:
      typeof source.principalIntroduction === 'string' ? source.principalIntroduction : undefined,
  };
}

function mergeCandidates(...values: unknown[]): Partial<CollegeContent> {
  return values.reduce<Partial<CollegeContent>>(
    (result, value) => ({ ...result, ...readContentCandidate(value) }),
    {},
  );
}

export async function getCollegeContent(): Promise<CollegeContent> {
  // Soft-merge: site / optional home page / news / notices independently.
  // A missing page?path=/ must not discard site settings or notices.
  const [site, home, homepage, cmsNews, cmsNotices] = await Promise.all([
    fetchCms('site', {}, 60),
    fetchCms('page', { path: '/' }, 120),
    fetchCms('homepage', {}, 60),
    getPublicNews(),
    getPublicNotices(),
  ]);
  const siteRecord = isRecord(site) ? site : {};
  const homeRecord = isRecord(home) ? home : {};
  const homepageRecord = isRecord(homepage) ? homepage : {};
  const settings = isRecord(siteRecord.settingsJson) ? siteRecord.settingsJson : {};
  const homepageSettings = isRecord(homepageRecord.settings) ? homepageRecord.settings : {};
  const homepageContent = isRecord(homepageRecord.content) ? homepageRecord.content : {};
  const sections = Array.isArray(homeRecord.sections) ? homeRecord.sections : [];
  const homepageSections = Array.isArray(homepageRecord.sections) ? homepageRecord.sections : [];
  const entries = Array.isArray(settings.contentEntries) ? settings.contentEntries : [];
  const data = mergeCandidates(
    settings,
    homepageSettings,
    homepageContent,
    ...sections,
    ...homepageSections,
    ...entries,
  );
  const hubBase = mergeInformationHub(
    settings,
    homepageSettings,
    homepageContent,
    ...sections,
    ...homepageSections,
    ...entries,
    {
      spotlight: mergeHomepageSpotlight(
        settings,
        homepageSettings,
        homepageContent,
        ...sections,
        ...homepageSections,
        ...entries,
      ),
    },
  );
  // Prefer homepage.content.principal for leadership when present
  if (isRecord(homepageContent.principal)) {
    const principal = homepageContent.principal;
    hubBase.leadership = {
      ...hubBase.leadership,
      message:
        typeof principal.message === 'string' ? principal.message : hubBase.leadership.message,
      name: typeof principal.name === 'string' ? principal.name : hubBase.leadership.name,
      role: typeof principal.role === 'string' ? principal.role : hubBase.leadership.role,
      tenure: typeof principal.tenure === 'string' ? principal.tenure : hubBase.leadership.tenure,
      portraitSrc:
        typeof principal.portraitSrc === 'string' && principal.portraitSrc.startsWith('/')
          ? principal.portraitSrc
          : hubBase.leadership.portraitSrc,
      portraitAlt:
        typeof principal.portraitAlt === 'string'
          ? principal.portraitAlt
          : hubBase.leadership.portraitAlt,
      messageHref: normalizePrincipalMessageHref(
        typeof principal.messageHref === 'string'
          ? principal.messageHref
          : hubBase.leadership.messageHref,
      ),
      leadershipHref:
        typeof principal.leadershipHref === 'string'
          ? principal.leadershipHref
          : hubBase.leadership.leadershipHref,
    };
  }
  hubBase.leadership.messageHref = normalizePrincipalMessageHref(hubBase.leadership.messageHref);
  return {
    stats: data.stats?.length ? data.stats : seedContent.stats,
    news: cmsNews.length ? cmsNews : data.news?.length ? data.news : seedContent.news,
    departments: data.departments?.length ? data.departments : seedContent.departments,
    testimonials: data.testimonials?.length ? data.testimonials : seedContent.testimonials,
    gallery: data.gallery?.length ? data.gallery : seedContent.gallery,
    principalIntroduction: data.principalIntroduction || seedContent.principalIntroduction,
    spotlight: mergeHomepageSpotlight(
      settings,
      homepageSettings,
      homepageContent,
      ...sections,
      ...homepageSections,
      ...entries,
    ),
    informationHub: {
      ...hubBase,
      notices: cmsNotices.length ? cmsNotices : hubBase.notices,
    },
    aboutCollege: mergeAboutCollege(
      settings,
      homepageSettings,
      homepageContent,
      isRecord(homepageContent.aboutCollege) ? { aboutCollege: homepageContent.aboutCollege } : {},
      ...sections,
      ...homepageSections,
      ...entries,
    ),
    homepageCms: mergeHomepageCmsContent(
      settings,
      homepageSettings,
      // Canonical resolved payload from GET /homepage — must win over raw settings.
      homepageContent,
    ),
  };
}

export async function getCmsPage(path: string): Promise<CmsPage | null> {
  const value = await fetchCms('page', { path });
  if (!isRecord(value) || typeof value.title !== 'string') return null;
  return {
    title: value.title,
    excerpt: typeof value.excerpt === 'string' ? value.excerpt : null,
    bodyHtml: typeof value.bodyHtml === 'string' ? value.bodyHtml : null,
    seoTitle: typeof value.seoTitle === 'string' ? value.seoTitle : null,
    seoDescription: typeof value.seoDescription === 'string' ? value.seoDescription : null,
    seoKeywords: Array.isArray(value.seoKeywords)
      ? value.seoKeywords.filter((item): item is string => typeof item === 'string')
      : [],
    sections: Array.isArray(value.sections) ? value.sections : [],
  };
}

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://donboscocollege.ac.in';
