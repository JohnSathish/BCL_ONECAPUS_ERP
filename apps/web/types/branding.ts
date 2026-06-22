export type ThemeLayoutOptions = {
  glassEnabled?: boolean;
  shadowIntensity?: 'soft' | 'medium' | 'strong';
  cardDensity?: 'comfortable' | 'compact';
  tableDensity?: 'comfortable' | 'compact';
  headerTextColor?: string;
  buttonPrimaryHover?: string;
  buttonSecondaryBg?: string;
  buttonDestructiveBg?: string;
  tableHeaderBg?: string;
  tableRowHover?: string;
  spaciousMode?: boolean;
  executiveMode?: boolean;
  accessibilityMode?: 'high-contrast' | 'low-eye-strain' | 'colorblind-safe';
  moduleThemeOverrides?: Record<string, string>;
};

export type AppThemeSettings = {
  id?: string;
  tenantId?: string;
  themeName: string;
  primaryColor?: string;
  sidebarBg?: string;
  sidebarText?: string;
  sidebarActive?: string;
  topbarBg?: string;
  cardBg?: string;
  borderColor?: string;
  accentColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  darkModeEnabled: boolean;
  compactSidebar: boolean;
  roundedStyle: string;
  appearanceMode: 'light' | 'dark' | 'system';
  layoutJson: ThemeLayoutOptions;
  customCss?: string;
  customCssEnabled?: boolean;
  /** Merged from TenantBranding on GET /theme */
  displayName?: string;
  brandingEnabled?: boolean;
};

export type ThemePresetSummary = {
  id: string;
  label: string;
  primaryColor: string;
  sidebarBg: string;
  accentColor?: string;
  category?: string;
  purpose?: string;
  mood?: string;
};

export type UserPreferences = {
  appearanceMode: 'light' | 'dark' | 'system';
};

export type InstitutionBranding = {
  displayName: string;
  shortName?: string;
  campusName?: string;
  portalSubtitle?: string;
  address?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  sidebarColor?: string;
  loginBackgroundStyle: 'gradient' | 'solid' | 'mesh';
  showPoweredBy: boolean;
  brandingEnabled: boolean;
  badges: string[];
  portalExtras?: {
    careersPortal?: {
      principalName?: string;
      principalTitle?: string;
      principalMessage?: string;
      principalPhotoUrl?: string;
      heroImages?: string[];
    };
  };
};

export type BrandingAuditEntry = {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: string;
  user: { email: string } | null;
};

export const ACCREDITATION_PRESETS = [
  'Affiliated to NEHU',
  'North Eastern Hill University',
  'Autonomous Institution',
  'NAAC A+',
  'NAAC A',
  'NIRF Ranked',
  'UGC Recognized',
  'ISO Certified',
] as const;

export const LOGIN_BACKGROUND_OPTIONS = [
  { value: 'gradient', label: 'Enterprise gradient' },
  { value: 'mesh', label: 'Mesh pattern' },
  { value: 'solid', label: 'Solid brand color' },
] as const;
