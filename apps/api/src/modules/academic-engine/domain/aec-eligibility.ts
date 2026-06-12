import { slugifySubject } from './nep-categories';

export const DEFAULT_AEC_ALLOWED_SLUGS = ['english', 'hindi'] as const;

export type LanguageEligibility = {
  allowedSlugs?: string[];
};

/** Resolve the AEC language slug used by registration validators. */
export function resolveAecSubjectSlug(course: {
  subjectSlug?: string | null;
  title: string;
  code?: string | null;
}): string {
  const explicit = course.subjectSlug?.trim();
  if (explicit) return slugifySubject(explicit);

  const title = course.title.toLowerCase();
  if (title.includes('english') || course.code === 'AEC-120') return 'english';
  if (title.includes('hindi')) return 'hindi';
  if (title.includes('garo')) return 'garo';

  return slugifySubject(course.title);
}

export function mergeLanguageEligibility(
  base: LanguageEligibility | null | undefined,
  extraSlugs: string[],
): LanguageEligibility {
  const allowedSlugs = [
    ...new Set([
      ...(base?.allowedSlugs?.length
        ? base.allowedSlugs
        : [...DEFAULT_AEC_ALLOWED_SLUGS]),
      ...extraSlugs.map((s) => slugifySubject(s)),
    ]),
  ];
  return { allowedSlugs };
}

export function isAecSlugAllowed(
  subjectSlug: string,
  eligibility: LanguageEligibility | null | undefined,
): boolean {
  const allowed = eligibility?.allowedSlugs?.length
    ? eligibility.allowedSlugs
    : [...DEFAULT_AEC_ALLOWED_SLUGS];
  return allowed.includes(slugifySubject(subjectSlug));
}
