/** CMS-controlled ERP / app / explore CTAs for college-web header + hero. */

export type WebsiteQuickLink = {
  enabled: boolean;
  label: string;
  href: string;
  openInNewTab: boolean;
};

export type WebsiteQuickLinks = {
  erpLogin: WebsiteQuickLink;
  androidApp: WebsiteQuickLink;
  iosApp: WebsiteQuickLink;
  exploreProgrammes: WebsiteQuickLink;
};

export type WebsiteQuickLinkKey = keyof WebsiteQuickLinks;

export const DEFAULT_WEBSITE_QUICK_LINKS: WebsiteQuickLinks = {
  erpLogin: {
    enabled: true,
    label: 'ERP Login',
    href: 'https://erp.donboscocollege.ac.in/login',
    openInNewTab: true,
  },
  androidApp: {
    enabled: true,
    label: 'Android App',
    href: 'https://play.google.com/store/apps/details?id=edu.onecampus.mobile&utm_source=chatgpt.com',
    openInNewTab: true,
  },
  iosApp: {
    enabled: true,
    label: 'iOS App',
    href: 'https://apps.apple.com/in/app/don-bosco-college-tura/id6798552213',
    openInNewTab: true,
  },
  exploreProgrammes: {
    enabled: true,
    label: 'Explore Programmes',
    href: '/academics/programmes',
    openInNewTab: false,
  },
};

export const WEBSITE_QUICK_LINK_META: Array<{
  key: WebsiteQuickLinkKey;
  title: string;
  description: string;
  showInHeader: boolean;
  showInHero: boolean;
}> = [
  {
    key: 'erpLogin',
    title: 'ERP Login',
    description: 'Staff and student campus portal',
    showInHeader: true,
    showInHero: true,
  },
  {
    key: 'androidApp',
    title: 'Android App',
    description: 'Google Play Store listing',
    showInHeader: true,
    showInHero: true,
  },
  {
    key: 'iosApp',
    title: 'iOS App',
    description: 'Apple App Store listing',
    showInHeader: true,
    showInHero: true,
  },
  {
    key: 'exploreProgrammes',
    title: 'Explore Programmes',
    description: 'Hero CTA only (programmes catalogue)',
    showInHeader: false,
    showInHero: true,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Allow http(s), mailto, tel, or site-relative paths starting with /. */
export function isValidWebsiteQuickLinkHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (/^(mailto|tel):/i.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isExternalWebsiteHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim()) || href.trim().startsWith('//');
}

export function normalizeWebsiteQuickLink(
  value: unknown,
  fallback: WebsiteQuickLink,
): WebsiteQuickLink {
  const source = isRecord(value) ? value : {};
  const label =
    typeof source.label === 'string' && source.label.trim() ? source.label.trim() : fallback.label;
  const href =
    typeof source.href === 'string' && source.href.trim() ? source.href.trim() : fallback.href;
  const enabled =
    typeof source.enabled === 'boolean'
      ? source.enabled
      : typeof source.visible === 'boolean'
        ? source.visible
        : fallback.enabled;
  const openInNewTab =
    typeof source.openInNewTab === 'boolean'
      ? source.openInNewTab
      : typeof source.newTab === 'boolean'
        ? source.newTab
        : isExternalWebsiteHref(href)
          ? true
          : fallback.openInNewTab;
  return { enabled, label, href, openInNewTab };
}

export function normalizeWebsiteQuickLinks(value: unknown): WebsiteQuickLinks {
  const source = isRecord(value) ? value : {};
  const defaults = DEFAULT_WEBSITE_QUICK_LINKS;

  // Legacy single "mobileApp" → Android when androidApp missing.
  const androidSource = source.androidApp ?? source.mobileApp;
  // Legacy onlineAdmission / hero secondary never become header ERP/app buttons.
  return {
    erpLogin: normalizeWebsiteQuickLink(source.erpLogin, defaults.erpLogin),
    androidApp: normalizeWebsiteQuickLink(androidSource, defaults.androidApp),
    iosApp: normalizeWebsiteQuickLink(source.iosApp, defaults.iosApp),
    exploreProgrammes: normalizeWebsiteQuickLink(
      source.exploreProgrammes,
      defaults.exploreProgrammes,
    ),
  };
}

export function listVisibleWebsiteQuickLinks(
  links: WebsiteQuickLinks,
  placement: 'header' | 'hero',
): Array<{ key: WebsiteQuickLinkKey; link: WebsiteQuickLink }> {
  return WEBSITE_QUICK_LINK_META.filter((meta) =>
    placement === 'header' ? meta.showInHeader : meta.showInHero,
  )
    .map((meta) => ({ key: meta.key, link: links[meta.key] }))
    .filter(
      ({ link }) =>
        link.enabled && Boolean(link.label.trim()) && isValidWebsiteQuickLinkHref(link.href),
    );
}
