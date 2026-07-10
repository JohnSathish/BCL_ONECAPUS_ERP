export type ProposalThemeId =
  | 'modern-blue'
  | 'professional-gray'
  | 'don-bosco'
  | 'corporate-navy'
  | 'minimal-white'
  | 'dark-presentation';

export type ProposalTheme = {
  id: ProposalThemeId;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  preview: string;
};

export const PROPOSAL_STUDIO_COLORS = {
  primary: '#1E40AF',
  accent: '#2563EB',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  background: '#F8FAFC',
} as const;

export const PROPOSAL_THEMES: ProposalTheme[] = [
  {
    id: 'modern-blue',
    label: 'Modern Blue',
    primary: '#1E40AF',
    secondary: '#2563EB',
    accent: '#3B82F6',
    preview: 'linear-gradient(135deg, #1E40AF, #2563EB)',
  },
  {
    id: 'professional-gray',
    label: 'Professional Gray',
    primary: '#374151',
    secondary: '#6B7280',
    accent: '#9CA3AF',
    preview: 'linear-gradient(135deg, #374151, #6B7280)',
  },
  {
    id: 'don-bosco',
    label: 'Don Bosco Theme',
    primary: '#1E40AF',
    secondary: '#16A34A',
    accent: '#22C55E',
    preview: 'linear-gradient(135deg, #1E40AF, #16A34A)',
  },
  {
    id: 'corporate-navy',
    label: 'Corporate Navy',
    primary: '#0F172A',
    secondary: '#1E40AF',
    accent: '#1D4ED8',
    preview: 'linear-gradient(135deg, #0F172A, #1E40AF)',
  },
  {
    id: 'minimal-white',
    label: 'Minimal White',
    primary: '#1F2937',
    secondary: '#9CA3AF',
    accent: '#D1D5DB',
    preview: 'linear-gradient(135deg, #F8FAFC, #E5E7EB)',
  },
  {
    id: 'dark-presentation',
    label: 'Dark Presentation',
    primary: '#1E293B',
    secondary: '#6366F1',
    accent: '#818CF8',
    preview: 'linear-gradient(135deg, #1E293B, #6366F1)',
  },
];

export function resolveTheme(themeId?: string): ProposalTheme {
  return PROPOSAL_THEMES.find((t) => t.id === themeId) ?? PROPOSAL_THEMES[0];
}
