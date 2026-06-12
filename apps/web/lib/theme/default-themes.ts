export type ThemeLayoutOptions = {
  glassEnabled: boolean;
  shadowIntensity: 'soft' | 'medium' | 'strong';
  cardDensity: 'comfortable' | 'compact';
  tableDensity: 'comfortable' | 'compact';
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

export type ThemeTokenSet = {
  themeName: string;
  label: string;
  category?:
    | 'Corporate'
    | 'Education'
    | 'Executive'
    | 'Dark'
    | 'Minimal'
    | 'Futuristic'
    | 'Accessibility';
  purpose?: string;
  mood?: string;
  primaryColor: string;
  accentColor: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarActive: string;
  topbarBg: string;
  cardBg: string;
  borderColor: string;
  successColor?: string;
  warningColor?: string;
  errorColor?: string;
  fontFamily?: string;
  roundedStyle: string;
  layout: ThemeLayoutOptions;
};

export const DEFAULT_LAYOUT: ThemeLayoutOptions = {
  glassEnabled: true,
  shadowIntensity: 'soft',
  cardDensity: 'comfortable',
  tableDensity: 'comfortable',
};

/** Legacy preset ids → current ids */
export const PRESET_ALIASES: Record<string, string> = {
  'dbc-classic': 'dbc-enterprise-blue',
  'modern-indigo': 'indigo-pro',
  'midnight-erp': 'midnight-executive',
  midnight: 'midnight-executive',
  'slate-professional': 'slate-pro-enterprise',
  'slate-erp': 'slate-pro-enterprise',
  'minimal-light': 'apple-workspace',
  'corporate-gray': 'slate-pro-enterprise',
  'emerald-campus': 'emerald-campus-pro',
  'indigo-pro': 'cyber-indigo-pro',
};

export const THEME_PRESETS: Record<string, ThemeTokenSet> = {
  'dbc-enterprise-blue': {
    themeName: 'dbc-enterprise-blue',
    label: 'DBC Enterprise Blue',
    category: 'Corporate',
    purpose: 'Recommended default for college and corporate ERP operations',
    mood: 'Modern Corporate SaaS',
    primaryColor: '#2563EB',
    accentColor: '#0EA5E9',
    sidebarBg: '#1E293B',
    sidebarText: '#E2E8F0',
    sidebarActive: '#2563EB',
    topbarBg: '#F8FAFC',
    cardBg: '#FFFFFF',
    borderColor: '#E2E8F0',
    successColor: '#16A34A',
    warningColor: '#D97706',
    errorColor: '#DC2626',
    fontFamily: 'Inter, system-ui, sans-serif',
    roundedStyle: 'xl',
    layout: DEFAULT_LAYOUT,
  },
  'apple-workspace': {
    themeName: 'apple-workspace',
    label: 'Apple Workspace',
    category: 'Minimal',
    purpose: 'Clean premium workspace for long-hour staff usage',
    mood: 'Luxury Clean SaaS',
    primaryColor: '#111827',
    accentColor: '#3B82F6',
    sidebarBg: '#FFFFFF',
    sidebarText: '#374151',
    sidebarActive: '#E5E7EB',
    topbarBg: '#F5F7FA',
    cardBg: '#FFFFFF',
    borderColor: '#E5E7EB',
    successColor: '#16A34A',
    warningColor: '#D97706',
    errorColor: '#DC2626',
    fontFamily: 'Inter, system-ui, sans-serif',
    roundedStyle: 'xl',
    layout: { ...DEFAULT_LAYOUT, glassEnabled: false, shadowIntensity: 'soft' },
  },
  'midnight-executive': {
    themeName: 'midnight-executive',
    label: 'Midnight Executive',
    category: 'Dark',
    purpose: 'Premium dark enterprise control center for analytics and AI modules',
    mood: 'CIO / CTO Control Center',
    primaryColor: '#3B82F6',
    accentColor: '#06B6D4',
    sidebarBg: '#111827',
    sidebarText: '#E5E7EB',
    sidebarActive: '#3B82F6',
    topbarBg: '#0B1120',
    cardBg: '#172033',
    borderColor: '#263244',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    fontFamily: 'Inter, system-ui, sans-serif',
    roundedStyle: 'xl',
    layout: { ...DEFAULT_LAYOUT, glassEnabled: true, shadowIntensity: 'strong' },
  },
  'slate-pro-enterprise': {
    themeName: 'slate-pro-enterprise',
    label: 'Slate Pro Enterprise',
    category: 'Corporate',
    purpose: 'Serious operations theme for tables, audit logs, attendance, payroll, and finance',
    mood: 'Operations Console',
    primaryColor: '#334155',
    accentColor: '#2563EB',
    sidebarBg: '#1E293B',
    sidebarText: '#F1F5F9',
    sidebarActive: '#334155',
    topbarBg: '#F8FAFC',
    cardBg: '#FFFFFF',
    borderColor: '#CBD5E1',
    successColor: '#059669',
    warningColor: '#D97706',
    errorColor: '#DC2626',
    fontFamily: 'Inter, system-ui, sans-serif',
    roundedStyle: 'lg',
    layout: {
      ...DEFAULT_LAYOUT,
      glassEnabled: false,
      cardDensity: 'compact',
      tableDensity: 'compact',
    },
  },
  'emerald-campus-pro': {
    themeName: 'emerald-campus-pro',
    label: 'Emerald Campus Pro',
    category: 'Education',
    purpose: 'Academic and student-facing institutional experience',
    mood: 'Academic / Institutional',
    primaryColor: '#059669',
    accentColor: '#14B8A6',
    sidebarBg: '#064E3B',
    sidebarText: '#D1FAE5',
    sidebarActive: '#059669',
    topbarBg: '#F0FDF4',
    cardBg: '#FFFFFF',
    borderColor: '#BBF7D0',
    successColor: '#16A34A',
    warningColor: '#CA8A04',
    errorColor: '#DC2626',
    fontFamily: 'Inter, system-ui, sans-serif',
    roundedStyle: 'lg',
    layout: DEFAULT_LAYOUT,
  },
  'neo-glass-enterprise': {
    themeName: 'neo-glass-enterprise',
    label: 'Neo Glass Enterprise',
    category: 'Futuristic',
    purpose: 'Futuristic campus OS theme for demos, AI dashboards, and premium branding',
    mood: 'Future Campus OS',
    primaryColor: '#4F46E5',
    accentColor: '#06B6D4',
    sidebarBg: '#312E81',
    sidebarText: '#EEF2FF',
    sidebarActive: '#6366F1',
    topbarBg: '#EEF2FF',
    cardBg: '#FFFFFF',
    borderColor: '#C7D2FE',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    fontFamily: 'Inter, system-ui, sans-serif',
    roundedStyle: '2xl',
    layout: { ...DEFAULT_LAYOUT, glassEnabled: true, shadowIntensity: 'medium' },
  },
  'cyber-indigo-pro': {
    themeName: 'cyber-indigo-pro',
    label: 'Cyber Indigo Pro',
    category: 'Futuristic',
    purpose: 'AI, innovation, predictive analytics, and smart dashboard theme',
    mood: 'AI / Innovation SaaS',
    primaryColor: '#4F46E5',
    accentColor: '#7C3AED',
    sidebarBg: '#1E1B4B',
    sidebarText: '#EDE9FE',
    sidebarActive: '#4F46E5',
    topbarBg: '#F5F3FF',
    cardBg: '#FFFFFF',
    borderColor: '#DDD6FE',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    fontFamily: 'Inter, system-ui, sans-serif',
    roundedStyle: 'xl',
    layout: { ...DEFAULT_LAYOUT, shadowIntensity: 'medium' },
  },
  'carbon-black-enterprise': {
    themeName: 'carbon-black-enterprise',
    label: 'Carbon Black Enterprise',
    category: 'Executive',
    purpose: 'Premium executive dashboard and monitoring theme',
    mood: 'Executive Data Command',
    primaryColor: '#2563EB',
    accentColor: '#22C55E',
    sidebarBg: '#09090B',
    sidebarText: '#FAFAFA',
    sidebarActive: '#2563EB',
    topbarBg: '#09090B',
    cardBg: '#18181B',
    borderColor: '#27272A',
    successColor: '#22C55E',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',
    fontFamily: 'Inter, system-ui, sans-serif',
    roundedStyle: 'xl',
    layout: {
      ...DEFAULT_LAYOUT,
      glassEnabled: false,
      shadowIntensity: 'strong',
      tableDensity: 'compact',
    },
  },
};

export const DEFAULT_PRESET_ID = 'dbc-enterprise-blue';

export function resolvePresetId(id: string): string {
  return PRESET_ALIASES[id] ?? id;
}

export function getPreset(id: string): ThemeTokenSet {
  const resolved = resolvePresetId(id);
  return THEME_PRESETS[resolved] ?? THEME_PRESETS[DEFAULT_PRESET_ID]!;
}

export const PRESET_LIST = Object.values(THEME_PRESETS);
