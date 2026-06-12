/** NEP curriculum role — set per programme on course_offerings, never on course master. */
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

export const STRUCTURE_CATEGORY_TYPES = [...NEP_CURRICULUM_CATEGORIES, 'LAB'] as const;

/** Categories always auto-assigned (not student-choice electives). */
export const ALWAYS_AUTO_ASSIGNED_CATEGORIES = new Set<string>([
  'MAJOR',
  'MINOR',
  'INTERNSHIP',
  'DISSERTATION',
  'PROJECT',
  'RESEARCH',
]);

export function isNepCurriculumCategory(value: string): value is NepCurriculumCategory {
  return (NEP_CURRICULUM_CATEGORIES as readonly string[]).includes(value);
}

export function isAutoAssignedCategory(category: string): boolean {
  return ALWAYS_AUTO_ASSIGNED_CATEGORIES.has(category);
}

/** Compulsory categories excluded from elective picker UI. */
export const COMPULSORY_REGISTRATION_CATEGORIES = [
  'MAJOR',
  'MINOR',
  'INTERNSHIP',
  'DISSERTATION',
  'PROJECT',
  'RESEARCH',
] as const;
