import 'server-only';

import { fetchCms, isRecord } from '@/lib/cms-client';
import { fallbackHeroSlides, type HeroSlide } from '@/lib/hero-slide-types';
import { absoluteMediaUrl, absolutizeMediaUrl } from '@/lib/media-url';

export type { HeroSlide } from '@/lib/hero-slide-types';
export { fallbackHeroSlides };

/** @deprecated use fallbackHeroSlides or getHeroSlides() */
export const heroSlides = fallbackHeroSlides;

const absoluteUrl = absoluteMediaUrl;

export async function getHeroSlides(): Promise<HeroSlide[]> {
  const payload = await fetchCms('hero-slides', {}, 10);
  if (payload == null) return fallbackHeroSlides;

  try {
    const rows = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.data)
        ? payload.data
        : [];

    const slides = rows
      .map((row) => {
        if (!isRecord(row)) return null;
        const desktopSrc =
          typeof row.desktopSrc === 'string'
            ? row.desktopSrc
            : typeof row.desktopUrl === 'string'
              ? row.desktopUrl
              : null;
        if (!desktopSrc) return null;
        const mobileSrc =
          typeof row.mobileSrc === 'string'
            ? row.mobileSrc
            : typeof row.mobileUrl === 'string'
              ? row.mobileUrl
              : undefined;
        return {
          id: typeof row.id === 'string' ? row.id : desktopSrc,
          desktopSrc: absoluteUrl(desktopSrc),
          mobileSrc: mobileSrc ? absoluteUrl(mobileSrc) : undefined,
          alt:
            typeof row.alt === 'string' && row.alt.trim()
              ? row.alt
              : typeof row.altText === 'string' && row.altText.trim()
                ? row.altText
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
