'use client';

import { createContext, useContext } from 'react';
import type { AppThemeSettings } from '@/types/branding';

export type ThemeContextValue = {
  theme: AppThemeSettings | null;
  active: boolean;
  canManage: boolean;
  isLoading: boolean;
  darkModeEnabled: boolean;
  applyPreset: (presetId: string) => Promise<void>;
  updateTheme: (patch: Partial<AppThemeSettings>) => Promise<void>;
  resetTheme: () => Promise<void>;
  exportTheme: () => Promise<object>;
  importTheme: (payload: object) => Promise<void>;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return ctx;
}
