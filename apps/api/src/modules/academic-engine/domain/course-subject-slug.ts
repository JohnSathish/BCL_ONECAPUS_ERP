import { slugifySubject } from './nep-categories';

export function resolveCourseSubjectSlugCandidates(course: {
  subjectSlug?: string | null;
  title?: string | null;
  department?: { name?: string | null; code?: string | null } | null;
}): string[] {
  const slugs = new Set<string>();
  if (course.subjectSlug?.trim()) slugs.add(slugifySubject(course.subjectSlug));
  if (course.title?.trim()) slugs.add(slugifySubject(course.title));
  if (course.department?.name?.trim())
    slugs.add(slugifySubject(course.department.name));
  return [...slugs];
}

export function resolveCourseSubjectSlug(course: {
  subjectSlug?: string | null;
  title?: string | null;
  department?: { name?: string | null; code?: string | null } | null;
}): string {
  const candidates = resolveCourseSubjectSlugCandidates(course);
  return candidates[0] ?? '';
}

export function courseMatchesSubjectPath(
  course: {
    subjectSlug?: string | null;
    title?: string | null;
    department?: { name?: string | null; code?: string | null } | null;
  },
  pathSlug: string,
): boolean {
  const target = slugifySubject(pathSlug);
  return resolveCourseSubjectSlugCandidates(course).some(
    (slug) => slug === target,
  );
}
