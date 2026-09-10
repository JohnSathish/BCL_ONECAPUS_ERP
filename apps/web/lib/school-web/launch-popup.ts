export const SCHOOL_LAUNCH_FREQUENCIES = ['session', 'visit', 'day', 'once'] as const;
export type SchoolLaunchFrequency = (typeof SCHOOL_LAUNCH_FREQUENCIES)[number];

export const SCHOOL_LAUNCH_ANIMATIONS = ['fade-scale', 'fade-slide'] as const;
export type SchoolLaunchAnimation = (typeof SCHOOL_LAUNCH_ANIMATIONS)[number];

export const SCHOOL_LAUNCH_CTA_STYLES = ['gold', 'navy', 'outline'] as const;
export type SchoolLaunchCtaStyle = (typeof SCHOOL_LAUNCH_CTA_STYLES)[number];

export type SchoolLaunchPopupConfig = {
  enabled: boolean;
  kicker: string;
  title: string;
  subtitle: string;
  description: string;
  footerLine: string;
  locationLine: string;
  launchingLabel: string;
  logoUrl: string;
  imageUrl: string;
  imageAlt: string;
  launchAt: string | null;
  showAfterLaunch: boolean;
  ctaLabel: string;
  ctaHref: string;
  ctaStyle: SchoolLaunchCtaStyle;
  ctaNewTab: boolean;
  frequency: SchoolLaunchFrequency;
  animation: SchoolLaunchAnimation;
  closeButton: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown, fallback: string) {
  const next = String(value ?? '').trim();
  return next || fallback;
}

function freqOf(value: unknown): SchoolLaunchFrequency {
  const raw = String(value || '').trim();
  return (SCHOOL_LAUNCH_FREQUENCIES as readonly string[]).includes(raw)
    ? (raw as SchoolLaunchFrequency)
    : 'session';
}

function animOf(value: unknown): SchoolLaunchAnimation {
  const raw = String(value || '').trim();
  return (SCHOOL_LAUNCH_ANIMATIONS as readonly string[]).includes(raw)
    ? (raw as SchoolLaunchAnimation)
    : 'fade-scale';
}

function styleOf(value: unknown): SchoolLaunchCtaStyle {
  const raw = String(value || '').trim();
  return (SCHOOL_LAUNCH_CTA_STYLES as readonly string[]).includes(raw)
    ? (raw as SchoolLaunchCtaStyle)
    : 'gold';
}

export function defaultLaunchPopupPayload(): Omit<SchoolLaunchPopupConfig, 'enabled'> {
  return {
    kicker: 'COMING SOON',
    title: "A New Digital Home for St. Luke's Secondary School",
    subtitle: '',
    description:
      'We are preparing something special for our students, parents, teachers and school community. Our new website will bring you school news, events, notices, academic information, photo galleries, admissions updates and much more.',
    footerLine: "St. Luke's Secondary School",
    locationLine: 'Walbakgre, Tura, Meghalaya',
    launchingLabel: 'Launching Soon.',
    logoUrl: '/school-sis/st-lukes-logo.png',
    imageUrl: '/school-sis/slider/sl5.jpg',
    imageAlt: "St. Luke's Secondary School campus, Walbakgre",
    launchAt: null,
    showAfterLaunch: false,
    ctaLabel: 'Explore Our Website',
    ctaHref: '/',
    ctaStyle: 'gold',
    ctaNewTab: false,
    frequency: 'session',
    animation: 'fade-scale',
    closeButton: true,
  };
}

export function parseLaunchPopup(
  section: { enabled?: boolean; payload?: Record<string, unknown> } | undefined,
): SchoolLaunchPopupConfig {
  const defaults = defaultLaunchPopupPayload();
  if (!section) {
    return { enabled: true, ...defaults };
  }
  const bag = asRecord(section.payload);
  const launchRaw = String(bag.launchAt || '').trim();
  return {
    enabled: section.enabled !== false,
    kicker: str(bag.kicker, defaults.kicker),
    title: str(bag.title, defaults.title),
    subtitle: String(bag.subtitle ?? '').trim(),
    description: str(bag.description, defaults.description),
    footerLine: str(bag.footerLine, defaults.footerLine),
    locationLine: str(bag.locationLine, defaults.locationLine),
    launchingLabel: str(bag.launchingLabel, defaults.launchingLabel),
    logoUrl: str(bag.logoUrl, defaults.logoUrl),
    imageUrl: str(bag.imageUrl, defaults.imageUrl),
    imageAlt: str(bag.imageAlt, defaults.imageAlt),
    launchAt: launchRaw || null,
    showAfterLaunch: bag.showAfterLaunch === true,
    ctaLabel: str(bag.ctaLabel, defaults.ctaLabel),
    ctaHref: str(bag.ctaHref, defaults.ctaHref),
    ctaStyle: styleOf(bag.ctaStyle),
    ctaNewTab: bag.ctaNewTab === true,
    frequency: freqOf(bag.frequency),
    animation: animOf(bag.animation),
    closeButton: bag.closeButton !== false,
  };
}

export function launchPopupShouldDisplay(config: SchoolLaunchPopupConfig, now = Date.now()) {
  if (!config.enabled) return false;
  if (!config.launchAt) return true;
  const at = Date.parse(config.launchAt);
  if (!Number.isFinite(at)) return true;
  if (now < at) return true;
  return config.showAfterLaunch;
}

export function launchCountdownParts(launchAt: string | null, now = Date.now()) {
  if (!launchAt) return null;
  const at = Date.parse(launchAt);
  if (!Number.isFinite(at) || at <= now) return null;
  const total = Math.max(0, Math.floor((at - now) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export const LAUNCH_POPUP_STORAGE_KEY = 'sls-launch-popup';
