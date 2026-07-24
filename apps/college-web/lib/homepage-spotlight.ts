import {
  PRINCIPAL_CARD_EXCERPT,
  PRINCIPAL_PORTRAIT_ALT,
  PRINCIPAL_PORTRAIT_SRC,
} from '@/lib/principal-message';
import { normalizePrincipalMessageHref } from '@/lib/information-hub';

export type SpotlightStat = { value: number; suffix?: string; label: string };
export type UpdateCard = { id: string; label: string; href: string };
export type UpcomingEvent = { id: string; title: string; date: string; href?: string };
export type HighlightCard = { id: string; title: string; href: string; icon?: string };
export type SuccessStory = {
  id: string;
  title: string;
  name: string;
  detail: string;
  href?: string;
};
export type CampusLifeCard = {
  id: string;
  title: string;
  href: string;
  image: string;
  alt: string;
};
export type QuickAccessItem = { id: string; label: string; href: string; icon?: string };
export type AccreditationBadge = { id: string; label: string; value: string };

export type LeadershipContent = {
  eyebrow: string;
  title: string;
  welcome: string;
  quote: string;
  name: string;
  role: string;
  tenure: string;
  portraitSrc: string;
  portraitAlt: string;
  messageHref: string;
  leadershipHref: string;
  prospectusHref: string;
  tourHref?: string;
  videoHref?: string;
};

export type NewsBadgeCategory =
  | 'Admissions'
  | 'Academics'
  | 'Research'
  | 'Sports'
  | 'Achievements'
  | 'Cultural'
  | 'IQAC'
  | 'NAAC'
  | 'Placements'
  | 'Events'
  | 'Campus'
  | 'Examination'
  | 'Service';

export type HomepageSpotlightContent = {
  leadership: LeadershipContent;
  updateCards: UpdateCard[];
  spotlightStats: SpotlightStat[];
  upcomingEvents: UpcomingEvent[];
  academicHighlights: HighlightCard[];
  studentSuccess: SuccessStory[];
  campusLife: CampusLifeCard[];
  quickAccess: QuickAccessItem[];
  accreditations: AccreditationBadge[];
};

export const newsBadgeStyles: Record<NewsBadgeCategory, { bg: string; color: string }> = {
  Admissions: { bg: '#dff3e4', color: '#1f7a3f' },
  Academics: { bg: '#e4efff', color: '#1f5fbf' },
  Research: { bg: '#f1e6ff', color: '#7a3eb1' },
  Sports: { bg: '#ffeedb', color: '#d97706' },
  Achievements: { bg: '#fff4cf', color: '#b7791f' },
  Cultural: { bg: '#ffe3ef', color: '#be185d' },
  IQAC: { bg: '#dff7f2', color: '#0f766e' },
  NAAC: { bg: '#e7ebff', color: '#4338ca' },
  Placements: { bg: '#e0f2fe', color: '#0369a1' },
  Events: { bg: '#fff7d6', color: '#a16207' },
  Campus: { bg: '#edf2f7', color: '#475569' },
  Examination: { bg: '#ede9fe', color: '#6d28d9' },
  Service: { bg: '#e0f7fa', color: '#0e7490' },
};

const img = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;

export const seedHomepageSpotlight: HomepageSpotlightContent = {
  leadership: {
    eyebrow: 'Message from the Principal',
    title: 'Welcome to Don Bosco College',
    welcome: PRINCIPAL_CARD_EXCERPT,
    quote: 'The roots of education are bitter, but the fruit is sweet.',
    name: 'Dr. Fr. Jogesh B. Sangma',
    role: 'Principal',
    tenure: 'Serving since 2018',
    portraitSrc: PRINCIPAL_PORTRAIT_SRC,
    portraitAlt: PRINCIPAL_PORTRAIT_ALT,
    messageHref: '/about/principal',
    leadershipHref: '/about/administration',
    prospectusHref: '/admission/prospectus',
    tourHref: '/about/history',
    videoHref: '/about/principal',
  },
  updateCards: [
    { id: 'admissions', label: 'Admission Open', href: '/admission/apply' },
    { id: 'seminar', label: 'Department Seminar', href: '/news' },
    { id: 'college-week', label: 'College Week', href: '/news/college-week-2026' },
    { id: 'holiday', label: 'Holiday Notice', href: '/news' },
    { id: 'exam', label: 'Exam Schedule', href: '/examination' },
  ],
  spotlightStats: [
    { value: 3100, suffix: '+', label: 'Students' },
    { value: 140, suffix: '+', label: 'Faculty' },
    { value: 35, suffix: '+', label: 'Departments' },
    { value: 39, suffix: '+', label: 'Years of Excellence' },
  ],
  upcomingEvents: [
    { id: 'orientation', title: 'Orientation Programme', date: '2026-07-28', href: '/news' },
    { id: 'freshers', title: 'Freshers Welcome', date: '2026-08-04', href: '/news' },
    { id: 'seminar', title: 'Department Seminar', date: '2026-08-12', href: '/news' },
    {
      id: 'sports',
      title: 'Inter-College Sports Meet',
      date: '2026-08-20',
      href: '/campus-life/sports',
    },
  ],
  academicHighlights: [
    { id: 'nep', title: 'NEP 2020', href: '/academics/programmes' },
    { id: 'cbcs', title: 'CBCS', href: '/academics/calendar' },
    { id: 'research', title: 'Research', href: '/research/cell' },
    { id: 'placement', title: 'Placement', href: '/placement' },
    { id: 'scholarships', title: 'Scholarships', href: '/admission/scholarships' },
    { id: 'innovation', title: 'Innovation', href: '/research/innovation' },
  ],
  studentSuccess: [
    {
      id: 'student-month',
      title: 'Student of the Month',
      name: 'R. Sangma',
      detail: 'Department of Commerce',
      href: '/students',
    },
    {
      id: 'top-rank',
      title: 'Top Rank Holder',
      name: 'A. Marak',
      detail: 'NEHU Semester Topper',
      href: '/students',
    },
    {
      id: 'placement',
      title: 'Placement Success',
      name: 'Batch 2025',
      detail: '92% placement record',
      href: '/placement',
    },
    {
      id: 'research',
      title: 'Research Achievement',
      name: 'Science Cell',
      detail: 'UGC minor research project',
      href: '/research/projects',
    },
    {
      id: 'sports',
      title: 'Sports Achievement',
      name: 'College Team',
      detail: 'State-level athletics medal',
      href: '/campus-life/sports',
    },
  ],
  campusLife: [
    {
      id: 'academics',
      title: 'Academics',
      href: '/academics/departments',
      image: img('photo-1434030216411-0b793f4b4173'),
      alt: 'Students in an academic session',
    },
    {
      id: 'research',
      title: 'Research',
      href: '/research/cell',
      image: img('photo-1532094349884-543bc11b234d'),
      alt: 'Laboratory research',
    },
    {
      id: 'library',
      title: 'Library',
      href: '/facilities/library',
      image: img('photo-1571260899304-425eee4c7efc'),
      alt: 'College library',
    },
    {
      id: 'sports',
      title: 'Sports',
      href: '/campus-life/sports',
      image: img('photo-1461896836934-ffe607ba8211'),
      alt: 'College sports',
    },
    {
      id: 'hostel',
      title: 'Hostel',
      href: '/facilities/hostel',
      image: img('photo-1555854877-bab0e564b8d5'),
      alt: 'Student hostel',
    },
    {
      id: 'labs',
      title: 'Laboratories',
      href: '/facilities/library',
      image: img('photo-1532094349884-543bc11b234d'),
      alt: 'Science laboratory',
    },
    {
      id: 'ncc',
      title: 'NCC',
      href: '/campus-life/nss-ncc',
      image: img('photo-1523580846011-d3a5bc25702b'),
      alt: 'NCC cadets',
    },
    {
      id: 'nss',
      title: 'NSS',
      href: '/campus-life/nss-ncc',
      image: img('photo-1559027615-cd4628902d4a'),
      alt: 'NSS volunteers',
    },
  ],
  quickAccess: [
    { id: 'admissions', label: 'Admissions', href: '/admission/apply' },
    { id: 'results', label: 'Results', href: '/examination' },
    { id: 'erp', label: 'ERP', href: '/erp' },
    { id: 'library', label: 'Library', href: '/facilities/library' },
    { id: 'calendar', label: 'Academic Calendar', href: '/academics/calendar' },
    { id: 'downloads', label: 'Downloads', href: '/downloads' },
  ],
  accreditations: [
    { id: 'naac', label: 'NAAC', value: 'B Grade' },
    { id: 'ugc', label: 'UGC', value: 'Recognised' },
    { id: 'nehu', label: 'NEHU', value: 'Affiliated' },
    { id: 'aishe', label: 'AISHE', value: 'Registered' },
  ],
};

export function normalizeNewsCategory(category: string): NewsBadgeCategory {
  const map: Record<string, NewsBadgeCategory> = {
    Campus: 'Campus',
    Admissions: 'Admissions',
    Examination: 'Examination',
    Service: 'Service',
    Academics: 'Academics',
    Research: 'Research',
    Sports: 'Sports',
    Achievements: 'Achievements',
    Cultural: 'Cultural',
    IQAC: 'IQAC',
    NAAC: 'NAAC',
    Placements: 'Placements',
    Events: 'Events',
  };
  return map[category] ?? 'Campus';
}

function isSpotlightStat(value: unknown): value is SpotlightStat {
  return isRecord(value) && typeof value.value === 'number' && typeof value.label === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readHomepageSpotlight(value: unknown): Partial<HomepageSpotlightContent> {
  if (!isRecord(value)) return {};
  let source = value;
  if (isRecord(source.spotlight)) source = source.spotlight;
  if (isRecord(source.homepageSpotlight)) source = source.homepageSpotlight;

  const leadership = isRecord(source.leadership) ? source.leadership : undefined;
  return {
    leadership:
      leadership && typeof leadership.title === 'string'
        ? {
            eyebrow:
              typeof leadership.eyebrow === 'string'
                ? leadership.eyebrow
                : seedHomepageSpotlight.leadership.eyebrow,
            title: leadership.title,
            welcome:
              typeof leadership.welcome === 'string'
                ? leadership.welcome
                : seedHomepageSpotlight.leadership.welcome,
            quote:
              typeof leadership.quote === 'string'
                ? leadership.quote
                : seedHomepageSpotlight.leadership.quote,
            name:
              typeof leadership.name === 'string'
                ? leadership.name
                : seedHomepageSpotlight.leadership.name,
            role:
              typeof leadership.role === 'string'
                ? leadership.role
                : seedHomepageSpotlight.leadership.role,
            tenure:
              typeof leadership.tenure === 'string'
                ? leadership.tenure
                : seedHomepageSpotlight.leadership.tenure,
            portraitSrc:
              typeof leadership.portraitSrc === 'string'
                ? leadership.portraitSrc
                : seedHomepageSpotlight.leadership.portraitSrc,
            portraitAlt:
              typeof leadership.portraitAlt === 'string'
                ? leadership.portraitAlt
                : seedHomepageSpotlight.leadership.portraitAlt,
            messageHref: normalizePrincipalMessageHref(leadership.messageHref),
            leadershipHref:
              typeof leadership.leadershipHref === 'string'
                ? leadership.leadershipHref
                : seedHomepageSpotlight.leadership.leadershipHref,
            prospectusHref:
              typeof leadership.prospectusHref === 'string'
                ? leadership.prospectusHref
                : seedHomepageSpotlight.leadership.prospectusHref,
            tourHref:
              typeof leadership.tourHref === 'string'
                ? leadership.tourHref
                : seedHomepageSpotlight.leadership.tourHref,
            videoHref:
              typeof leadership.videoHref === 'string'
                ? leadership.videoHref
                : seedHomepageSpotlight.leadership.videoHref,
          }
        : undefined,
    updateCards: Array.isArray(source.updateCards)
      ? (source.updateCards as UpdateCard[])
      : undefined,
    spotlightStats: Array.isArray(source.spotlightStats)
      ? source.spotlightStats.filter(isSpotlightStat)
      : undefined,
    upcomingEvents: Array.isArray(source.upcomingEvents)
      ? (source.upcomingEvents as UpcomingEvent[])
      : undefined,
    academicHighlights: Array.isArray(source.academicHighlights)
      ? (source.academicHighlights as HighlightCard[])
      : undefined,
    studentSuccess: Array.isArray(source.studentSuccess)
      ? (source.studentSuccess as SuccessStory[])
      : undefined,
    campusLife: Array.isArray(source.campusLife)
      ? (source.campusLife as CampusLifeCard[])
      : undefined,
    quickAccess: Array.isArray(source.quickAccess)
      ? (source.quickAccess as QuickAccessItem[])
      : undefined,
    accreditations: Array.isArray(source.accreditations)
      ? (source.accreditations as AccreditationBadge[])
      : undefined,
  };
}

export function mergeHomepageSpotlight(...values: unknown[]): HomepageSpotlightContent {
  const merged = values.reduce<Partial<HomepageSpotlightContent>>(
    (result, value) => ({ ...result, ...readHomepageSpotlight(value) }),
    {},
  );
  return {
    leadership: {
      ...(merged.leadership ?? seedHomepageSpotlight.leadership),
      messageHref: normalizePrincipalMessageHref(
        merged.leadership?.messageHref ?? seedHomepageSpotlight.leadership.messageHref,
      ),
    },
    updateCards: merged.updateCards?.length
      ? merged.updateCards
      : seedHomepageSpotlight.updateCards,
    spotlightStats: merged.spotlightStats?.length
      ? merged.spotlightStats
      : seedHomepageSpotlight.spotlightStats,
    upcomingEvents: merged.upcomingEvents?.length
      ? merged.upcomingEvents
      : seedHomepageSpotlight.upcomingEvents,
    academicHighlights: merged.academicHighlights?.length
      ? merged.academicHighlights
      : seedHomepageSpotlight.academicHighlights,
    studentSuccess: merged.studentSuccess?.length
      ? merged.studentSuccess
      : seedHomepageSpotlight.studentSuccess,
    campusLife: merged.campusLife?.length ? merged.campusLife : seedHomepageSpotlight.campusLife,
    quickAccess: merged.quickAccess?.length
      ? merged.quickAccess
      : seedHomepageSpotlight.quickAccess,
    accreditations: merged.accreditations?.length
      ? merged.accreditations
      : seedHomepageSpotlight.accreditations,
  };
}
