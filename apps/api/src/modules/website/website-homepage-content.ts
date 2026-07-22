/**
 * Canonical homepage editable content stored in WebsiteSite.settingsJson.homepage
 * college-web merges this with section layout; seeds are offline fallback only.
 */

export type HomepagePrincipalContent = {
  name: string;
  role: string;
  tenure: string;
  message: string;
  fullMessage: string;
  portraitSrc: string;
  portraitAlt: string;
  messageHref: string;
  leadershipHref: string;
  highlights: Array<{ label: string; value: string }>;
};

export type HomepageAboutContent = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  quote: string;
  quoteAttribution: string;
  portraitSrc: string;
  portraitAlt: string;
  readMoreHref: string;
  tourHref: string;
  stats: Array<{
    id: string;
    label: string;
    value: number;
    suffix?: string;
    prefix?: string;
  }>;
};

export type HomepageVisionMissionContent = {
  eyebrow: string;
  title: string;
  visionTitle: string;
  visionBody: string;
  missionTitle: string;
  missionBody: string;
  valuesTitle: string;
  values: string[];
  quote: string;
  quoteAttribution: string;
};

export type HomepageHeroChrome = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  features: Array<{ label: string; href?: string }>;
};

export type HomepageStatItem = { value: string; label: string };

export type HomepageWhyFeature = {
  id: string;
  icon: string;
  title: string;
  copy: string;
  tone?: string;
};

export type HomepageFooterContent = {
  kicker: string;
  ctaTitle: string;
  ctaBody: string;
  applyLabel: string;
  applyHref: string;
  prospectusLabel: string;
  prospectusHref: string;
  mission: string;
  affiliation: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  copyright: string;
  /** Identity band tagline above college name */
  brandTagline?: string;
  collegeName?: string;
  officeHours?: string;
  emailNote?: string;
  affiliationTitle?: string;
  affiliationDetail?: string;
  accreditationTitle?: string;
  accreditationDetail?: string;
  exploreLinks: Array<{ label: string; href: string }>;
  socialLinks: Array<{ label: string; href: string; mark: string }>;
  badges: Array<{ label: string; value: string }>;
};

export type HomepageCoatOfArmsContent = {
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
};

export type HomepageResearchLinksContent = {
  title: string;
  subtitle: string;
  links: Array<{ label: string; href: string; description?: string }>;
};

export type HomepageSisterInstitution = {
  id: string;
  name: string;
  logoUrl: string;
  href: string;
};

export type HomepageSisterInstitutionsContent = {
  title: string;
  subtitle: string;
  items: HomepageSisterInstitution[];
};

export type HomepageSectionChrome = {
  title?: string;
  subtitle?: string;
  background?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type WebsiteHomepageContent = {
  principal: HomepagePrincipalContent;
  aboutCollege: HomepageAboutContent;
  visionMission: HomepageVisionMissionContent;
  hero: HomepageHeroChrome;
  statistics: HomepageStatItem[];
  whyChooseUs: {
    eyebrow: string;
    title: string;
    subtitle: string;
    features: HomepageWhyFeature[];
    highlights: HomepageWhyFeature[];
  };
  footer: HomepageFooterContent;
  coatOfArms: HomepageCoatOfArmsContent;
  researchLinks: HomepageResearchLinksContent;
  sisterInstitutions: HomepageSisterInstitutionsContent;
  sectionChrome: Partial<Record<string, HomepageSectionChrome>>;
};

export const DEFAULT_HOMEPAGE_CONTENT: WebsiteHomepageContent = {
  principal: {
    name: 'Dr. Fr. Jogesh B. Sangma',
    role: 'Principal',
    tenure: 'Serving since 2018',
    message:
      'Dear Staff and Students,\n\nWelcome to Don Bosco College, Tura. Education here is not only about degrees—it is about forming competent, compassionate and committed citizens.\n\nI invite every student to pursue excellence with humility, and every parent to walk with us in this Salesian mission.',
    fullMessage: '',
    portraitSrc: '/images/principal-jogesh-sangma.png',
    portraitAlt: 'Dr. Fr. Jogesh B. Sangma, Principal',
    messageHref: '/about/principal',
    leadershipHref: '/about/administration',
    highlights: [
      { label: 'Serving Since', value: '1987' },
      { label: 'Affiliated to', value: 'NEHU' },
      { label: 'Holistic Education', value: 'for Life' },
      { label: 'Values | Knowledge | Service', value: 'The Don Bosco Way' },
    ],
  },
  aboutCollege: {
    eyebrow: 'About Don Bosco College, Tura',
    title: 'About Don Bosco College, Tura',
    subtitle: 'Inspired by the Vision of St. John Bosco',
    description:
      'Saint John Bosco, popularly known as Don Bosco, was a priest of the Catholic Church, who came to the rescue of the poor, disadvantaged youth of his time with his innovative method of educating them through total immersion in their world, with personal involvement in their lives and aspirations, with a dedication that was total.\n\nTo ensure that his dedication to their cause shone through his actions, he lived with and for them. He based his education on the three great principles of reason, religion and loving kindness, as a caring father, doing everything possible for their welfare.\n\nThe system of education that he envisioned aims to create generations of young men and women who are intellectually competent, morally upright, socially committed, spiritually inspired and devoted to their country and the world.',
    quote:
      'It is not enough to love the young; they must know that they are loved.',
    quoteAttribution: 'St. John Bosco',
    portraitSrc: '/images/st-john-bosco.png',
    portraitAlt: 'Portrait of Saint John Bosco',
    readMoreHref: '/about/history',
    tourHref: '/about/history',
    stats: [
      { id: 'founded', label: 'Year Established', value: 1987 },
      { id: 'programmes', label: 'Programmes Offered', value: 18, suffix: '+' },
      { id: 'students', label: 'Students', value: 2200, suffix: '+' },
      { id: 'faculty', label: 'Faculty Members', value: 140, suffix: '+' },
      { id: 'departments', label: 'Departments', value: 15 },
      { id: 'naac', label: 'NAAC Accredited', value: 0, prefix: 'B Grade' },
    ],
  },
  visionMission: {
    eyebrow: 'Our identity',
    title: 'Vision & Mission',
    visionTitle: 'Vision',
    visionBody:
      'To be a centre of academic excellence and human formation that educates youth to become competent, compassionate and committed leaders for society.',
    missionTitle: 'Mission',
    missionBody:
      'Inspired by St. John Bosco, we provide holistic education rooted in reason, religion and loving kindness—nurturing intellect, character and service.',
    valuesTitle: 'Core values',
    values: [
      'Excellence',
      'Integrity',
      'Service',
      'Inclusion',
      'Faith & Reason',
    ],
    quote: 'Education is a matter of the heart.',
    quoteAttribution: 'St. John Bosco',
  },
  hero: {
    eyebrow: 'Don Bosco College, Tura',
    title: 'In Pursuit of Excellence',
    subtitle:
      'A Salesian college forming young people through learning, character and service in the Garo Hills.',
    primaryCtaLabel: 'Apply for admission',
    primaryCtaHref: '/admission/apply',
    secondaryCtaLabel: 'Explore programmes',
    secondaryCtaHref: '/academics/programmes',
    features: [
      { label: 'UGC Recognised', href: '/naac' },
      { label: "NAAC 'B' Grade", href: '/naac' },
      { label: 'Affiliated to NEHU', href: '/about/history' },
    ],
  },
  statistics: [
    { value: '2200+', label: 'Students' },
    { value: '140+', label: 'Faculty members' },
    { value: '35+', label: 'Departments' },
    { value: '39+', label: 'Years of excellence' },
  ],
  whyChooseUs: {
    eyebrow: 'Why choose us',
    title: 'A college that forms the whole person',
    subtitle:
      'Academics, character and community—woven into everyday campus life.',
    features: [
      {
        id: 'faculty',
        icon: 'Users',
        title: 'Experienced Faculty',
        copy: 'Mentorship that shapes minds and careers.',
        tone: 'violet',
      },
      {
        id: 'smart',
        icon: 'MonitorUp',
        title: 'Smart Classrooms',
        copy: 'Technology-enabled spaces for modern learning.',
        tone: 'blue',
      },
      {
        id: 'placement',
        icon: 'BriefcaseBusiness',
        title: 'Placement Support',
        copy: 'Guidance that opens doors to opportunity.',
        tone: 'orange',
      },
      {
        id: 'library',
        icon: 'Library',
        title: 'Library',
        copy: 'Resources that fuel inquiry and discovery.',
        tone: 'indigo',
      },
      {
        id: 'sports',
        icon: 'Trophy',
        title: 'Sports',
        copy: 'Strength of body, discipline of mind.',
        tone: 'rose',
      },
      {
        id: 'character',
        icon: 'HeartHandshake',
        title: 'Character Formation',
        copy: 'Values that last well beyond campus life.',
        tone: 'amber',
      },
      {
        id: 'campus',
        icon: 'Award',
        title: 'Campus Life',
        copy: 'A vibrant community of friendship and growth.',
        tone: 'sky',
      },
      {
        id: 'green',
        icon: 'Leaf',
        title: 'Green Audit',
        copy: 'Sustainability woven into everyday practice.',
        tone: 'teal',
      },
    ],
    highlights: [
      {
        id: 'holistic',
        icon: 'GraduationCap',
        title: 'Holistic Education',
        copy: 'Mind, Body & Soul',
        tone: 'blue',
      },
      {
        id: 'infra',
        icon: 'Landmark',
        title: 'Quality Infrastructure',
        copy: 'For Better Learning',
        tone: 'teal',
      },
      {
        id: 'student',
        icon: 'UserCog',
        title: 'Student-Centered',
        copy: 'Personalized Support',
        tone: 'violet',
      },
      {
        id: 'excellence',
        icon: 'Award',
        title: 'Excellence in Action',
        copy: 'Today & Tomorrow',
        tone: 'orange',
      },
    ],
  },
  footer: {
    kicker: 'Begin your journey',
    brandTagline: 'Igniting minds, shaping futures',
    collegeName: 'Don Bosco College, Tura',
    ctaTitle: 'Admissions Open 2026',
    ctaBody: 'Empowering young minds for a better tomorrow.',
    applyLabel: 'Apply Now',
    applyHref: '/admission/apply',
    prospectusLabel: 'Download prospectus',
    prospectusHref: '/admission/prospectus',
    mission:
      'Education that forms competent, compassionate and committed citizens for a changing world.',
    affiliation:
      "Affiliated to the North-Eastern Hill University, Shillong – 793 022. Recognised by University Grants Commission (UGC), New Delhi. Re-accredited with 'B' Grade by NAAC, Bangalore.",
    affiliationTitle: 'Affiliated to',
    affiliationDetail: 'North-Eastern Hill University\nShillong - 793 022',
    accreditationTitle: 'Re-accredited with',
    accreditationDetail: "'B' Grade by NAAC\nBangalore",
    contactEmail: 'info@donboscocollege.ac.in',
    contactPhone: '+91 96128 90816',
    officeHours: 'Mon - Sat: 9:00 AM - 4:30 PM',
    emailNote: "We're here to help",
    address: 'Tura, West Garo Hills\nMeghalaya - 794101',
    copyright: 'Don Bosco College, Tura',
    exploreLinks: [
      { label: 'About the College', href: '/about/history' },
      { label: 'Programmes', href: '/academics/programmes' },
      { label: 'Admissions', href: '/admission/apply' },
      { label: 'Research', href: '/research/cell' },
      { label: 'IQAC', href: '/iqac' },
      { label: 'NAAC', href: '/naac' },
    ],
    socialLinks: [
      { label: 'Facebook', href: 'https://www.facebook.com/', mark: 'f' },
      { label: 'Instagram', href: 'https://www.instagram.com/', mark: 'ig' },
      { label: 'YouTube', href: 'https://www.youtube.com/', mark: '▶' },
    ],
    badges: [
      { label: 'NAAC', value: 'B Grade' },
      { label: 'UGC', value: 'Recognised' },
      { label: 'NEHU', value: 'Affiliated' },
    ],
  },
  coatOfArms: {
    title: 'Coat of Arms',
    body: 'The Coat of Arms of the college contains the motto of the college, “In Pursuit of Excellence” and three distinct components – sun, eagle and mountains. The radiant sun is the source, the giver that bestows light, energy, inspiration and divine guidance. The soaring eagle is the seeker that looks for all that is good, noble and uplifting in the world of knowledge, skills and values. The green mountains and valleys represent the process whereby the seeker ascends, descends and strives until he/she arrives at the top. True to our motto, we are passionate about excellence in every sphere of our academic, professional and social life.',
    imageSrc: '/images/college-logo.png',
    imageAlt: 'Don Bosco College Tura coat of arms',
  },
  researchLinks: {
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
      {
        label: 'Publications',
        href: '/research/publications',
        description: 'Faculty scholarship',
      },
      { label: 'IQAC', href: '/iqac', description: 'Quality assurance' },
      { label: 'NAAC', href: '/naac' },
      { label: 'Downloads', href: '/downloads' },
    ],
  },
  sisterInstitutions: {
    title: 'Our Sister Institutions',
    subtitle: 'Collaborating institutions under the same management',
    items: [
      {
        id: 'dbc-logo',
        name: 'Don Bosco College, Tura',
        logoUrl: '/images/college-logo.png',
        href: 'https://donboscocollege.ac.in',
      },
    ],
  },
  sectionChrome: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep<T extends Record<string, unknown>>(
  base: T,
  patch: unknown,
): T {
  if (!isRecord(patch)) return base;
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = next[key];
    if (isRecord(current) && isRecord(value) && !Array.isArray(value)) {
      next[key] = mergeDeep(current, value);
    } else {
      next[key] = value;
    }
  }
  return next as T;
}

export function resolveHomepageContent(
  settingsJson: unknown,
): WebsiteHomepageContent {
  const settings = isRecord(settingsJson) ? settingsJson : {};
  const homepage = isRecord(settings.homepage) ? settings.homepage : {};
  return mergeDeep(
    DEFAULT_HOMEPAGE_CONTENT as unknown as Record<string, unknown>,
    homepage,
  ) as unknown as WebsiteHomepageContent;
}

export function normalizePrincipalHref(value: unknown): string {
  const fallback = '/about/principal';
  if (typeof value !== 'string') return fallback;
  const href = value.trim();
  if (!href || href === '#' || href.toLowerCase() === 'null') return fallback;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const url = new URL(href);
    if (url.protocol === 'http:' || url.protocol === 'https:') return href;
  } catch {
    /* ignore */
  }
  return fallback;
}
