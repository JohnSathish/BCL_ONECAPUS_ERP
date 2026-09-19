import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_APPEARANCE_CONFIG,
  mergeAppearanceConfig,
  type AppearanceConfig,
} from '@/lib/school-sis/appearance';
import type { ThemeMode } from '@/lib/school-sis/theme-tokens';

type SchoolThemeState = {
  preview: AppearanceConfig | null;
  published: AppearanceConfig | null;
  themeId: string;
  mode: ThemeMode;
  setPreview: (config: AppearanceConfig, themeId?: string) => void;
  clearPreview: () => void;
  setPublished: (
    config: AppearanceConfig,
    themeId?: string,
    mode?: ThemeMode,
    commit?: boolean,
  ) => void;
  setMode: (mode: ThemeMode) => void;
};

export const useSchoolThemeStore = create<SchoolThemeState>()(
  persist(
    (set) => ({
      preview: null,
      published: null,
      themeId: 'royal',
      mode: 'system',
      setPreview: (config, themeId) =>
        set((state) => ({
          preview: mergeAppearanceConfig(config),
          themeId: themeId || state.themeId,
        })),
      clearPreview: () => set({ preview: null }),
      setPublished: (config, themeId, mode, commit) =>
        set((state) => ({
          published: mergeAppearanceConfig(config),
          preview: commit ? null : state.preview,
          themeId: themeId || state.themeId,
          mode: mode || state.mode,
        })),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'sls-appearance-theme',
      partialize: (state) => ({
        published: state.published,
        themeId: state.themeId,
        mode: state.mode,
      }),
    },
  ),
);

export function resolveLiveAppearance(): AppearanceConfig {
  const state = useSchoolThemeStore.getState();
  return state.preview ?? state.published ?? DEFAULT_APPEARANCE_CONFIG;
}
