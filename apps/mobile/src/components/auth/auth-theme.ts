export const authTheme = {
  primary: '#1E40AF',
  primaryDark: '#1e3a8a',
  primaryLight: '#2563EB',
  accent: '#F59E0B',
  gradient: ['#1e3a8a', '#1E40AF', '#2563EB'] as const,
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    inputBg: '#ffffff',
  },
  dark: {
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    border: '#334155',
    inputBg: '#1e293b',
  },
} as const;

export type AuthColorScheme = 'light' | 'dark';

export function authColors(scheme: AuthColorScheme) {
  return {
    ...authTheme,
    ...(scheme === 'dark' ? authTheme.dark : authTheme.light),
  };
}
