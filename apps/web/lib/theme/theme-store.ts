'use client';

import { create } from 'zustand';
import type { AppThemeSettings } from '@/types/branding';

type ThemeStore = {
  theme: AppThemeSettings | null;
  draft: Partial<AppThemeSettings> | null;
  setTheme: (theme: AppThemeSettings) => void;
  setDraft: (patch: Partial<AppThemeSettings> | null) => void;
  mergeDraft: (patch: Partial<AppThemeSettings>) => void;
  clearDraft: () => void;
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: null,
  draft: null,
  setTheme: (theme) => set({ theme, draft: null }),
  setDraft: (draft) => set({ draft }),
  mergeDraft: (patch) => {
    const base = get().theme;
    if (!base) return;
    set({ draft: { ...(get().draft ?? {}), ...patch } });
  },
  clearDraft: () => set({ draft: null }),
}));

export function mergedTheme(
  theme: AppThemeSettings,
  draft: Partial<AppThemeSettings> | null,
): AppThemeSettings {
  if (!draft) return theme;
  return {
    ...theme,
    ...draft,
    layoutJson: { ...theme.layoutJson, ...(draft.layoutJson ?? {}) },
  };
}
