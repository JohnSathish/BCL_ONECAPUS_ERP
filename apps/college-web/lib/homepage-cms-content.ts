/**
 * Homepage editable content mirrored from API settingsJson.homepage.
 * Seeds are offline fallback only when CMS is unreachable.
 */

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

export type HomepageWhyChooseUs = {
  eyebrow: string;
  title: string;
  subtitle: string;
  features: Array<{ id: string; icon: string; title: string; copy: string; tone?: string }>;
  highlights: Array<{ id: string; icon: string; title: string; copy: string; tone?: string }>;
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

export type HomepageCoatOfArms = {
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
};

export type HomepageResearchLinks = {
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

export type HomepageSisterInstitutions = {
  title: string;
  subtitle: string;
  items: HomepageSisterInstitution[];
};

export type HomepageVisionMission = {
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

export type HomepageCmsContent = {
  hero: HomepageHeroChrome;
  whyChooseUs: HomepageWhyChooseUs;
  footer: HomepageFooterContent;
  coatOfArms: HomepageCoatOfArms;
  researchLinks: HomepageResearchLinks;
  visionMission: HomepageVisionMission;
  principalHighlights: Array<{ label: string; value: string }>;
  sisterInstitutions: HomepageSisterInstitutions;
};

export const seedHomepageCmsContent: HomepageCmsContent = {
  hero: {
    eyebrow: 'Welcome to',
    title: 'Don Bosco\nCollege, Tura',
    subtitle:
      'A premier institution committed to academic excellence, character formation and holistic development.',
    primaryCtaLabel: 'Discover more',
    primaryCtaHref: '/about/history',
    secondaryCtaLabel: 'Admissions open 2026',
    secondaryCtaHref: '/admission/apply',
    features: [
      { label: 'Quality Education' },
      { label: 'Research' },
      { label: 'Placement' },
      { label: 'Character Formation' },
      { label: 'Infrastructure' },
      { label: 'Holistic Development' },
    ],
  },
  whyChooseUs: {
    eyebrow: 'Why choose us',
    title: 'A college that forms the whole person',
    subtitle: 'Academics, character and community—woven into everyday campus life.',
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
    body: 'Our emblem reflects faith, learning and service—the Salesian heritage that guides Don Bosco College, Tura.',
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
      { label: 'Publications', href: '/research/publications', description: 'Faculty scholarship' },
      { label: 'IQAC', href: '/iqac', description: 'Quality assurance' },
      { label: 'NAAC', href: '/naac' },
      { label: 'Downloads', href: '/downloads' },
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
    values: ['Excellence', 'Integrity', 'Service', 'Inclusion', 'Faith & Reason'],
    quote: 'Education is a matter of the heart.',
    quoteAttribution: 'St. John Bosco',
  },
  principalHighlights: [
    { label: 'Serving Since', value: '1987' },
    { label: 'Affiliated to', value: 'NEHU' },
    { label: 'Holistic Education', value: 'for Life' },
    { label: 'Values | Knowledge | Service', value: 'The Don Bosco Way' },
  ],
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function readHomepageCmsContent(value: unknown): Partial<HomepageCmsContent> {
  if (!isRecord(value)) return {};
  const source = isRecord(value.homepage) ? value.homepage : value;
  const principal = isRecord(source.principal) ? source.principal : null;
  return {
    hero: isRecord(source.hero) ? (source.hero as HomepageHeroChrome) : undefined,
    whyChooseUs: isRecord(source.whyChooseUs)
      ? (source.whyChooseUs as HomepageWhyChooseUs)
      : undefined,
    footer: isRecord(source.footer)
      ? (source.footer as HomepageFooterContent)
      : isRecord(source.footerWidgets)
        ? (source.footerWidgets as HomepageFooterContent)
        : undefined,
    coatOfArms: isRecord(source.coatOfArms) ? (source.coatOfArms as HomepageCoatOfArms) : undefined,
    researchLinks: isRecord(source.researchLinks)
      ? (source.researchLinks as HomepageResearchLinks)
      : undefined,
    sisterInstitutions: isRecord(source.sisterInstitutions)
      ? (source.sisterInstitutions as HomepageSisterInstitutions)
      : undefined,
    visionMission: isRecord(source.visionMission)
      ? (source.visionMission as HomepageVisionMission)
      : undefined,
    principalHighlights: Array.isArray(principal?.highlights)
      ? (principal.highlights as Array<{ label: string; value: string }>)
      : undefined,
  };
}

export function mergeHomepageCmsContent(...values: unknown[]): HomepageCmsContent {
  const merged = values.reduce<Partial<HomepageCmsContent>>(
    (result, value) => ({ ...result, ...readHomepageCmsContent(value) }),
    {},
  );
  return {
    hero: merged.hero ?? seedHomepageCmsContent.hero,
    whyChooseUs: merged.whyChooseUs ?? seedHomepageCmsContent.whyChooseUs,
    footer: merged.footer ?? seedHomepageCmsContent.footer,
    coatOfArms: merged.coatOfArms ?? seedHomepageCmsContent.coatOfArms,
    researchLinks: merged.researchLinks ?? seedHomepageCmsContent.researchLinks,
    visionMission: merged.visionMission ?? seedHomepageCmsContent.visionMission,
    principalHighlights: merged.principalHighlights?.length
      ? merged.principalHighlights
      : seedHomepageCmsContent.principalHighlights,
    sisterInstitutions:
      merged.sisterInstitutions?.items?.length || merged.sisterInstitutions?.title
        ? {
            title:
              merged.sisterInstitutions.title ?? seedHomepageCmsContent.sisterInstitutions.title,
            subtitle:
              merged.sisterInstitutions.subtitle ??
              seedHomepageCmsContent.sisterInstitutions.subtitle,
            items: merged.sisterInstitutions.items?.length
              ? merged.sisterInstitutions.items
              : seedHomepageCmsContent.sisterInstitutions.items,
          }
        : seedHomepageCmsContent.sisterInstitutions,
  };
}
