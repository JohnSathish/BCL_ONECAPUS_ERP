import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Bus,
  CalendarDays,
  GraduationCap,
  HandHeart,
  Newspaper,
  Trophy,
  Users,
} from 'lucide-react';

export type NewsPlaceholderTone = 'navy' | 'green' | 'purple' | 'brown';

const PLACEHOLDER_TONES: NewsPlaceholderTone[] = ['navy', 'green', 'purple', 'brown'];

const FALLBACK_IMAGE_MARKERS = [
  '/images/campus-hero',
  '/images/campus-reference',
  'campus-hero.webp',
  'campus-hero-mobile.webp',
];

/** True when the CMS/public payload has a real featured image (not a site fallback). */
export function hasNewsFeaturedImage(image?: string | null): boolean {
  if (!image?.trim()) return false;
  const value = image.trim().toLowerCase();
  if (FALLBACK_IMAGE_MARKERS.some((marker) => value.includes(marker))) return false;
  return (
    value.startsWith('/uploads/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/images/')
  );
}

export function newsPlaceholderTone(seed: string): NewsPlaceholderTone {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PLACEHOLDER_TONES[hash % PLACEHOLDER_TONES.length];
}

const categoryIcons: Record<string, LucideIcon> = {
  Campus: Users,
  'College Life': Users,
  Admissions: GraduationCap,
  Academic: BookOpen,
  Examination: BookOpen,
  Achievements: Trophy,
  Service: HandHeart,
  'Field Visit': Bus,
  'News & Events': Newspaper,
  News: Newspaper,
};

export function newsCategoryIcon(category: string): LucideIcon {
  return categoryIcons[category] ?? CalendarDays;
}
