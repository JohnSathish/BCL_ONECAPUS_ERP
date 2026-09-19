import type { CSSProperties } from 'react';
import {
  APPEARANCE_THEME_PRESETS,
  DEFAULT_APPEARANCE_CONFIG,
  hexToRgb,
  mixHex,
  relativeLuminance,
  rgbToHsl,
  type AppearanceConfig,
} from '@/lib/school-sis/appearance';

export const SCHOOL_THEME_STORAGE_KEY = 'sls-appearance-theme';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeTokenSet = {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  background: string;
  surface: string;
  surfaceHover: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarHover: string;
  sidebarActive: string;
  sidebarActiveForeground: string;
  border: string;
  inputBorder: string;
  muted: string;
  mutedForeground: string;
  text: string;
  heading: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  focusRing: string;
  buttonPrimary: string;
  buttonPrimaryHover: string;
  buttonSecondary: string;
  buttonSecondaryHover: string;
};

type PresetSurfaces = {
  background: string;
  surface: string;
  text: string;
  heading: string;
  muted: string;
  border: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarHover: string;
  sidebarActive: string;
  sidebarActiveForeground: string;
};

const LIGHT_SURFACES: Record<string, PresetSurfaces> = {
  aurora: {
    background: '#F5F3FF',
    surface: '#FFFFFF',
    text: '#1E1B4B',
    heading: '#312E81',
    muted: '#6366F1',
    border: '#E0E7FF',
    sidebarBackground: '#FFFFFF',
    sidebarForeground: '#312E81',
    sidebarHover: '#F5F3FF',
    sidebarActive: '#EEF2FF',
    sidebarActiveForeground: '#4F46E5',
  },
  midnight: {
    background: '#F1F5F9',
    surface: '#FFFFFF',
    text: '#0F172A',
    heading: '#1E3A5F',
    muted: '#64748B',
    border: '#E2E8F0',
    sidebarBackground: '#0F172A',
    sidebarForeground: '#E2E8F0',
    sidebarHover: '#1E293B',
    sidebarActive: '#1D4ED8',
    sidebarActiveForeground: '#FFFFFF',
  },
  ocean: {
    background: '#F0F9FF',
    surface: '#FFFFFF',
    text: '#0C4A6E',
    heading: '#075985',
    muted: '#0284C7',
    border: '#BAE6FD',
    sidebarBackground: '#FFFFFF',
    sidebarForeground: '#0C4A6E',
    sidebarHover: '#E0F2FE',
    sidebarActive: '#E0F2FE',
    sidebarActiveForeground: '#0369A1',
  },
  royal: {
    background: '#F4F7FB',
    surface: '#FFFFFF',
    text: '#0F172A',
    heading: '#1A365D',
    muted: '#64748B',
    border: '#E2E8F0',
    sidebarBackground: '#FFFFFF',
    sidebarForeground: '#0F172A',
    sidebarHover: '#F1F7FC',
    sidebarActive: '#E8F4FD',
    sidebarActiveForeground: '#1A365D',
  },
  emerald: {
    background: '#F0FDF4',
    surface: '#FFFFFF',
    text: '#064E3B',
    heading: '#065F46',
    muted: '#047857',
    border: '#BBF7D0',
    sidebarBackground: '#FFFFFF',
    sidebarForeground: '#064E3B',
    sidebarHover: '#ECFDF5',
    sidebarActive: '#D1FAE5',
    sidebarActiveForeground: '#047857',
  },
  crimson: {
    background: '#FFF1F2',
    surface: '#FFFFFF',
    text: '#4C0519',
    heading: '#9F1239',
    muted: '#BE123C',
    border: '#FECDD3',
    sidebarBackground: '#FFFFFF',
    sidebarForeground: '#4C0519',
    sidebarHover: '#FFF1F2',
    sidebarActive: '#FFE4E6',
    sidebarActiveForeground: '#BE123C',
  },
  minimal: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#18181B',
    heading: '#09090B',
    muted: '#71717A',
    border: '#E4E4E7',
    sidebarBackground: '#FFFFFF',
    sidebarForeground: '#18181B',
    sidebarHover: '#F4F4F5',
    sidebarActive: '#F4F4F5',
    sidebarActiveForeground: '#18181B',
  },
  glass: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#1E1B4B',
    heading: '#312E81',
    muted: '#6366F1',
    border: '#E0E7FF',
    sidebarBackground: '#F8FAFC',
    sidebarForeground: '#312E81',
    sidebarHover: '#EEF2FF',
    sidebarActive: '#EEF2FF',
    sidebarActiveForeground: '#4338CA',
  },
  cyber: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#0F172A',
    heading: '#0F172A',
    muted: '#64748B',
    border: '#E2E8F0',
    sidebarBackground: '#0F172A',
    sidebarForeground: '#E2E8F0',
    sidebarHover: '#1E293B',
    sidebarActive: '#22D3EE',
    sidebarActiveForeground: '#0F172A',
  },
  custom: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    text: '#0F172A',
    heading: '#1E1B4B',
    muted: '#64748B',
    border: '#E2E8F0',
    sidebarBackground: '#FFFFFF',
    sidebarForeground: '#0F172A',
    sidebarHover: '#F1F5F9',
    sidebarActive: '#EEF2FF',
    sidebarActiveForeground: '#4F46E5',
  },
};

const DARK_SURFACES: Record<string, PresetSurfaces> = {
  aurora: {
    background: '#0B1020',
    surface: '#14182B',
    text: '#EEF2FF',
    heading: '#E0E7FF',
    muted: '#A5B4FC',
    border: '#312E81',
    sidebarBackground: '#0F1224',
    sidebarForeground: '#E0E7FF',
    sidebarHover: '#1E1B4B',
    sidebarActive: '#4F46E5',
    sidebarActiveForeground: '#FFFFFF',
  },
  midnight: {
    background: '#020617',
    surface: '#0F172A',
    text: '#F8FAFC',
    heading: '#F8FAFC',
    muted: '#94A3B8',
    border: '#1E293B',
    sidebarBackground: '#020617',
    sidebarForeground: '#E2E8F0',
    sidebarHover: '#1E293B',
    sidebarActive: '#38BDF8',
    sidebarActiveForeground: '#0F172A',
  },
  ocean: {
    background: '#082F49',
    surface: '#0C4A6E',
    text: '#E0F2FE',
    heading: '#F0F9FF',
    muted: '#7DD3FC',
    border: '#075985',
    sidebarBackground: '#082F49',
    sidebarForeground: '#E0F2FE',
    sidebarHover: '#0C4A6E',
    sidebarActive: '#22D3EE',
    sidebarActiveForeground: '#082F49',
  },
  royal: {
    background: '#0B1220',
    surface: '#111827',
    text: '#F8FAFC',
    heading: '#F8FAFC',
    muted: '#94A3B8',
    border: '#334155',
    sidebarBackground: '#0F172A',
    sidebarForeground: '#E2E8F0',
    sidebarHover: '#1E293B',
    sidebarActive: '#0EA5E9',
    sidebarActiveForeground: '#0F172A',
  },
  emerald: {
    background: '#022C22',
    surface: '#064E3B',
    text: '#ECFDF5',
    heading: '#D1FAE5',
    muted: '#6EE7B7',
    border: '#065F46',
    sidebarBackground: '#022C22',
    sidebarForeground: '#ECFDF5',
    sidebarHover: '#064E3B',
    sidebarActive: '#34D399',
    sidebarActiveForeground: '#022C22',
  },
  crimson: {
    background: '#4C0519',
    surface: '#881337',
    text: '#FFF1F2',
    heading: '#FFE4E6',
    muted: '#FDA4AF',
    border: '#9F1239',
    sidebarBackground: '#4C0519',
    sidebarForeground: '#FFF1F2',
    sidebarHover: '#881337',
    sidebarActive: '#FB7185',
    sidebarActiveForeground: '#4C0519',
  },
  minimal: {
    background: '#09090B',
    surface: '#18181B',
    text: '#FAFAFA',
    heading: '#FAFAFA',
    muted: '#A1A1AA',
    border: '#27272A',
    sidebarBackground: '#09090B',
    sidebarForeground: '#FAFAFA',
    sidebarHover: '#27272A',
    sidebarActive: '#3F3F46',
    sidebarActiveForeground: '#FAFAFA',
  },
  glass: {
    background: '#0B1020',
    surface: '#1E1B4B',
    text: '#EEF2FF',
    heading: '#E0E7FF',
    muted: '#A5B4FC',
    border: '#312E81',
    sidebarBackground: '#111827',
    sidebarForeground: '#E0E7FF',
    sidebarHover: '#312E81',
    sidebarActive: '#4338CA',
    sidebarActiveForeground: '#FFFFFF',
  },
  cyber: {
    background: '#020617',
    surface: '#0F172A',
    text: '#F8FAFC',
    heading: '#22D3EE',
    muted: '#67E8F9',
    border: '#1E293B',
    sidebarBackground: '#020617',
    sidebarForeground: '#E2E8F0',
    sidebarHover: '#1E293B',
    sidebarActive: '#22D3EE',
    sidebarActiveForeground: '#020617',
  },
  custom: {
    background: '#0B1220',
    surface: '#111827',
    text: '#F8FAFC',
    heading: '#F8FAFC',
    muted: '#94A3B8',
    border: '#334155',
    sidebarBackground: '#0F172A',
    sidebarForeground: '#E2E8F0',
    sidebarHover: '#1E293B',
    sidebarActive: '#818CF8',
    sidebarActiveForeground: '#0F172A',
  },
};

function foregroundOn(hex: string) {
  return relativeLuminance(hex) > 0.45 ? '#0F172A' : '#FFFFFF';
}

export function hexToHslTriplet(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return `${h} ${s}% ${l}%`;
}

function surfacesFor(themeId: string, mode: 'light' | 'dark'): PresetSurfaces {
  const table = mode === 'dark' ? DARK_SURFACES : LIGHT_SURFACES;
  return table[themeId] ?? table.royal;
}

export function buildThemeTokens(
  cfg: AppearanceConfig,
  opts?: { themeId?: string; mode?: 'light' | 'dark' },
): ThemeTokenSet {
  const themeId = opts?.themeId ?? 'custom';
  const mode = opts?.mode ?? 'light';
  const primary = mode === 'dark' ? cfg.dark.primary || cfg.colors.primary : cfg.colors.primary;
  const secondary = cfg.colors.secondary;
  const accent = cfg.colors.accent;
  const surfaces =
    themeId === 'custom'
      ? {
          background: mode === 'dark' ? cfg.dark.background : cfg.colors.background,
          surface: mode === 'dark' ? cfg.dark.surface : cfg.colors.surface,
          text: mode === 'dark' ? cfg.dark.text : cfg.colors.text,
          heading: mode === 'dark' ? cfg.dark.text : cfg.colors.text,
          muted: mode === 'dark' ? cfg.dark.muted : cfg.colors.muted,
          border: mode === 'dark' ? cfg.dark.border : cfg.colors.border,
          sidebarBackground: mode === 'dark' ? cfg.dark.sidebar : cfg.colors.surface,
          sidebarForeground: mode === 'dark' ? cfg.dark.text : cfg.colors.text,
          sidebarHover: mixHex(
            mode === 'dark' ? cfg.dark.sidebar : cfg.colors.surface,
            primary,
            0.22,
          ),
          sidebarActive: mixHex(
            mode === 'dark' ? cfg.dark.sidebar : cfg.colors.surface,
            primary,
            0.18,
          ),
          sidebarActiveForeground: primary,
        }
      : surfacesFor(themeId, mode);

  const success = cfg.colors.success;
  const warning = cfg.colors.warning;
  const danger = cfg.colors.danger;
  const info = cfg.colors.info;
  const primaryHover = mixHex(primary, mode === 'dark' ? '#FFFFFF' : '#0F172A', 0.16);
  const primaryActive = mixHex(primary, '#0F172A', 0.28);
  const buttonSecondary = mixHex(surfaces.surface, primary, 0.08);
  const buttonSecondaryHover = mixHex(surfaces.surface, primary, 0.14);

  return {
    primary,
    primaryHover,
    primaryActive,
    primaryForeground: foregroundOn(primary),
    secondary,
    secondaryForeground: foregroundOn(secondary),
    accent,
    accentForeground: foregroundOn(accent),
    background: surfaces.background,
    surface: surfaces.surface,
    surfaceHover: mixHex(surfaces.surface, primary, 0.06),
    sidebarBackground: surfaces.sidebarBackground,
    sidebarForeground: surfaces.sidebarForeground,
    sidebarHover: surfaces.sidebarHover,
    sidebarActive: surfaces.sidebarActive,
    sidebarActiveForeground: surfaces.sidebarActiveForeground,
    border: surfaces.border,
    inputBorder: mixHex(surfaces.border, primary, 0.12),
    muted: mixHex(surfaces.surface, surfaces.muted, 0.18),
    mutedForeground: surfaces.muted,
    text: surfaces.text,
    heading: surfaces.heading,
    success,
    warning,
    danger,
    info,
    focusRing: mixHex(accent || primary, '#FFFFFF', 0.35),
    buttonPrimary: primary,
    buttonPrimaryHover: primaryHover,
    buttonSecondary,
    buttonSecondaryHover,
  };
}

export function applyThemePreset(themeId: string, config: AppearanceConfig): AppearanceConfig {
  const preset = APPEARANCE_THEME_PRESETS.find((t) => t.id === themeId);
  if (!preset) return config;
  const light = surfacesFor(themeId, 'light');
  const dark = surfacesFor(themeId, 'dark');
  return {
    ...config,
    colors: {
      ...config.colors,
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
      background: light.background,
      surface: light.surface,
      border: light.border,
      text: light.text,
      muted: light.muted,
    },
    dark: {
      ...config.dark,
      background: dark.background,
      surface: dark.surface,
      cards: dark.surface,
      text: dark.text,
      muted: dark.muted,
      border: dark.border,
      primary: mixHex(preset.primary, '#FFFFFF', 0.28),
      sidebar: dark.sidebarBackground,
      header: dark.surface,
    },
  };
}

export function resolveThemeMode(
  mode: ThemeMode | string | undefined,
  prefersDark?: boolean,
): 'light' | 'dark' {
  if (mode === 'dark' || mode === 'light') return mode;
  return prefersDark ? 'dark' : 'light';
}

function clampSidebarPx(raw: unknown) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 200) return 260;
  return Math.min(360, Math.round(n));
}

export function themeTokensToCssVars(
  tokens: ThemeTokenSet,
  extras?: { sidebarWidth?: number; fontFamily?: string; radius?: number },
): CSSProperties {
  const sidebarPx = clampSidebarPx(extras?.sidebarWidth);
  const vars: Record<string, string> = {
    '--primary-hex': tokens.primary,
    '--primary-hover': tokens.primaryHover,
    '--primary-active': tokens.primaryActive,
    '--primary-foreground-hex': tokens.primaryForeground,
    '--secondary-hex': tokens.secondary,
    '--secondary-foreground': tokens.secondaryForeground,
    '--accent-hex': tokens.accent,
    '--accent-foreground-hex': tokens.accentForeground,
    '--background-hex': tokens.background,
    '--surface': tokens.surface,
    '--surface-hover': tokens.surfaceHover,
    '--sidebar-background': tokens.sidebarBackground,
    '--sidebar-foreground': tokens.sidebarForeground,
    '--sidebar-hover': tokens.sidebarHover,
    '--sidebar-hover-foreground': foregroundOn(tokens.sidebarHover),
    '--sidebar-active': tokens.sidebarActive,
    '--sidebar-active-foreground': foregroundOn(tokens.sidebarActive),
    '--border-hex': tokens.border,
    '--input-border': tokens.inputBorder,
    '--muted-hex': tokens.muted,
    '--muted-foreground-hex': tokens.mutedForeground,
    '--text': tokens.text,
    '--heading': tokens.heading,
    '--success-hex': tokens.success,
    '--warning-hex': tokens.warning,
    '--danger-hex': tokens.danger,
    '--info': tokens.info,
    '--focus-ring': tokens.focusRing,
    '--button-primary': tokens.buttonPrimary,
    '--button-primary-hover': tokens.buttonPrimaryHover,
    '--button-secondary': tokens.buttonSecondary,
    '--button-secondary-hover': tokens.buttonSecondaryHover,
    '--school-erp-primary': tokens.primary,
    '--school-erp-primary-hover': tokens.primaryHover,
    '--school-erp-primary-deep': tokens.primaryActive,
    '--school-erp-accent': tokens.accent,
    '--school-erp-page': tokens.background,
    '--school-erp-card': tokens.surface,
    '--school-erp-border': tokens.border,
    '--school-erp-text': tokens.text,
    '--school-erp-muted': tokens.mutedForeground,
    '--school-erp-sidebar-width': `${sidebarPx}px`,
    '--primary': hexToHslTriplet(tokens.primary),
    '--primary-foreground': hexToHslTriplet(tokens.primaryForeground),
    '--secondary': hexToHslTriplet(tokens.secondary),
    '--accent': hexToHslTriplet(tokens.accent),
    '--accent-foreground': hexToHslTriplet(tokens.accentForeground),
    '--background': hexToHslTriplet(tokens.background),
    '--foreground': hexToHslTriplet(tokens.text),
    '--card': hexToHslTriplet(tokens.surface),
    '--card-foreground': hexToHslTriplet(tokens.text),
    '--muted': hexToHslTriplet(tokens.muted),
    '--muted-foreground': hexToHslTriplet(tokens.mutedForeground),
    '--border': hexToHslTriplet(tokens.border),
    '--ring': hexToHslTriplet(tokens.accent),
    '--sidebar': hexToHslTriplet(tokens.sidebarBackground),
    '--sidebar-muted': hexToHslTriplet(tokens.mutedForeground),
    '--sidebar-border': hexToHslTriplet(tokens.border),
    '--sidebar-active-bg': hexToHslTriplet(tokens.sidebarActive),
    '--topbar-bg': hexToHslTriplet(tokens.surface),
    '--header-bg': hexToHslTriplet(tokens.surface),
    '--header-text': hexToHslTriplet(tokens.heading),
    '--card-bg': hexToHslTriplet(tokens.surface),
    '--card-border': hexToHslTriplet(tokens.border),
    '--table-header-bg': hexToHslTriplet(mixHex(tokens.surface, tokens.primary, 0.08)),
    '--table-row-hover': hexToHslTriplet(tokens.surfaceHover),
    '--table-border': hexToHslTriplet(tokens.border),
    '--button-primary-bg': hexToHslTriplet(tokens.buttonPrimary),
    '--button-primary-hover': hexToHslTriplet(tokens.buttonPrimaryHover),
    '--button-secondary-bg': hexToHslTriplet(tokens.buttonSecondary),
    '--success': hexToHslTriplet(tokens.success),
    '--warning': hexToHslTriplet(tokens.warning),
    '--danger': hexToHslTriplet(tokens.danger),
    '--radius': `${extras?.radius ?? 16}px`,
  };
  return {
    ...vars,
    color: tokens.text,
    backgroundColor: tokens.background,
    fontFamily: extras?.fontFamily,
  } as CSSProperties;
}

export function appearanceToCssVars(
  cfg: AppearanceConfig | undefined,
  extras?: {
    sidebarWidth?: number;
    fontFamily?: string;
    radius?: number;
    themeId?: string;
    mode?: 'light' | 'dark';
  },
): CSSProperties {
  const config = cfg ?? DEFAULT_APPEARANCE_CONFIG;
  const tokens = buildThemeTokens(config, {
    themeId: extras?.themeId,
    mode: extras?.mode,
  });
  return themeTokensToCssVars(tokens, {
    sidebarWidth: extras?.sidebarWidth ?? config.sidebar.width,
    fontFamily: extras?.fontFamily ?? config.typography.fontFamily,
    radius: extras?.radius ?? config.components.cardRadius,
  });
}

export function applyCssVarsToElement(el: HTMLElement | null | undefined, vars: CSSProperties) {
  if (!el) return;
  for (const [key, value] of Object.entries(vars)) {
    if (!key.startsWith('--') || typeof value !== 'string') continue;
    el.style.setProperty(key, value);
  }
}

export function themeCardSwatches(themeId: string) {
  const preset = APPEARANCE_THEME_PRESETS.find((t) => t.id === themeId);
  const light = surfacesFor(themeId, 'light');
  return {
    primary: preset?.primary ?? light.heading,
    secondary: preset?.secondary ?? light.muted,
    accent: preset?.accent ?? light.sidebarActive,
    sidebar: light.sidebarBackground,
    sidebarActive: light.sidebarActive,
    button: preset?.primary ?? light.sidebarActiveForeground,
    background: light.background,
  };
}
