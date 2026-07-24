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

export type HomepageHeaderCtaButton = {
  label: string;
  href: string;
};

export type HomepageHeaderCtas = {
  erpLogin: HomepageHeaderCtaButton;
  onlineAdmission: HomepageHeaderCtaButton;
  mobileApp: HomepageHeaderCtaButton;
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

export type HomepageLifeAtCampusItem = {
  id: string;
  src: string;
  alt: string;
  label: string;
  href?: string;
};

export type HomepageLifeAtCampus = {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: HomepageLifeAtCampusItem[];
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
  headerCtas: HomepageHeaderCtas;
  coatOfArms: HomepageCoatOfArms;
  researchLinks: HomepageResearchLinks;
  visionMission: HomepageVisionMission;
  principalHighlights: Array<{ label: string; value: string }>;
  sisterInstitutions: HomepageSisterInstitutions;
  lifeAtCampus: HomepageLifeAtCampus;
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
      { label: 'About the College', href: '/about' },
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
  headerCtas: {
    erpLogin: {
      label: 'ERP Login',
      href: 'https://erp.donboscocollege.ac.in',
    },
    onlineAdmission: {
      label: 'Online Admission',
      href: '/admission/apply',
    },
    mobileApp: {
      label: 'Mobile App',
      href: 'https://play.google.com/store/apps/details?id=edu.onecampus.mobile&pcampaignid=web_share',
    },
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
      { label: 'Publications', href: '/research/publications', description: 'Faculty scholarship' },
      { label: 'IQAC', href: '/iqac', description: 'Quality assurance' },
      { label: 'NAAC', href: '/naac' },
      { label: 'Downloads', href: '/downloads' },
      {
        label: 'ERP Login',
        href: 'https://erp.donboscocollege.ac.in',
        description: 'Staff & student portal',
      },
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
        id: 'dbc-bongaigaon',
        name: 'Don Bosco College, Bongaigaon (DBC)',
        logoUrl: '/images/sister-institutions/dbc-bongaigaon.jpg',
        href: 'https://donboscocollege.ac.in/',
      },
      {
        id: 'dbim',
        name: 'Don Bosco Institute of Management (DBIM)',
        logoUrl: '/images/sister-institutions/dbim.png',
        href: 'https://dbim.ac.in/',
      },
      {
        id: 'dbc-tura-linkage',
        name: 'Don Bosco College, Tura — sister linkage',
        logoUrl: '/images/sister-institutions/dbc-tura-linkage.png',
        href: 'https://donboscocollege.ac.in/',
      },
      {
        id: 'don-bosco-university',
        name: 'Don Bosco University',
        logoUrl: '/images/sister-institutions/don-bosco-university.png',
        href: 'https://www.dbuniversity.ac.in/',
      },
      {
        id: 'salesian-province-ing',
        name: 'Salesian Province of Guwahati (ING)',
        logoUrl: '/images/sister-institutions/salesian-province-ing.jpg',
        href: 'https://donboscoindia.org/',
      },
      {
        id: 'salesians-sdb',
        name: 'Salesians of Don Bosco (SDB)',
        logoUrl: '/images/sister-institutions/salesians-sdb.png',
        href: 'https://www.sdb.org/',
      },
      {
        id: 'st-anthonys-shillong',
        name: "St. Anthony's College, Shillong",
        logoUrl: '/images/sister-institutions/st-anthonys-shillong.png',
        href: 'https://anthonys.ac.in/',
      },
    ],
  },
  lifeAtCampus: {
    eyebrow: 'Life at Don Bosco',
    title: 'A campus full of possibility',
    subtitle: 'Every corner holds a story of learning, friendship and discovery.',
    items: [
      {
        id: 'ncc',
        src: 'https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=82',
        alt: 'NCC cadets participating in a college programme',
        label: 'NCC',
      },
      {
        id: 'nss',
        src: 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=1200&q=82',
        alt: 'NSS student volunteers serving the community',
        label: 'NSS',
      },
      {
        id: 'sports',
        src: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=82',
        alt: 'Students participating in college sports',
        label: 'Sports',
      },
      {
        id: 'cultural',
        src: 'https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1200&q=82',
        alt: 'Students performing during a cultural event',
        label: 'Cultural Events',
      },
      {
        id: 'labs',
        src: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=82',
        alt: 'Students learning in a science laboratory',
        label: 'Labs',
      },
      {
        id: 'library',
        src: 'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&w=1200&q=82',
        alt: 'Students studying in the college library',
        label: 'Library',
      },
      {
        id: 'hostel',
        src: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=82',
        alt: 'Comfortable student hostel facilities',
        label: 'Hostel',
      },
    ],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCollegeHeaderCtas(value: unknown): HomepageHeaderCtas {
  const defaults = seedHomepageCmsContent.headerCtas;
  const source = isRecord(value) ? value : {};
  const pick = (
    preferred: unknown,
    legacy: unknown,
    fallback: HomepageHeaderCtaButton,
  ): HomepageHeaderCtaButton => {
    for (const candidate of [preferred, legacy]) {
      if (!isRecord(candidate)) continue;
      const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
      const href = typeof candidate.href === 'string' ? candidate.href.trim() : '';
      if (label || href) {
        return { label: label || fallback.label, href: href || fallback.href };
      }
    }
    return { ...fallback };
  };
  const secondary = isRecord(source.secondary) ? source.secondary : null;
  const secondaryHref = secondary && typeof secondary.href === 'string' ? secondary.href : '';
  const secondaryLooksLikeApp = /play\.google\.com|mobile.?app/i.test(
    `${typeof secondary?.label === 'string' ? secondary.label : ''} ${secondaryHref}`,
  );
  return {
    erpLogin: pick(source.erpLogin, secondaryLooksLikeApp ? null : secondary, defaults.erpLogin),
    onlineAdmission: pick(source.onlineAdmission, source.primary, defaults.onlineAdmission),
    mobileApp: pick(source.mobileApp, secondaryLooksLikeApp ? secondary : null, defaults.mobileApp),
  };
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
    headerCtas: isRecord(source.headerCtas)
      ? normalizeCollegeHeaderCtas(source.headerCtas)
      : undefined,
    coatOfArms: isRecord(source.coatOfArms) ? (source.coatOfArms as HomepageCoatOfArms) : undefined,
    researchLinks: isRecord(source.researchLinks)
      ? (source.researchLinks as HomepageResearchLinks)
      : undefined,
    sisterInstitutions: isRecord(source.sisterInstitutions)
      ? (source.sisterInstitutions as HomepageSisterInstitutions)
      : undefined,
    lifeAtCampus: isRecord(source.lifeAtCampus)
      ? (source.lifeAtCampus as HomepageLifeAtCampus)
      : Array.isArray(source.gallery)
        ? {
            eyebrow: seedHomepageCmsContent.lifeAtCampus.eyebrow,
            title: seedHomepageCmsContent.lifeAtCampus.title,
            subtitle: seedHomepageCmsContent.lifeAtCampus.subtitle,
            items: source.gallery as HomepageLifeAtCampusItem[],
          }
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
    headerCtas: normalizeCollegeHeaderCtas(merged.headerCtas),
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
    lifeAtCampus:
      merged.lifeAtCampus?.items?.length ||
      merged.lifeAtCampus?.title ||
      merged.lifeAtCampus?.eyebrow
        ? {
            eyebrow: merged.lifeAtCampus.eyebrow ?? seedHomepageCmsContent.lifeAtCampus.eyebrow,
            title: merged.lifeAtCampus.title ?? seedHomepageCmsContent.lifeAtCampus.title,
            subtitle: merged.lifeAtCampus.subtitle ?? seedHomepageCmsContent.lifeAtCampus.subtitle,
            items: merged.lifeAtCampus.items?.length
              ? merged.lifeAtCampus.items
              : seedHomepageCmsContent.lifeAtCampus.items,
          }
        : seedHomepageCmsContent.lifeAtCampus,
  };
}
