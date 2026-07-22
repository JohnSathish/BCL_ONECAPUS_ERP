/**
 * Mirrored homepage section registry for college-web renderer.
 * Keep in sync with apps/api/src/modules/website/website-cms.registry.ts
 */
export const HOMEPAGE_SECTION_KEYS = [
  'hero',
  'statistics',
  'aboutCollege',
  'principalMessage',
  'upcomingEvents',
  'noticeBoard',
  'departments',
  'programmes',
  'campusLife',
  'news',
  'gallery',
  'coatOfArms',
  'researchLinks',
  'testimonials',
  'placement',
  'footer',
] as const;

export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[number];
