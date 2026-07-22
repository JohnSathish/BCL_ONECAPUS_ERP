import 'server-only';

import { absoluteMediaUrl, absolutizeMediaUrl } from '@/lib/media-url';

export type HeroSlide = {
  id: string;
  desktopSrc: string;
  mobileSrc?: string;
  alt: string;
};

/**
 * Fallback slides when CMS has no active hero images.
 * Prefer managing slides in ERP → Website CMS → Hero slider.
 */
export const fallbackHeroSlides: HeroSlide[] = [
  {
    id: 'campus-main',
    desktopSrc: '/images/campus-hero.webp',
    mobileSrc: '/images/campus-hero-mobile.webp',
    alt: 'Don Bosco College Tura campus',
  },
  {
    id: 'campus-reference',
    desktopSrc: '/images/campus-reference.png',
    alt: 'Don Bosco College Tura building and grounds',
  },
];

/** @deprecated use fallbackHeroSlides or getHeroSlides() */
export const heroSlides = fallbackHeroSlides;

const safeTenant = () => {
  const value = process.env.COLLEGE_TENANT_SLUG ?? process.env.NEXT_PUBLIC_TENANT_SLUG;
  if (value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return value;
  if (process.env.NODE_ENV !== 'production') return 'demo';
  return undefined;
};

const cmsBase = () => {
  const internal = process.env.API_INTERNAL_ORIGIN?.replace(/\/+$/, '');
  if (internal && /^https?:\/\/[^/]+$/i.test(internal)) return `${internal}/api`;
  const configured = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured.endsWith('/api') ? configured : `${configured}/api`;
  }
  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:3001/api';
  return undefined;
};

const absoluteUrl = absoluteMediaUrl;

export async function getHeroSlides(): Promise<HeroSlide[]> {
  const base = cmsBase();
  if (!base) return fallbackHeroSlides;

  try {
    const url = new URL(`${base}/v1/website/public/hero-slides`);
    const tenant = safeTenant();
    if (tenant) url.searchParams.set('tenant', tenant);

    const response = await fetch(url, {
      // Always refresh in local/dev so CMS uploads appear immediately.
      ...(process.env.NODE_ENV !== 'production'
        ? { cache: 'no-store' as const }
        : { next: { revalidate: 10, tags: ['website-cms', 'website-hero'] } }),
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) return fallbackHeroSlides;

    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload)
      ? payload
      : payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          Array.isArray((payload as { data: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : [];

    const slides = rows
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const item = row as Record<string, unknown>;
        const desktopSrc =
          typeof item.desktopSrc === 'string'
            ? item.desktopSrc
            : typeof item.desktopUrl === 'string'
              ? item.desktopUrl
              : null;
        if (!desktopSrc) return null;
        const mobileSrc =
          typeof item.mobileSrc === 'string'
            ? item.mobileSrc
            : typeof item.mobileUrl === 'string'
              ? item.mobileUrl
              : undefined;
        return {
          id: typeof item.id === 'string' ? item.id : desktopSrc,
          desktopSrc: absoluteUrl(desktopSrc),
          mobileSrc: mobileSrc ? absoluteUrl(mobileSrc) : undefined,
          alt:
            typeof item.alt === 'string' && item.alt.trim()
              ? item.alt
              : typeof item.altText === 'string' && item.altText.trim()
                ? item.altText
                : 'Campus highlight',
        } satisfies HeroSlide;
      })
      .filter(Boolean) as HeroSlide[];

    return slides.length ? slides : fallbackHeroSlides;
  } catch (error) {
    console.warn('[college-web] Hero slides unavailable; using fallback', error);
    return fallbackHeroSlides;
  }
}

export { absolutizeMediaUrl };
