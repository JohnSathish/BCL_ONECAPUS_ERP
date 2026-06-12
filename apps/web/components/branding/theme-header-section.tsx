'use client';

import type { Control, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import type { AppThemeSettings } from '@/types/branding';
import { BrandingColorField } from './branding-color-field';
import { BrandingSectionCard } from './branding-section-card';
import { patchLayoutJson, syncThemeDraft } from './theme-section-utils';

type Props = {
  control: Control<AppThemeSettings>;
  watch: UseFormWatch<AppThemeSettings>;
  setValue: UseFormSetValue<AppThemeSettings>;
  disabled?: boolean;
};

export function ThemeHeaderSection({ control, watch, setValue, disabled }: Props) {
  const layout = watch('layoutJson') ?? {};

  const onTopbar = (value: string) => {
    setValue('topbarBg', value, { shouldDirty: true });
    syncThemeDraft({ topbarBg: value });
  };

  return (
    <BrandingSectionCard title="Header" description="Top bar background and title color.">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Controller
          name="topbarBg"
          control={control}
          render={({ field }) => (
            <BrandingColorField
              id="topbarBg"
              label="Background"
              value={field.value}
              disabled={disabled}
              onChange={onTopbar}
            />
          )}
        />
        <BrandingColorField
          id="headerText"
          label="Title text"
          value={layout.headerTextColor ?? '#0f172a'}
          disabled={disabled}
          onChange={(v) => patchLayoutJson('headerTextColor', v, layout, setValue)}
        />
      </div>
    </BrandingSectionCard>
  );
}
