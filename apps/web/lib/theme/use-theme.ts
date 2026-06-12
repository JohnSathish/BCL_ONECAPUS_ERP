'use client';

import { useThemeContext } from './theme-context';
import { useThemeStore, mergedTheme } from './theme-store';
import { useTheme as useNextTheme } from 'next-themes';
import { useCallback } from 'react';
import type { AppThemeSettings } from '@/types/branding';
import { updateUserAppearanceMode } from '@/services/user-preferences';

export function useTheme() {
  const ctx = useThemeContext();
  const { theme, draft } = useThemeStore();
  const { setTheme: setAppearance, resolvedTheme } = useNextTheme();

  const effectiveTheme = theme ? mergedTheme(theme, draft) : ctx.theme;

  const setSidebarColor = useCallback((sidebarBg: string) => {
    useThemeStore.getState().mergeDraft({ sidebarBg });
  }, []);

  const toggleDarkMode = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    void setAppearance(next);
    void updateUserAppearanceMode(next);
  }, [resolvedTheme, setAppearance]);

  const setThemeAppearance = useCallback(
    (mode: AppThemeSettings['appearanceMode']) => {
      void setAppearance(mode === 'system' ? 'system' : mode);
      void updateUserAppearanceMode(mode);
    },
    [setAppearance],
  );

  return {
    ...ctx,
    theme: effectiveTheme,
    setTheme: ctx.updateTheme,
    setSidebarColor,
    toggleDarkMode,
    setThemeAppearance,
    resetTheme: ctx.resetTheme,
    applyPreset: ctx.applyPreset,
  };
}
