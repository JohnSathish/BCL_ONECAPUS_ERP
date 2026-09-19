'use client';

import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { DEFAULT_APPEARANCE_CONFIG, type AppearanceConfig } from '@/lib/school-sis/appearance';
import {
  appearanceToCssVars,
  applyCssVarsToElement,
  resolveThemeMode,
} from '@/lib/school-sis/theme-tokens';
import { useSchoolThemeStore } from '@/store/school-theme-store';

export function useResolvedSchoolTheme(
  config?: AppearanceConfig | null,
  publishedThemeId?: string,
) {
  const preview = useSchoolThemeStore((s) => s.preview);
  const published = useSchoolThemeStore((s) => s.published);
  const storedThemeId = useSchoolThemeStore((s) => s.themeId);
  const mode = useSchoolThemeStore((s) => s.mode);
  const resolved = preview ?? published ?? config ?? DEFAULT_APPEARANCE_CONFIG;
  const id = preview ? storedThemeId : publishedThemeId || storedThemeId || 'royal';
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolvedMode = resolveThemeMode(mode, prefersDark);
  const vars = useMemo(
    () =>
      appearanceToCssVars(resolved, {
        themeId: id,
        mode: resolvedMode,
        sidebarWidth: resolved.sidebar.width,
        fontFamily: resolved.typography.fontFamily,
        radius: resolved.components.cardRadius,
      }),
    [resolved, id, resolvedMode],
  );
  return { config: resolved, themeId: id, mode: resolvedMode, vars };
}

export function SchoolThemeProvider({
  children,
  enabled,
  config,
  themeId,
}: {
  children: ReactNode;
  enabled: boolean;
  config?: AppearanceConfig | null;
  themeId?: string;
}) {
  const { vars, mode } = useResolvedSchoolTheme(config, themeId);

  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    applyCssVarsToElement(root, vars);
    root.classList.toggle('dark', mode === 'dark');
    root.dataset.slsTheme = '1';
  }, [enabled, vars, mode]);

  return children;
}
