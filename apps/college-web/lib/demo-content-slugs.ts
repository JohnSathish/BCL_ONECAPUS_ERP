/** Placeholder notices/testimonials — never show as live public content. */
export const DEMO_WEBSITE_CONTENT_SLUGS = new Set([
  'ug-admission-2026-open',
  'internal-assessment-schedule',
  'iqac-meeting-notice',
  'thangboi-singto',
  'dorang-dekamra-m-sangma',
  'subhankar-paul',
  'jemina-sangma',
  'anita-marak',
  'ricky-sangma',
  'larisa-ch-marak',
  'nangrak-momin',
]);

export function isDemoWebsiteContentSlug(slug: string | null | undefined) {
  if (!slug) return false;
  return DEMO_WEBSITE_CONTENT_SLUGS.has(slug.trim().toLowerCase());
}
