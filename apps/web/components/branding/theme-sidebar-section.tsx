'use client';

import type { Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import type { AppThemeSettings } from '@/types/branding';
import { BrandingColorField } from './branding-color-field';
import { BrandingSectionCard } from './branding-section-card';
import { syncThemeDraft } from './theme-section-utils';

type Props = {
  control: Control<AppThemeSettings>;
  watch: UseFormWatch<AppThemeSettings>;
  setValue: UseFormSetValue<AppThemeSettings>;
  disabled?: boolean;
};

export function ThemeSidebarSection({ control, watch, setValue, disabled }: Props) {
  const onChange = (field: keyof AppThemeSettings, value: string) => {
    setValue(field, value, { shouldDirty: true });
    syncThemeDraft({ [field]: value });
  };

  return (
    <BrandingSectionCard title="Sidebar" description="Navigation shell colors and active states.">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Controller
          name="sidebarBg"
          control={control}
          render={({ field }) => (
            <BrandingColorField
              id="sidebarBg"
              label="Background"
              value={field.value}
              disabled={disabled}
              onChange={(v) => onChange('sidebarBg', v)}
            />
          )}
        />
        <Controller
          name="sidebarText"
          control={control}
          render={({ field }) => (
            <BrandingColorField
              id="sidebarText"
              label="Text"
              value={field.value}
              disabled={disabled}
              onChange={(v) => onChange('sidebarText', v)}
            />
          )}
        />
        <Controller
          name="sidebarActive"
          control={control}
          render={({ field }) => (
            <BrandingColorField
              id="sidebarActive"
              label="Active item"
              value={field.value}
              disabled={disabled}
              onChange={(v) => onChange('sidebarActive', v)}
            />
          )}
        />
        <Controller
          name="borderColor"
          control={control}
          render={({ field }) => (
            <BrandingColorField
              id="sidebarBorder"
              label="Border"
              value={field.value}
              disabled={disabled}
              onChange={(v) => onChange('borderColor', v)}
            />
          )}
        />
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 rounded border-border"
          checked={watch('compactSidebar') ?? false}
          disabled={disabled}
          onChange={(e) => {
            setValue('compactSidebar', e.target.checked, { shouldDirty: true });
            syncThemeDraft({ compactSidebar: e.target.checked });
          }}
        />
        <span>
          <span className="block text-sm font-medium">Compact sidebar</span>
          <span className="text-xs text-muted-foreground">Collapse sidebar by default</span>
        </span>
      </label>
    </BrandingSectionCard>
  );
}
