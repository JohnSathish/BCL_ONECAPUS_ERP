import type { Metadata } from 'next';

export type SchoolSeoDoc = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  focusKeyword?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  schemaType?: string;
  breadcrumbTitle?: string;
  hero?: {
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
};

export type SeoCrumb = { href: string; label: string };

const PAGE_PARENTS: Record<string, SeoCrumb[]> = {
  about: [{ href: '/', label: 'Home' }],
  history: [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ],
  'vision-mission': [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ],
  principal: [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ],
  administration: [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ],
  faculty: [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ],
  facilities: [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ],
  rules: [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
  ],
  academics: [{ href: '/', label: 'Home' }],
  curriculum: [
    { href: '/', label: 'Home' },
    { href: '/academics', label: 'Academics' },
  ],
  examinations: [
    { href: '/', label: 'Home' },
    { href: '/academics', label: 'Academics' },
  ],
  timetable: [
    { href: '/', label: 'Home' },
    { href: '/academics', label: 'Academics' },
  ],
  admissions: [{ href: '/', label: 'Home' }],
  fees: [
    { href: '/', label: 'Home' },
    { href: '/admissions', label: 'Admissions' },
  ],
  apply: [
    { href: '/', label: 'Home' },
    { href: '/admissions', label: 'Admissions' },
  ],
  'student-life': [{ href: '/', label: 'Home' }],
  sports: [
    { href: '/', label: 'Home' },
    { href: '/student-life', label: 'Student life' },
  ],
  'campus-life': [
    { href: '/', label: 'Home' },
    { href: '/student-life', label: 'Student life' },
  ],
  activities: [
    { href: '/', label: 'Home' },
    { href: '/student-life', label: 'Student life' },
  ],
  notices: [{ href: '/', label: 'Home' }],
  news: [{ href: '/', label: 'Home' }],
  events: [{ href: '/', label: 'Home' }],
  gallery: [{ href: '/', label: 'Home' }],
  contact: [{ href: '/', label: 'Home' }],
  'privacy-policy': [{ href: '/', label: 'Home' }],
  privacy: [{ href: '/', label: 'Home' }],
  faq: [{ href: '/', label: 'Home' }],
  'parent-corner': [{ href: '/', label: 'Home' }],
};

export const RELATED_LINKS: Record<string, SeoCrumb[]> = {
  about: [
    { href: '/history', label: 'History' },
    { href: '/vision-mission', label: 'Vision & mission' },
    { href: '/principal', label: 'Principal' },
    { href: '/faculty', label: 'Faculty' },
    { href: '/contact', label: 'Contact' },
  ],
  history: [
    { href: '/about', label: 'About the school' },
    { href: '/vision-mission', label: 'Vision & mission' },
    { href: '/principal', label: 'Principal' },
    { href: '/facilities', label: 'Facilities' },
  ],
  'vision-mission': [
    { href: '/about', label: 'About the school' },
    { href: '/history', label: 'History' },
    { href: '/principal', label: 'Principal' },
  ],
  principal: [
    { href: '/about', label: 'About the school' },
    { href: '/faculty', label: 'Faculty' },
    { href: '/history', label: 'History' },
  ],
  administration: [
    { href: '/principal', label: 'Principal' },
    { href: '/faculty', label: 'Faculty' },
    { href: '/about', label: 'About' },
  ],
  faculty: [
    { href: '/principal', label: 'Principal' },
    { href: '/about', label: 'About' },
    { href: '/contact', label: 'Contact' },
  ],
  rules: [
    { href: '/parent-corner', label: 'Parent corner' },
    { href: '/admissions', label: 'Admissions' },
    { href: '/about', label: 'About' },
  ],
  academics: [
    { href: '/curriculum', label: 'Curriculum' },
    { href: '/examinations', label: 'Examinations' },
    { href: '/timetable', label: 'Timetable' },
    { href: '/notices', label: 'Academic notices' },
  ],
  curriculum: [
    { href: '/academics', label: 'Academics' },
    { href: '/examinations', label: 'Examinations' },
  ],
  examinations: [
    { href: '/academics', label: 'Academics' },
    { href: '/timetable', label: 'Timetable' },
    { href: '/student-life', label: 'Student life' },
    { href: '/notices', label: 'Notices' },
  ],
  timetable: [
    { href: '/academics', label: 'Academics' },
    { href: '/contact', label: 'Contact' },
  ],
  admissions: [
    { href: '/fees', label: 'Fee structure' },
    { href: '/apply', label: 'Online application' },
    { href: '/notices', label: 'Admission notices' },
    { href: '/contact', label: 'Contact the office' },
  ],
  fees: [
    { href: '/admissions', label: 'Admissions' },
    { href: '/apply', label: 'Apply online' },
    { href: '/contact', label: 'Contact' },
  ],
  'student-life': [
    { href: '/sports', label: 'Sports' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/gallery', label: 'Gallery' },
  ],
  sports: [
    { href: '/student-life', label: 'Student life' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/gallery', label: 'Gallery' },
  ],
  facilities: [
    { href: '/student-life', label: 'Student life' },
    { href: '/sports', label: 'Sports' },
    { href: '/about', label: 'About' },
  ],
  'campus-life': [
    { href: '/gallery', label: 'Gallery' },
    { href: '/facilities', label: 'Facilities' },
    { href: '/events', label: 'Events' },
  ],
  'parent-corner': [
    { href: '/rules', label: 'School rules' },
    { href: '/admissions', label: 'Admissions' },
    { href: '/contact', label: 'Contact' },
  ],
  contact: [
    { href: '/admissions', label: 'Admissions' },
    { href: '/faq', label: 'Questions parents ask' },
  ],
  notices: [
    { href: '/events', label: 'Events' },
    { href: '/news', label: 'News' },
  ],
  news: [
    { href: '/notices', label: 'Notice board' },
    { href: '/events', label: 'Events' },
  ],
  events: [
    { href: '/notices', label: 'Notices' },
    { href: '/gallery', label: 'Gallery' },
  ],
  gallery: [{ href: '/events', label: 'Events' }],
  faq: [
    { href: '/admissions', label: 'Admissions' },
    { href: '/fees', label: 'Fee structure' },
    { href: '/contact', label: 'Contact' },
  ],
};

export function asSeo(value: unknown): SchoolSeoDoc {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as SchoolSeoDoc) : {};
}

export function seoBag(extrasJson: Record<string, unknown>): Record<string, unknown> {
  return extrasJson.seo && typeof extrasJson.seo === 'object' && !Array.isArray(extrasJson.seo)
    ? (extrasJson.seo as Record<string, unknown>)
    : {};
}

export function schoolPublicOrigin(extrasJson: Record<string, unknown>, host?: string | null) {
  const configured = String(seoBag(extrasJson).publicBaseUrl || '')
    .trim()
    .replace(/\/$/, '');
  const raw = (host || '').trim();
  const name = raw.split(':')[0]?.toLowerCase() || '';
  if (name.includes('localhost')) {
    return raw.includes(':') ? `http://${raw}` : `http://${name}:3000`;
  }
  return configured || 'https://stlukestura.in';
}

export function absoluteSchoolUrl(origin: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (clean === '/') return origin;
  return `${origin}${clean}`;
}

export function crumbsFor(slug: string, title: string, seo?: SchoolSeoDoc): SeoCrumb[] {
  const parents = PAGE_PARENTS[slug] ?? [{ href: '/', label: 'Home' }];
  return [
    ...parents,
    { href: slug === '' ? '/' : `/${slug}`, label: seo?.breadcrumbTitle || title },
  ];
}

export function checklist(input: {
  title: string;
  description: string;
  h1?: string;
  canonical?: string;
  image?: string;
  imageAlt?: string;
  path?: string;
  hasInternalLinks?: boolean;
}) {
  const items = [
    {
      ok: Boolean(input.title.trim()),
      label: 'SEO title',
      warn: input.title.length > 60 ? 'Title may be truncated in Google results' : undefined,
    },
    {
      ok: Boolean(input.description.trim()),
      label: 'Meta description',
      warn:
        input.description.length > 160
          ? 'Description may be truncated in Google results'
          : undefined,
    },
    { ok: Boolean((input.h1 || '').trim()), label: 'H1' },
    { ok: Boolean((input.canonical || '').trim()), label: 'Canonical' },
    { ok: Boolean((input.path || '').trim()) && !/[?]/.test(input.path || ''), label: 'URL slug' },
    {
      ok: input.image ? Boolean((input.imageAlt || '').trim()) : true,
      label: 'Image alt text',
      warn:
        input.image && !(input.imageAlt || '').trim()
          ? 'Featured image is missing alt text'
          : undefined,
    },
    { ok: input.hasInternalLinks !== false, label: 'Internal links' },
  ];
  return items;
}

export function buildSchoolMetadata(input: {
  origin: string;
  path: string;
  siteName: string;
  title: string;
  description: string;
  seo?: SchoolSeoDoc;
  ogImage?: string;
  logo?: string;
  published?: boolean;
  googleVerification?: string;
}): Metadata {
  const seo = input.seo ?? {};
  const title = (seo.title || input.title).trim();
  const description = (seo.description || input.description).trim();
  const path = seo.canonicalPath || input.path || '/';
  const canonical = absoluteSchoolUrl(input.origin, path);
  const index = input.published === false ? false : seo.robotsIndex !== false;
  const follow = seo.robotsFollow !== false;
  const ogTitle = seo.ogTitle || title;
  const ogDescription = seo.ogDescription || description;
  const ogImage = seo.ogImage || input.ogImage || input.logo;
  const twitterTitle = seo.twitterTitle || ogTitle;
  const twitterDescription = seo.twitterDescription || ogDescription;
  const twitterImage = seo.twitterImage || ogImage;
  return {
    title,
    description: description || undefined,
    alternates: { canonical },
    robots: { index, follow },
    openGraph: {
      type: path === '/' ? 'website' : 'article',
      siteName: input.siteName,
      title: ogTitle,
      description: ogDescription || undefined,
      url: canonical,
      images: ogImage
        ? [{ url: absoluteSchoolUrl(input.origin, ogImage), alt: input.siteName }]
        : undefined,
    },
    twitter: {
      card: twitterImage ? 'summary_large_image' : 'summary',
      title: twitterTitle,
      description: twitterDescription || undefined,
      images: twitterImage ? [absoluteSchoolUrl(input.origin, twitterImage)] : undefined,
    },
    verification: input.googleVerification ? { google: input.googleVerification } : undefined,
  };
}

export function organizationJsonLd(input: {
  origin: string;
  name: string;
  alternateName?: string;
  url: string;
  logo: string;
  image?: string;
  addressLine: string;
  city: string;
  district: string;
  state: string;
  pin: string;
  country: string;
  email?: string | null;
  phone?: string | null;
  sameAs: string[];
  foundingYear?: string;
  latitude?: string;
  longitude?: string;
  mapsUrl?: string;
}) {
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: input.name,
    alternateName: input.alternateName,
    url: input.url,
    logo: absoluteSchoolUrl(input.origin, input.logo),
    image: input.image
      ? absoluteSchoolUrl(input.origin, input.image)
      : absoluteSchoolUrl(input.origin, input.logo),
    address: {
      '@type': 'PostalAddress',
      streetAddress: input.addressLine,
      addressLocality: input.city,
      addressRegion: `${input.district}, ${input.state}`,
      postalCode: input.pin,
      addressCountry: input.country,
    },
  };
  if (input.email) org.email = input.email;
  if (input.phone) org.telephone = input.phone;
  if (input.sameAs.length) org.sameAs = input.sameAs;
  if (input.foundingYear) org.foundingDate = input.foundingYear;
  if (input.mapsUrl) org.hasMap = input.mapsUrl;
  if (input.latitude && input.longitude) {
    org.geo = {
      '@type': 'GeoCoordinates',
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
    };
  }
  return org;
}

export function websiteJsonLd(name: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
  };
}

export function breadcrumbJsonLd(origin: string, crumbs: SeoCrumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.label,
      item: absoluteSchoolUrl(origin, crumb.href),
    })),
  };
}

export function sameAsLinks(extrasJson: Record<string, unknown>, email?: string | null) {
  const social =
    extrasJson.socialLinks && typeof extrasJson.socialLinks === 'object'
      ? (extrasJson.socialLinks as Record<string, unknown>)
      : {};
  return [
    ...Object.values(social).map((v) => String(v || '').trim()),
    email ? `mailto:${email}` : '',
  ].filter((href) => /^https?:\/\//i.test(href));
}

export function schoolGraphFromSite(
  site: {
    displayName: string;
    shortName: string;
    addressLine: string;
    city: string;
    district: string;
    state: string;
    pin: string;
    email: string | null;
    phone: string | null;
    extrasJson: Record<string, unknown>;
  },
  origin: string,
) {
  const extrasJson = site.extrasJson ?? {};
  const seo = seoBag(extrasJson);
  const logo = String(extrasJson.logoUrl || '/school-sis/st-lukes-logo.png');
  const image = String(seo.defaultOgImage || extrasJson.campusImage || logo);
  const mapsUrl = String(seo.googleMapsUrl || '').trim();
  return [
    organizationJsonLd({
      origin,
      name: site.displayName,
      alternateName: site.shortName,
      url: origin,
      logo,
      image: isCrestOnly(image) ? logo : image,
      addressLine: site.addressLine,
      city: site.city,
      district: site.district,
      state: site.state,
      pin: site.pin,
      country: String(seo.country || 'India'),
      email: site.email,
      phone: site.phone,
      sameAs: sameAsLinks(extrasJson),
      foundingYear: String(extrasJson.establishedYear || '').trim() || undefined,
      latitude: String(seo.latitude || '').trim() || undefined,
      longitude: String(seo.longitude || '').trim() || undefined,
      mapsUrl: mapsUrl || undefined,
    }),
    websiteJsonLd(site.displayName, origin),
  ];
}

function isCrestOnly(src: string) {
  const s = src.toLowerCase();
  return s.includes('logo') || s.includes('campus-hero');
}

export function eventJsonLd(input: {
  origin: string;
  name: string;
  description?: string | null;
  start: string;
  end?: string | null;
  venue?: string | null;
  url: string;
  image?: string;
}) {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    startDate: input.start,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    url: input.url,
  };
  if (input.description) data.description = input.description;
  if (input.end) data.endDate = input.end;
  if (input.venue) {
    data.location = {
      '@type': 'Place',
      name: input.venue,
    };
  }
  if (input.image) data.image = absoluteSchoolUrl(input.origin, input.image);
  return data;
}
