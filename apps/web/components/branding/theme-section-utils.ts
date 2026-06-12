'use client';

import type { AppThemeSettings, ThemeLayoutOptions } from '@/types/branding';
import type { UseFormSetValue } from 'react-hook-form';
import { useThemeStore } from '@/lib/theme/theme-store';

export function syncThemeDraft(patch: Partial<AppThemeSettings>) {
  useThemeStore.getState().mergeDraft(patch);
}

export function patchLayoutJson(
  key: keyof ThemeLayoutOptions,
  value: unknown,
  layout: ThemeLayoutOptions,
  setValue: UseFormSetValue<AppThemeSettings>,
) {
  const next = { ...layout, [key]: value };
  setValue('layoutJson', next, { shouldDirty: true });
  syncThemeDraft({ layoutJson: next });
}
