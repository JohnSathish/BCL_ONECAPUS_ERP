/**
 * Shorten known verbose NEHU Sem-5 internship course titles for display.
 */
const LONG_INTERNSHIP_TITLE =
  /^Internship\s*\/\s*Apprenticeship\s*\/\s*Community Engagement and Service(?:\s*\/\s*Field Based Learning or Minor Project)?$/i;

export function formatCourseDisplayTitle(title?: string | null): string {
  const raw = String(title ?? '').trim();
  if (!raw) return '';
  if (LONG_INTERNSHIP_TITLE.test(raw)) return 'Internship';
  return raw;
}
