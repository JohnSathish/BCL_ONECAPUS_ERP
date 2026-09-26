/**
 * Temporary college-web visibility helpers for research / important links.
 * Header, hero, and footer ERP/App CTAs are controlled by CMS Quick Links.
 */

/** Detect ERP / Mobile App links so they can be filtered from research cards. */
export function isErpOrMobileAppLink(link: {
  id?: string;
  label?: string;
  href?: string;
}): boolean {
  const id = (link.id ?? '').toLowerCase();
  const label = (link.label ?? '').toLowerCase();
  const href = (link.href ?? '').toLowerCase();
  if (
    id === 'erp' ||
    id === 'mobile-app' ||
    id === 'mobileapp' ||
    id === 'android-app' ||
    id === 'ios-app'
  ) {
    return true;
  }
  if (
    label.includes('erp login') ||
    label === 'erp' ||
    label.includes('mobile app') ||
    label.includes('android app') ||
    label.includes('ios app')
  ) {
    return true;
  }
  if (
    href.includes('erp.donboscocollege') ||
    href.includes('play.google.com/store/apps') ||
    href.includes('apps.apple.com') ||
    href === '/erp' ||
    href.endsWith('/erp')
  ) {
    return true;
  }
  return false;
}

/** @deprecated Prefer CMS Quick Links `enabled` flags. Kept for older call sites. */
export const SHOW_ERP_AND_MOBILE_APP_CTAS = true;
