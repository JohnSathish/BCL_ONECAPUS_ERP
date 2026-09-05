/** Tura Public School ERP visual tokens — school institution, not college. */
export const SCHOOL_ERP_THEME = {
  primary: '#1b4d3e',
  primaryDeep: '#0f241c',
  primaryHover: '#14382d',
  accent: '#c5a572',
  accentSoft: '#e8d9bf',
  page: '#f3f6f4',
  card: '#ffffff',
  border: 'rgba(27, 77, 62, 0.12)',
  text: '#0f1f1a',
  muted: '#5b6b64',
  success: '#1a7f4b',
  warning: '#b45309',
  danger: '#b42318',
  info: '#1d4f91',
} as const;

export const SCHOOL_ERP_CSS_VARS: Record<string, string> = {
  '--school-erp-primary': SCHOOL_ERP_THEME.primary,
  '--school-erp-primary-deep': SCHOOL_ERP_THEME.primaryDeep,
  '--school-erp-primary-hover': SCHOOL_ERP_THEME.primaryHover,
  '--school-erp-accent': SCHOOL_ERP_THEME.accent,
  '--school-erp-page': SCHOOL_ERP_THEME.page,
  '--school-erp-card': SCHOOL_ERP_THEME.card,
  '--school-erp-border': SCHOOL_ERP_THEME.border,
  '--school-erp-text': SCHOOL_ERP_THEME.text,
  '--school-erp-muted': SCHOOL_ERP_THEME.muted,
};
