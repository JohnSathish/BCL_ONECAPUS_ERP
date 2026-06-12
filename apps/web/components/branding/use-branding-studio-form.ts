'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { resolveBrandingAssetUrl } from '@/lib/branding-asset';
import { useThemeStore } from '@/lib/theme/theme-store';
import {
  applyThemePreset,
  updateInstitutionBranding,
  updateThemeSettings,
  uploadInstitutionFavicon,
  uploadInstitutionLogo,
} from '@/services/branding';
import type { AppThemeSettings, InstitutionBranding } from '@/types/branding';
import { toPreviewSnapshot } from './branding-preview-types';

export type BrandingFormValues = InstitutionBranding;
export type ThemeFormValues = AppThemeSettings;

export type StudioTab =
  | 'branding'
  | 'sidebar'
  | 'header'
  | 'typography'
  | 'cards'
  | 'tables'
  | 'buttons'
  | 'layout'
  | 'appearance'
  | 'customCss';

export function useBrandingStudioForm(
  initialData: InstitutionBranding | undefined,
  initialTheme: AppThemeSettings | undefined,
) {
  const queryClient = useQueryClient();
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [faviconPreview, setFaviconPreview] = useState<string | undefined>();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StudioTab>('branding');
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const setStoreTheme = useThemeStore((s) => s.setTheme);
  const clearDraft = useThemeStore((s) => s.clearDraft);

  const brandingForm = useForm<BrandingFormValues>({
    defaultValues: initialData,
  });

  const themeForm = useForm<ThemeFormValues>({
    defaultValues: initialTheme,
  });

  const { register, handleSubmit, reset, watch, setValue, control, formState } = brandingForm;
  const themeRegister = themeForm.register;
  const themeWatch = themeForm.watch;
  const themeSetValue = themeForm.setValue;
  const themeControl = themeForm.control;
  const themeFormState = themeForm.formState;

  useEffect(() => {
    if (initialData) {
      reset(initialData);
      setLogoPreview(resolveBrandingAssetUrl(initialData.logoUrl));
      setFaviconPreview(resolveBrandingAssetUrl(initialData.faviconUrl));
    }
  }, [initialData, reset]);

  useEffect(() => {
    if (initialTheme) {
      themeForm.reset(initialTheme);
      setStoreTheme(initialTheme);
      clearDraft();
    }
  }, [initialTheme, themeForm, setStoreTheme, clearDraft]);

  const isDirty = formState.isDirty || themeFormState.isDirty;

  useUnsavedChangesGuard({
    isDirty,
    message: 'You have unsaved theme or branding changes. Leave anyway?',
  });

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['institution-branding'] });
    void queryClient.invalidateQueries({ queryKey: ['institution-branding-audit'] });
    void queryClient.invalidateQueries({ queryKey: ['theme-settings'] });
  }, [queryClient]);

  const saveBrandingMutation = useMutation({
    mutationFn: updateInstitutionBranding,
    onSuccess: (result) => {
      reset(result);
    },
  });

  const saveThemeMutation = useMutation({
    mutationFn: updateThemeSettings,
    onSuccess: (result) => {
      themeForm.reset(result);
      setStoreTheme(result);
      clearDraft();
    },
  });

  const logoMutation = useMutation({
    mutationFn: uploadInstitutionLogo,
    onSuccess: (result) => {
      setLogoPreview(resolveBrandingAssetUrl(result.logoUrl));
      invalidateAll();
    },
  });

  const faviconMutation = useMutation({
    mutationFn: uploadInstitutionFavicon,
    onSuccess: (result) => {
      setFaviconPreview(resolveBrandingAssetUrl(result.faviconUrl));
      invalidateAll();
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const themeValues = themeForm.getValues();
    await Promise.all([
      saveBrandingMutation.mutateAsync({
        displayName: values.displayName,
        shortName: values.shortName,
        campusName: values.campusName,
        portalSubtitle: values.portalSubtitle,
        address: values.address,
        primaryColor: themeValues.primaryColor ?? values.primaryColor,
        accentColor: themeValues.accentColor ?? values.accentColor,
        sidebarColor: themeValues.sidebarBg ?? values.sidebarColor,
        loginBackgroundStyle: values.loginBackgroundStyle,
        showPoweredBy: values.showPoweredBy,
        brandingEnabled: values.brandingEnabled,
        badges: values.badges,
      }),
      saveThemeMutation.mutateAsync({
        themeName: themeValues.themeName,
        primaryColor: themeValues.primaryColor,
        accentColor: themeValues.accentColor,
        sidebarBg: themeValues.sidebarBg,
        sidebarText: themeValues.sidebarText,
        sidebarActive: themeValues.sidebarActive,
        topbarBg: themeValues.topbarBg,
        cardBg: themeValues.cardBg,
        borderColor: themeValues.borderColor,
        fontFamily: themeValues.fontFamily,
        darkModeEnabled: themeValues.darkModeEnabled,
        compactSidebar: themeValues.compactSidebar,
        roundedStyle: themeValues.roundedStyle,
        appearanceMode: themeValues.appearanceMode,
        layoutJson: themeValues.layoutJson,
        customCss: themeValues.customCss,
        customCssEnabled: themeValues.customCssEnabled,
      }),
    ]);
    setSaveSuccess(true);
    invalidateAll();
    window.setTimeout(() => setSaveSuccess(false), 4000);
  });

  const applyPreset = useCallback(
    async (presetId: string) => {
      if (!window.confirm(`Apply "${presetId}" preset? This updates all theme tokens.`)) return;
      setApplyingPreset(presetId);
      try {
        const result = await applyThemePreset(presetId);
        themeForm.reset(result);
        setStoreTheme(result);
        clearDraft();
        if (initialData) {
          reset({
            ...initialData,
            primaryColor: result.primaryColor,
            accentColor: result.accentColor,
            sidebarColor: result.sidebarBg,
          });
        }
        invalidateAll();
      } finally {
        setApplyingPreset(null);
      }
    },
    [themeForm, setStoreTheme, clearDraft, initialData, reset, invalidateAll],
  );

  const resetToServer = useCallback(() => {
    if (isDirty && !window.confirm('Discard unsaved changes and reset to last saved settings?')) {
      return;
    }
    if (initialData) {
      reset(initialData);
      setLogoPreview(resolveBrandingAssetUrl(initialData.logoUrl));
      setFaviconPreview(resolveBrandingAssetUrl(initialData.faviconUrl));
    }
    if (initialTheme) {
      themeForm.reset(initialTheme);
      setStoreTheme(initialTheme);
      clearDraft();
    }
  }, [isDirty, initialData, initialTheme, reset, themeForm, setStoreTheme, clearDraft]);

  const values = watch();
  const previewSnapshot = toPreviewSnapshot(values, logoPreview, faviconPreview);
  const isSaving = saveBrandingMutation.isPending || saveThemeMutation.isPending;

  return {
    register,
    control,
    watch,
    setValue,
    formState: { ...formState, isDirty },
    themeRegister,
    themeControl,
    themeWatch,
    themeSetValue,
    themeFormState,
    onSubmit,
    saveMutation: { isPending: isSaving },
    logoMutation,
    faviconMutation,
    logoPreview,
    faviconPreview,
    setLogoPreview,
    setFaviconPreview,
    saveSuccess,
    previewOpen,
    setPreviewOpen,
    previewSnapshot,
    resetToServer,
    activeTab,
    setActiveTab,
    applyPreset,
    applyingPreset,
    initialTheme,
    invalidateAll,
  };
}
