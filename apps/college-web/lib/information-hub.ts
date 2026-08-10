import {
  PRINCIPAL_CARD_EXCERPT,
  PRINCIPAL_PORTRAIT_ALT,
  PRINCIPAL_PORTRAIT_SRC,
} from '@/lib/principal-message';

export type HubLeadership = {
  message: string;
  name: string;
  role: string;
  tenure: string;
  portraitSrc: string;
  portraitAlt: string;
  messageHref: string;
  leadershipHref: string;
};

export type HubEventCategory =
  | 'Academic'
  | 'Cultural'
  | 'Sports'
  | 'Holiday'
  | 'Orientation'
  | 'Seminar';

export type HubEvent = {
  id: string;
  title: string;
  date: string;
  category: HubEventCategory;
  href?: string;
  registrationHref?: string;
};

export type HubNoticeBadge =
  | 'NEW'
  | 'PDF'
  | 'IMPORTANT'
  | 'HOLIDAY'
  | 'CIRCULAR'
  | 'SCHOLARSHIP'
  | 'TENDER'
  | 'EXAM';

export type HubNotice = {
  id: string;
  title: string;
  badge: HubNoticeBadge | 'URGENT';
  publishedAt: string;
  href?: string;
  attachmentHref?: string;
  attachments?: Array<{ url: string; name: string }>;
  urgent?: boolean;
};

export type InformationHubContent = {
  leadership: HubLeadership;
  upcomingEvents: HubEvent[];
  notices: HubNotice[];
  calendarHref: string;
  noticesHref: string;
};

export const eventCategoryStyles: Record<HubEventCategory, { bg: string; color: string }> = {
  Academic: { bg: '#e4efff', color: '#1f5fbf' },
  Cultural: { bg: '#ffe3ef', color: '#be185d' },
  Sports: { bg: '#ffeedb', color: '#d97706' },
  Holiday: { bg: '#dff7f2', color: '#0f766e' },
  Orientation: { bg: '#fff4cf', color: '#b7791f' },
  Seminar: { bg: '#f1e6ff', color: '#7a3eb1' },
};

/** Map ERP calendar `type` / CMS labels onto hub badge categories. */
export function normalizeEventCategory(category: string | null | undefined): HubEventCategory {
  const raw = (category ?? '').trim();
  if (!raw) return 'Academic';

  const direct = raw as HubEventCategory;
  if (direct in eventCategoryStyles) return direct;

  const key = raw.toUpperCase().replace(/[\s_-]+/g, '_');
  const map: Record<string, HubEventCategory> = {
    ACADEMIC: 'Academic',
    CULTURAL: 'Cultural',
    SPORTS: 'Sports',
    HOLIDAY: 'Holiday',
    PUBLIC_HOLIDAY: 'Holiday',
    RESTRICTED_HOLIDAY: 'Holiday',
    OPTIONAL_HOLIDAY: 'Holiday',
    ORIENTATION: 'Orientation',
    SEMINAR: 'Seminar',
    WORKSHOP: 'Seminar',
    EXAM: 'Academic',
    EXAMINATION: 'Academic',
    RESULT: 'Academic',
    ADMISSION: 'Academic',
    MEETING: 'Academic',
    EVENT: 'Academic',
    GENERAL: 'Academic',
    WORKING: 'Academic',
    WORKING_DAY: 'Academic',
  };
  return map[key] ?? 'Academic';
}

export const noticeBadgeStyles: Record<HubNoticeBadge | 'URGENT', { bg: string; color: string }> = {
  NEW: { bg: '#dff3e4', color: '#1f7a3f' },
  PDF: { bg: '#e4efff', color: '#1f5fbf' },
  IMPORTANT: { bg: '#ffe8e8', color: '#c53030' },
  HOLIDAY: { bg: '#dff7f2', color: '#0f766e' },
  CIRCULAR: { bg: '#f1e6ff', color: '#7a3eb1' },
  SCHOLARSHIP: { bg: '#fff4cf', color: '#b7791f' },
  TENDER: { bg: '#edf2f7', color: '#475569' },
  EXAM: { bg: '#ede9fe', color: '#6d28d9' },
  URGENT: { bg: '#fee2e2', color: '#b91c1c' },
};

export const seedInformationHub: InformationHubContent = {
  leadership: {
    message: PRINCIPAL_CARD_EXCERPT,
    name: 'Dr. Fr. Jogesh B. Sangma',
    role: 'Principal',
    tenure: 'Serving since 2018',
    portraitSrc: PRINCIPAL_PORTRAIT_SRC,
    portraitAlt: PRINCIPAL_PORTRAIT_ALT,
    messageHref: '/about/principal',
    leadershipHref: '/about/administration',
  },
  upcomingEvents: [
    {
      id: 'orientation',
      title: 'Orientation Programme',
      date: '2026-07-28',
      category: 'Orientation',
      href: '/academics/calendar',
    },
    {
      id: 'freshers',
      title: "Freshers' Welcome",
      date: '2026-08-04',
      category: 'Cultural',
      href: '/campus-life/clubs',
    },
    {
      id: 'seminar',
      title: 'Department Seminar',
      date: '2026-08-12',
      category: 'Seminar',
      href: '/academics/calendar',
    },
    {
      id: 'sports',
      title: 'Inter-College Sports Meet',
      date: '2026-08-20',
      category: 'Sports',
      href: '/campus-life/sports',
    },
    {
      id: 'independence',
      title: 'Independence Day Celebration',
      date: '2026-08-15',
      category: 'Holiday',
      href: '/news',
    },
  ],
  notices: [
    {
      id: 'admission',
      title: 'UG Admission 2026 Open',
      badge: 'NEW',
      publishedAt: new Date().toISOString().slice(0, 10),
      href: '/admission/apply',
    },
    {
      id: 'assessment',
      title: 'Internal Assessment Schedule',
      badge: 'PDF',
      publishedAt: '2026-05-15',
      href: '/examination',
      attachmentHref: '/downloads',
    },
    {
      id: 'registration',
      title: 'Semester Registration Last Date',
      badge: 'IMPORTANT',
      publishedAt: '2026-05-12',
      href: '/notices',
      urgent: true,
    },
    {
      id: 'holiday',
      title: 'Independence Day Holiday',
      badge: 'HOLIDAY',
      publishedAt: '2026-05-10',
      href: '/notices',
    },
    {
      id: 'iqac',
      title: 'IQAC Meeting Notice',
      badge: 'CIRCULAR',
      publishedAt: '2026-05-08',
      href: '/iqac',
    },
  ],
  calendarHref: '/academics/calendar',
  noticesHref: '/notices',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Prefer a same-origin path; blank/invalid CMS values fall back to Principal desk. */
export function normalizePrincipalMessageHref(
  value: unknown,
  fallback = '/about/principal',
): string {
  if (typeof value !== 'string') return fallback;
  const href = value.trim();
  if (
    !href ||
    href === '#' ||
    href.toLowerCase() === 'null' ||
    href.toLowerCase() === 'undefined'
  ) {
    return fallback;
  }
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const url = new URL(href);
    if (url.protocol === 'http:' || url.protocol === 'https:') return href;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function readInformationHub(value: unknown): Partial<InformationHubContent> {
  if (!isRecord(value)) return {};
  let source = value;
  if (isRecord(source.informationHub)) source = source.informationHub;
  if (isRecord(source.hub)) source = source.hub;

  const leadership = isRecord(source.leadership) ? source.leadership : undefined;
  return {
    leadership:
      leadership && typeof leadership.message === 'string'
        ? {
            message: leadership.message,
            name:
              typeof leadership.name === 'string'
                ? leadership.name
                : seedInformationHub.leadership.name,
            role:
              typeof leadership.role === 'string'
                ? leadership.role
                : seedInformationHub.leadership.role,
            tenure:
              typeof leadership.tenure === 'string'
                ? leadership.tenure
                : seedInformationHub.leadership.tenure,
            portraitSrc:
              typeof leadership.portraitSrc === 'string'
                ? leadership.portraitSrc
                : seedInformationHub.leadership.portraitSrc,
            portraitAlt:
              typeof leadership.portraitAlt === 'string'
                ? leadership.portraitAlt
                : seedInformationHub.leadership.portraitAlt,
            messageHref: normalizePrincipalMessageHref(leadership.messageHref),
            leadershipHref:
              typeof leadership.leadershipHref === 'string'
                ? leadership.leadershipHref
                : seedInformationHub.leadership.leadershipHref,
          }
        : undefined,
    upcomingEvents: Array.isArray(source.upcomingEvents)
      ? (source.upcomingEvents as HubEvent[])
      : undefined,
    notices: Array.isArray(source.notices) ? (source.notices as HubNotice[]) : undefined,
    calendarHref: typeof source.calendarHref === 'string' ? source.calendarHref : undefined,
    noticesHref: typeof source.noticesHref === 'string' ? source.noticesHref : undefined,
  };
}

export function mergeInformationHub(...values: unknown[]): InformationHubContent {
  const merged = values.reduce<Partial<InformationHubContent>>(
    (result, value) => ({ ...result, ...readInformationHub(value) }),
    {},
  );

  // Fallback: map older spotlight.leadership shape if present
  for (const value of values) {
    if (!isRecord(value)) continue;
    const spotlight = isRecord(value.spotlight) ? value.spotlight : value;
    const leadership = isRecord(spotlight.leadership) ? spotlight.leadership : null;
    if (!merged.leadership && leadership && typeof leadership.quote === 'string') {
      merged.leadership = {
        message:
          typeof leadership.welcome === 'string'
            ? `${leadership.welcome} ${leadership.quote}`
            : leadership.quote,
        name:
          typeof leadership.name === 'string'
            ? leadership.name
            : seedInformationHub.leadership.name,
        role:
          typeof leadership.role === 'string'
            ? leadership.role
            : seedInformationHub.leadership.role,
        tenure:
          typeof leadership.tenure === 'string'
            ? leadership.tenure
            : seedInformationHub.leadership.tenure,
        portraitSrc:
          typeof leadership.portraitSrc === 'string'
            ? leadership.portraitSrc
            : seedInformationHub.leadership.portraitSrc,
        portraitAlt:
          typeof leadership.portraitAlt === 'string'
            ? leadership.portraitAlt
            : seedInformationHub.leadership.portraitAlt,
        messageHref: normalizePrincipalMessageHref(leadership.messageHref),
        leadershipHref:
          typeof leadership.leadershipHref === 'string'
            ? leadership.leadershipHref
            : seedInformationHub.leadership.leadershipHref,
      };
    }
    if (!merged.upcomingEvents?.length && Array.isArray(spotlight.upcomingEvents)) {
      merged.upcomingEvents = (spotlight.upcomingEvents as Array<Record<string, unknown>>).map(
        (event, index) => ({
          id: typeof event.id === 'string' ? event.id : `event-${index}`,
          title: typeof event.title === 'string' ? event.title : 'Campus event',
          date: typeof event.date === 'string' ? event.date : new Date().toISOString().slice(0, 10),
          category: 'Academic' as HubEventCategory,
          href: typeof event.href === 'string' ? event.href : undefined,
        }),
      );
    }
  }

  return {
    leadership: {
      ...(merged.leadership ?? seedInformationHub.leadership),
      portraitSrc:
        typeof merged.leadership?.portraitSrc === 'string' &&
        merged.leadership.portraitSrc.startsWith('/')
          ? merged.leadership.portraitSrc
          : seedInformationHub.leadership.portraitSrc,
      portraitAlt: merged.leadership?.portraitAlt ?? seedInformationHub.leadership.portraitAlt,
      message:
        typeof merged.leadership?.message === 'string' && merged.leadership.message.trim()
          ? merged.leadership.message
          : seedInformationHub.leadership.message,
      messageHref: normalizePrincipalMessageHref(merged.leadership?.messageHref),
    },
    upcomingEvents: merged.upcomingEvents?.length ? merged.upcomingEvents : [],
    notices: merged.notices?.length ? merged.notices : [],
    calendarHref: merged.calendarHref ?? seedInformationHub.calendarHref,
    noticesHref: merged.noticesHref ?? seedInformationHub.noticesHref,
  };
}

/** Calendar “today” in Asia/Kolkata so SSR and browsers agree. */
export function collegeTodayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function daysUntil(isoDate: string) {
  const today = collegeTodayIso();
  const target = isoDate.slice(0, 10);
  const start = Date.parse(`${today}T00:00:00+05:30`);
  const end = Date.parse(`${target}T00:00:00+05:30`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export function isSameDay(isoDate: string) {
  return daysUntil(isoDate) === 0;
}

export function isRecentNotice(isoDate: string, hours = 24) {
  const published = new Date(isoDate).getTime();
  if (!Number.isFinite(published)) return false;
  return Date.now() - published <= hours * 60 * 60 * 1000;
}

const MONTHS_SHORT = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;
const WEEKDAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function eventDateParts(isoDate: string) {
  const raw = isoDate.slice(0, 10);
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) {
    return { day: '--', month: '---', weekday: '---' };
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  return {
    day: String(day).padStart(2, '0'),
    month: MONTHS_SHORT[month - 1] ?? '---',
    weekday: WEEKDAYS_SHORT[utc.getUTCDay()] ?? '---',
  };
}

export function formatNoticeDate(isoDate: string) {
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
