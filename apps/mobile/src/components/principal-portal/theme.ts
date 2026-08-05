/** Principal mobile dashboard — polished executive palette matching product mock */
export const principalTheme = {
  background: '#F4F6FB',
  surface: '#FFFFFF',
  hero: '#1E3A8A',
  heroDeep: '#152A66',
  heroSoft: '#2D4CB8',
  primary: '#0F172A',
  primaryAccent: '#2D3EAD',
  primarySoft: '#EEF2FF',
  accent: '#10B981',
  warning: '#F59E0B',
  urgent: '#EF4444',
  pending: '#F97316',
  info: '#3B82F6',
  teal: '#14B8A6',
  purple: '#8B5CF6',
  orange: '#F97316',
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textOnHero: '#FFFFFF',
  textOnHeroMuted: 'rgba(255,255,255,0.78)',
  border: '#E5EAF2',
  criticalBg: '#FEF2F2',
  highBg: '#FFF7ED',
  mediumBg: '#FEFCE8',
  lowBg: '#EFF6FF',
  cardShadow: 'rgba(15, 23, 42, 0.06)',
} as const;

export const severityColor: Record<string, string> = {
  critical: principalTheme.urgent,
  high: principalTheme.pending,
  medium: principalTheme.warning,
  low: principalTheme.info,
};

export const severityDot: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
};
