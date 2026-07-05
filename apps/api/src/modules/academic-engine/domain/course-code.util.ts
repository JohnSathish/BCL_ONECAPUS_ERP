/**
 * NEHU / ERP standard course code: DEPT-### (e.g. ECO-100, EDN-150, MDC-117).
 * Accepts legacy variants (EDN:100, EDN : 100, EDN100) and normalizes to hyphen form.
 */

const NEHU_COURSE_CODE_PATTERN = /^[A-Z]{2,4}-\d{3}(?:\.\d+)?$/;

export function normalizeNehuCourseCode(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, '')
    .replace(/:/g, '-')
    .replace(/-+/g, '-');

  if (NEHU_COURSE_CODE_PATTERN.test(cleaned)) return cleaned;

  const hyphenated = cleaned.replace(
    /^([A-Z]{2,4})-?(\d{3}(?:\.\d+)?)$/,
    '$1-$2',
  );
  if (NEHU_COURSE_CODE_PATTERN.test(hyphenated)) return hyphenated;

  return cleaned;
}

export function isValidNehuCourseCode(raw: string): boolean {
  return NEHU_COURSE_CODE_PATTERN.test(normalizeNehuCourseCode(raw));
}

export function formatNehuCourseCode(
  deptCode: string,
  paperNumber: number | string,
) {
  const dept = deptCode.trim().toUpperCase();
  const num = String(paperNumber).trim();
  return normalizeNehuCourseCode(`${dept}-${num}`);
}
