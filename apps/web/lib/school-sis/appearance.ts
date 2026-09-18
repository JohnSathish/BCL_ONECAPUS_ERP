export const APPEARANCE_THEME_PRESETS = [
  { id: 'aurora', name: 'Aurora', primary: '#4F46E5', secondary: '#7C3AED', accent: '#06B6D4' },
  { id: 'midnight', name: 'Midnight', primary: '#1E3A5F', secondary: '#334155', accent: '#38BDF8' },
  { id: 'ocean', name: 'Ocean', primary: '#0369A1', secondary: '#0E7490', accent: '#22D3EE' },
  { id: 'royal', name: 'Royal', primary: '#1A365D', secondary: '#2B4C7E', accent: '#0EA5E9' },
  { id: 'emerald', name: 'Emerald', primary: '#047857', secondary: '#0F766E', accent: '#34D399' },
  { id: 'crimson', name: 'Crimson', primary: '#BE123C', secondary: '#9F1239', accent: '#FB7185' },
  { id: 'minimal', name: 'Minimal', primary: '#18181B', secondary: '#3F3F46', accent: '#A1A1AA' },
  { id: 'glass', name: 'Glass', primary: '#312E81', secondary: '#4338CA', accent: '#A5B4FC' },
  { id: 'cyber', name: 'Cyber', primary: '#0F172A', secondary: '#1D4ED8', accent: '#22D3EE' },
  { id: 'custom', name: 'Custom', primary: '#4F46E5', secondary: '#7C3AED', accent: '#06B6D4' },
] as const;

export type AppearanceConfig = {
  identity: {
    institutionName: string;
    shortName: string;
    applicationName: string;
    tagline: string;
    browserTitle: string;
    footerCopyright: string;
    loginLogoUrl: string | null;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    background: string;
    surface: string;
    border: string;
    text: string;
    muted: string;
    contrastOverride: boolean;
  };
  login: {
    layout: 'centered' | 'split' | 'full' | 'minimal' | 'glass';
    background: 'solid' | 'gradient' | 'image' | 'video' | 'animated' | 'abstract';
    overlay: number;
    blur: number;
    brightness: number;
    position: string;
    cardWidth: number;
    cardRadius: number;
    cardShadow: string;
    cardTransparency: number;
    logoSize: number;
    inputStyle: string;
    buttonStyle: string;
    welcome: string;
    subtitle: string;
    buttonLabel: string;
    forgotLabel: string;
    footer: string;
    imageUrl: string | null;
  };
  sidebar: {
    style: 'classic' | 'compact' | 'floating' | 'glass' | 'minimal';
    position: 'left' | 'right';
    width: number;
    collapsible: boolean;
    autoCollapse: boolean;
    remember: boolean;
    showLabels: boolean;
    showIcons: boolean;
    showDividers: boolean;
    showBadges: boolean;
    sticky: boolean;
    iconSize: number;
    textSize: number;
    activeStyle: string;
    hoverStyle: string;
    radius: number;
    spacing: number;
  };
  typography: {
    fontFamily: string;
    googleFont: string;
    pageHeading: number;
    sectionHeading: number;
    cardHeading: number;
    body: number;
    small: number;
    caption: number;
    button: number;
  };
  dashboard: {
    layout: 'grid' | 'executive' | 'minimal' | 'analytics' | 'academic';
    welcome: boolean;
    stats: boolean;
    quickActions: boolean;
    activity: boolean;
    announcements: boolean;
    calendar: boolean;
    notifications: boolean;
    attendance: boolean;
    fees: boolean;
    performance: boolean;
    cardStyle: 'flat' | 'elevated' | 'glass' | 'gradient' | 'border';
  };
  components: {
    buttonRadius: number;
    buttonSize: string;
    buttonShadow: boolean;
    buttonGradient: boolean;
    buttonHover: boolean;
    cardRadius: number;
    cardBorder: boolean;
    cardShadow: boolean;
    cardBlur: boolean;
    inputRadius: number;
    inputHeight: number;
    tableDensity: string;
    tableZebra: boolean;
    tableHover: boolean;
    badgeShape: 'rounded' | 'pill' | 'square';
  };
  dark: {
    background: string;
    surface: string;
    cards: string;
    text: string;
    muted: string;
    border: string;
    primary: string;
    sidebar: string;
    header: string;
  };
  mobile: {
    bottomNav: boolean;
    headerHeight: number;
    fontScale: number;
    cardStack: boolean;
    compactTables: boolean;
  };
  a11y: {
    highContrast: boolean;
    reducedMotion: boolean;
    largerText: boolean;
    focusIndicators: boolean;
    keyboardNav: boolean;
    colorBlind: boolean;
  };
};

export const DEFAULT_APPEARANCE_CONFIG: AppearanceConfig = {
  identity: {
    institutionName: "St. Luke's Secondary School",
    shortName: 'SLS Tura',
    applicationName: "St. Luke's School ERP",
    tagline: 'Knowledge · Service · Light',
    browserTitle: "St. Luke's School | ERP",
    footerCopyright: `© ${new Date().getFullYear()} St. Luke's Secondary School`,
    loginLogoUrl: null,
  },
  colors: {
    primary: '#1A365D',
    secondary: '#2B4C7E',
    accent: '#0EA5E9',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#0284C7',
    background: '#F4F7FB',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    text: '#0F172A',
    muted: '#64748B',
    contrastOverride: false,
  },
  login: {
    layout: 'split',
    background: 'gradient',
    overlay: 40,
    blur: 8,
    brightness: 100,
    position: 'center',
    cardWidth: 420,
    cardRadius: 18,
    cardShadow: 'lg',
    cardTransparency: 92,
    logoSize: 72,
    inputStyle: 'underline',
    buttonStyle: 'solid',
    welcome: 'Welcome Back',
    subtitle: 'Sign in to continue to your dashboard',
    buttonLabel: 'Sign In',
    forgotLabel: 'Forgot Password?',
    footer: `© ${new Date().getFullYear()} St. Luke's Secondary School`,
    imageUrl: null,
  },
  sidebar: {
    style: 'classic',
    position: 'left',
    width: 260,
    collapsible: true,
    autoCollapse: false,
    remember: true,
    showLabels: true,
    showIcons: true,
    showDividers: true,
    showBadges: true,
    sticky: true,
    iconSize: 16,
    textSize: 13,
    activeStyle: 'fill',
    hoverStyle: 'soft',
    radius: 10,
    spacing: 4,
  },
  typography: {
    fontFamily: 'Inter',
    googleFont: '',
    pageHeading: 28,
    sectionHeading: 20,
    cardHeading: 16,
    body: 14,
    small: 12,
    caption: 11,
    button: 14,
  },
  dashboard: {
    layout: 'grid',
    welcome: true,
    stats: true,
    quickActions: true,
    activity: true,
    announcements: true,
    calendar: true,
    notifications: true,
    attendance: true,
    fees: true,
    performance: true,
    cardStyle: 'elevated',
  },
  components: {
    buttonRadius: 12,
    buttonSize: 'md',
    buttonShadow: true,
    buttonGradient: false,
    buttonHover: true,
    cardRadius: 16,
    cardBorder: true,
    cardShadow: true,
    cardBlur: false,
    inputRadius: 10,
    inputHeight: 40,
    tableDensity: 'comfortable',
    tableZebra: true,
    tableHover: true,
    badgeShape: 'pill',
  },
  dark: {
    background: '#0B1220',
    surface: '#111827',
    cards: '#1E293B',
    text: '#F8FAFC',
    muted: '#94A3B8',
    border: '#334155',
    primary: '#818CF8',
    sidebar: '#0F172A',
    header: '#111827',
  },
  mobile: {
    bottomNav: true,
    headerHeight: 56,
    fontScale: 100,
    cardStack: true,
    compactTables: true,
  },
  a11y: {
    highContrast: false,
    reducedMotion: false,
    largerText: false,
    focusIndicators: true,
    keyboardNav: true,
    colorBlind: false,
  },
};

const HEX = /^#([0-9a-fA-F]{6})$/;

export function isHexColor(value: string) {
  return HEX.test(value.trim());
}

function channel(n: number) {
  const v = n / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function hexToRgb(hex: string) {
  const m = HEX.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function contrastRatio(a: string, b: string) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function wcagLabel(ratio: number) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

export function mixHex(hex: string, toward: string, amount: number) {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  const t = Math.min(1, Math.max(0, amount));
  const n = (k: 'r' | 'g' | 'b') => Math.round(a[k] + (b[k] - a[k]) * t);
  return `#${[n('r'), n('g'), n('b')].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function paletteFrom(hex: string) {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  return steps.map((step) => {
    if (step === 500) return { step, hex };
    if (step < 500) return { step, hex: mixHex(hex, '#FFFFFF', (500 - step) / 500) };
    return { step, hex: mixHex(hex, '#0F172A', (step - 500) / 500) };
  });
}

export function sanitizeAppearanceCss(raw: string) {
  const css = String(raw ?? '')
    .slice(0, 24_000)
    .replace(/<[^>]*>/g, '');
  if (
    /expression\s*\(|javascript\s*:|behavior\s*:|@import|url\s*\(\s*['"]?\s*data:|<\/?script/i.test(
      css,
    )
  ) {
    throw new Error('Custom CSS contains a blocked rule');
  }
  return css;
}

export function mergeAppearanceConfig(input?: Partial<AppearanceConfig> | null): AppearanceConfig {
  const base = DEFAULT_APPEARANCE_CONFIG;
  if (!input) return structuredClone(base);
  return {
    identity: { ...base.identity, ...input.identity },
    colors: { ...base.colors, ...input.colors },
    login: { ...base.login, ...input.login },
    sidebar: { ...base.sidebar, ...input.sidebar },
    typography: { ...base.typography, ...input.typography },
    dashboard: { ...base.dashboard, ...input.dashboard },
    components: { ...base.components, ...input.components },
    dark: { ...base.dark, ...input.dark },
    mobile: { ...base.mobile, ...input.mobile },
    a11y: { ...base.a11y, ...input.a11y },
  };
}

export function accessibilityScore(cfg: AppearanceConfig) {
  const text = contrastRatio(cfg.colors.text, cfg.colors.background);
  const button = contrastRatio('#FFFFFF', cfg.colors.primary);
  const muted = contrastRatio(cfg.colors.muted, cfg.colors.background);
  let score = 40;
  if (text >= 4.5) score += 18;
  if (text >= 7) score += 8;
  if (button >= 4.5) score += 16;
  if (muted >= 3) score += 8;
  if (cfg.a11y.focusIndicators) score += 5;
  if (cfg.a11y.keyboardNav) score += 5;
  if (!cfg.a11y.reducedMotion) score -= 4;
  return Math.max(0, Math.min(100, score));
}
