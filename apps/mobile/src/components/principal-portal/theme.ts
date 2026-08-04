/** Executive command-center palette for Principal mobile */
export const principalTheme = {
  background: '#F1F5F9',
  surface: '#FFFFFF',
  primary: '#0F172A',
  primaryAccent: '#1D4ED8',
  primarySoft: '#EFF6FF',
  accent: '#059669',
  warning: '#D97706',
  urgent: '#DC2626',
  pending: '#CA8A04',
  info: '#0284C7',
  text: '#0F172A',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  border: '#E2E8F0',
  criticalBg: '#FEF2F2',
  highBg: '#FFF7ED',
  mediumBg: '#FEFCE8',
  lowBg: '#F0F9FF',
} as const;

export const severityColor: Record<string, string> = {
  critical: principalTheme.urgent,
  high: '#EA580C',
  medium: principalTheme.pending,
  low: principalTheme.info,
};

export const severityDot: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
};
