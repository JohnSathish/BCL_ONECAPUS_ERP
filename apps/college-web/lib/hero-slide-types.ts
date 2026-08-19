export type HeroSlide = {
  id: string;
  desktopSrc: string;
  mobileSrc?: string;
  alt: string;
};

/**
 * Bundled campus photos shown when CMS hero uploads are missing or 404.
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
