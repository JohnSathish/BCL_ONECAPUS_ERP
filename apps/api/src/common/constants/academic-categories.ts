/** NEP curriculum role — set per programme on course_offerings, never on courses. */
export const NEP_CURRICULUM_CATEGORIES = [
  'MAJOR',
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VAC',
  'VTC',
  'INTERNSHIP',
  'PROJECT',
  'RESEARCH',
  'ELECTIVE',
  'OPEN_ELECTIVE',
  'DISSERTATION',
] as const;

export type NepCurriculumCategory = (typeof NEP_CURRICULUM_CATEGORIES)[number];

/** CBCS catalog type — academic identity on course master only. */
export const CBCS_COURSE_TYPES = [
  'CORE',
  'ELECTIVE',
  'SKILL',
  'OPEN',
  'LAB',
  'PRACTICAL',
] as const;

export function isNepCurriculumCategory(
  value: string,
): value is NepCurriculumCategory {
  return (NEP_CURRICULUM_CATEGORIES as readonly string[]).includes(value);
}

export const NEP_CATEGORY_ON_MASTER_MESSAGE =
  'NEP categories (Major, Minor, MDC, AEC, SEC, VAC, etc.) belong on curriculum mapping, not the course master';
