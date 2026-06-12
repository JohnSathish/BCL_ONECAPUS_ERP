/** Course/subject codes mistaken for programme codes (e.g. ECO-100, PHY-201). */
const COURSE_CODE_PATTERN = /^[A-Z]{2,4}-\d{3}$/;

export function looksLikeCourseCode(code: string): boolean {
  return COURSE_CODE_PATTERN.test(code.trim().toUpperCase());
}

export const PROGRAMME_CODE_COURSE_WARNING =
  'This looks like a course code. Did you mean to create a Course instead of a Programme?';
