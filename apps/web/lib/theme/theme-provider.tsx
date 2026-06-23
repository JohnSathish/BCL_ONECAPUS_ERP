'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useTheme as useNextTheme } from 'next-themes';
import {
  applyCssVariablesToRoot,
  applyCustomCss,
  applyThemeDomClasses,
  cacheThemePayload,
  clearInstitutionThemeVars,
  readCachedTheme,
  themeToCssVariables,
  withThemeTransition,
} from './css-variables';
import { mergedTheme } from './theme-store';
import { getPreset, resolvePresetId } from './default-themes';
import { ThemeContext, type ThemeContextValue } from './theme-context';
import { useThemeStore } from './theme-store';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import {
  applyThemePreset,
  exportThemeSettings,
  fetchThemeSettings,
  importThemeSettings,
  updateThemeSettings,
} from '@/services/branding';
import { fetchUserPreferences } from '@/services/user-preferences';
import type { AppThemeSettings } from '@/types/branding';
import { useAuthStore } from '@/store/auth-store';
import { useDashboardUiStore } from '@/store/dashboard-ui-store';
import { resolveBrandingAssetUrl } from '@/lib/branding-asset';

const MODULE_ROUTE_MATCHERS: Array<{ key: string; match: (path: string) => boolean }> = [
  {
    key: 'analytics',
    match: (path) => path.includes('/analytics') || path.includes('/ai-insights'),
  },
  {
    key: 'finance',
    match: (path) =>
      path.includes('/fees') || path.includes('/finance') || path.includes('/payroll'),
  },
  {
    key: 'studentPortal',
    match: (path) => path.startsWith('/student') || path.includes('/portal/student'),
  },
  {
    key: 'attendance',
    match: (path) => path.includes('/attendance') || path.includes('/biometric'),
  },
  {
    key: 'timetable',
    match: (path) => path.includes('/timetable') || path.includes('/teaching-allocation'),
  },
  { key: 'admin', match: (path) => path.startsWith('/admin') },
];

function withModuleThemeOverride(theme: AppThemeSettings, pathname: string): AppThemeSettings {
  const overrides = theme.layoutJson?.moduleThemeOverrides;
  if (!overrides) return theme;
  const moduleKey = MODULE_ROUTE_MATCHERS.find((item) => item.match(pathname))?.key;
  const overrideId = moduleKey ? overrides[moduleKey] : undefined;
  if (!overrideId) return theme;

  const preset = getPreset(resolvePresetId(overrideId));
  return {
    ...theme,
    themeName: preset.themeName,
    primaryColor: preset.primaryColor,
    accentColor: preset.accentColor,
    sidebarBg: preset.sidebarBg,
    sidebarText: preset.sidebarText,
    sidebarActive: preset.sidebarActive,
    topbarBg: preset.topbarBg,
    cardBg: preset.cardBg,
    borderColor: preset.borderColor,
    fontFamily: preset.fontFamily ?? theme.fontFamily,
    roundedStyle: preset.roundedStyle,
    layoutJson: {
      ...preset.layout,
      ...theme.layoutJson,
      moduleThemeOverrides: overrides,
    },
  };
}

function applyThemeToDom(
  theme: AppThemeSettings,
  brandingEnabled: boolean,
  isDark: boolean,
  faviconUrl?: string,
  portalTitle?: string,
) {
  const root = document.documentElement;
  if (!brandingEnabled) {
    clearInstitutionThemeVars(root);
    return;
  }
  withThemeTransition(() => {
    root.classList.add('institution-branded');
    applyCssVariablesToRoot(themeToCssVariables(theme, isDark), root);
    applyThemeDomClasses(theme, root);
    applyCustomCss(theme.customCss, Boolean(theme.customCssEnabled));
  });

  const faviconHref = resolveBrandingAssetUrl(faviconUrl);
  if (faviconHref) {
    let link = document.querySelector<HTMLLinkElement>('link[data-institution-favicon]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.setAttribute('data-institution-favicon', 'true');
      document.head.appendChild(link);
    }
    link.href = faviconHref;
  }
  if (portalTitle) {
    document.title = `${portalTitle} · Campus ERP`;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const tenantId = session?.user.tenantId ?? '';
  const {
    branding,
    active,
    canManageBranding,
    isFetched: brandingFetched,
  } = useInstitutionBranding();
  const { theme: nextTheme, resolvedTheme, setTheme: setNextTheme } = useNextTheme();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const setStoreTheme = useThemeStore((s) => s.setTheme);
  const draft = useThemeStore((s) => s.draft);
  const setSidebarCollapsed = useDashboardUiStore((s) => s.setSidebarCollapsed);
  const compactSidebarAppliedForThemeId = useRef<string | null>(null);
  const brandingFavicon = branding?.faviconUrl;
  const brandingTitle = branding?.shortName ?? branding?.displayName;

  const themeQuery = useQuery({
    queryKey: ['theme-settings', tenantId],
    queryFn: fetchThemeSettings,
    enabled: Boolean(session?.accessToken),
    staleTime: 5 * 60_000,
  });

  const userPrefsQuery = useQuery({
    queryKey: ['user-preferences', session?.user.id],
    queryFn: fetchUserPreferences,
    enabled: Boolean(session?.accessToken),
    staleTime: 5 * 60_000,
  });

  const theme = themeQuery.data ?? null;
  const userAppearance = userPrefsQuery.data?.appearanceMode;

  useEffect(() => {
    if (!theme) return;
    const store = useThemeStore.getState();
    if (store.theme?.id !== theme.id || store.theme?.themeName !== theme.themeName) {
      setStoreTheme(theme);
      cacheThemePayload(tenantId, theme);
    }
    if (
      theme.compactSidebar &&
      compactSidebarAppliedForThemeId.current !== theme.id &&
      !useDashboardUiStore.getState().sidebarCollapsed
    ) {
      setSidebarCollapsed(true);
      compactSidebarAppliedForThemeId.current = theme.id;
    }
  }, [theme, tenantId, setStoreTheme, setSidebarCollapsed]);

  useEffect(() => {
    if (!userAppearance || nextTheme === userAppearance) return;
    setNextTheme(userAppearance);
  }, [userAppearance, nextTheme, setNextTheme]);

  const effectiveTheme = useMemo(() => {
    if (!theme) return null;
    return withModuleThemeOverride(mergedTheme(theme, draft), pathname);
  }, [theme, draft, pathname]);

  useEffect(() => {
    if (!effectiveTheme) {
      return;
    }
    if (!active) {
      if (brandingFetched) clearInstitutionThemeVars();
      return;
    }
    applyThemeToDom(
      effectiveTheme,
      active,
      resolvedTheme === 'dark',
      brandingFavicon,
      brandingTitle,
    );
  }, [effectiveTheme, active, brandingFetched, resolvedTheme, brandingFavicon, brandingTitle]);

  useEffect(() => {
    if (!tenantId || theme) return;
    const cached = readCachedTheme(tenantId);
    if (cached && active) {
      applyThemeToDom(cached, true, resolvedTheme === 'dark', brandingFavicon, brandingTitle);
    }
  }, [tenantId, theme, active, resolvedTheme, brandingFavicon, brandingTitle]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['theme-settings'] });
    void queryClient.invalidateQueries({ queryKey: ['institution-branding'] });
    void queryClient.invalidateQueries({ queryKey: ['institution-branding-audit'] });
  }, [queryClient]);

  const { mutateAsync: updateThemeMutate } = useMutation({
    mutationFn: updateThemeSettings,
    onSuccess: (result) => {
      setStoreTheme(result);
      cacheThemePayload(tenantId, result);
      invalidate();
    },
  });

  const { mutateAsync: applyPresetMutate } = useMutation({
    mutationFn: applyThemePreset,
    onSuccess: (result) => {
      setStoreTheme(result);
      useThemeStore.getState().clearDraft();
      cacheThemePayload(tenantId, result);
      invalidate();
    },
  });

  const { mutateAsync: importThemeMutate } = useMutation({
    mutationFn: importThemeSettings,
    onSuccess: (result) => {
      setStoreTheme(result);
      cacheThemePayload(tenantId, result);
      invalidate();
    },
  });

  const applyPreset = useCallback(
    async (presetId: string) => {
      await applyPresetMutate(presetId);
    },
    [applyPresetMutate],
  );

  const updateTheme = useCallback(
    async (patch: Partial<AppThemeSettings>) => {
      await updateThemeMutate(patch);
    },
    [updateThemeMutate],
  );

  const resetTheme = useCallback(async () => {
    await applyPresetMutate('dbc-enterprise-blue');
  }, [applyPresetMutate]);

  const importTheme = useCallback(
    async (payload: Record<string, unknown>) => {
      await importThemeMutate(payload);
    },
    [importThemeMutate],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: effectiveTheme,
      active: Boolean(active && theme),
      canManage: canManageBranding,
      isLoading: themeQuery.isLoading,
      darkModeEnabled: theme?.darkModeEnabled ?? true,
      applyPreset,
      updateTheme,
      resetTheme,
      exportTheme: exportThemeSettings,
      importTheme,
    }),
    [
      effectiveTheme,
      active,
      theme,
      canManageBranding,
      themeQuery.isLoading,
      applyPreset,
      updateTheme,
      resetTheme,
      importTheme,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
