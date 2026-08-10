/**
 * Temporary college-web visibility toggles.
 * Flip to `true` when ERP Login / Mobile App CTAs should show again
 * (header, mobile drawer, footer, and related quick links).
 */
export const SHOW_ERP_AND_MOBILE_APP_CTAS = false;

/** Detect ERP / Mobile App links so they can be filtered while the flag is off. */
export function isErpOrMobileAppLink(link: {
  id?: string;
  label?: string;
  href?: string;
}): boolean {
  const id = (link.id ?? '').toLowerCase();
  const label = (link.label ?? '').toLowerCase();
  const href = (link.href ?? '').toLowerCase();
  if (id === 'erp' || id === 'mobile-app' || id === 'mobileapp') return true;
  if (label.includes('erp login') || label === 'erp' || label.includes('mobile app')) return true;
  if (
    href.includes('erp.donboscocollege') ||
    href.includes('play.google.com/store/apps') ||
    href === '/erp' ||
    href.endsWith('/erp')
  ) {
    return true;
  }
  return false;
}
