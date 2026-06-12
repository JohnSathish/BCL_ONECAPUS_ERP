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

export function ThemeButtonsSection({ control, watch, setValue, disabled }: Props) {
  const layout = watch('layoutJson') ?? {};

  const onPrimary = (value: string) => {
    setValue('primaryColor', value, { shouldDirty: true });
    syncThemeDraft({ primaryColor: value });
  };

  return (
    <BrandingSectionCard
      title="Buttons"
      description="Primary, secondary, and destructive action colors."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Controller
          name="primaryColor"
          control={control}
          render={({ field }) => (
            <BrandingColorField
              id="btnPrimary"
              label="Primary"
              value={field.value}
              disabled={disabled}
              onChange={onPrimary}
            />
          )}
        />
        <Controller
          name="accentColor"
          control={control}
          render={({ field }) => (
            <BrandingColorField
              id="btnAccent"
              label="Accent"
              value={field.value}
              disabled={disabled}
              onChange={(v) => {
                setValue('accentColor', v, { shouldDirty: true });
                syncThemeDraft({ accentColor: v });
              }}
            />
          )}
        />
        <BrandingColorField
          id="btnPrimaryHover"
          label="Primary hover"
          value={layout.buttonPrimaryHover ?? '#1d4ed8'}
          disabled={disabled}
          onChange={(v) => patchLayoutJson('buttonPrimaryHover', v, layout, setValue)}
        />
        <BrandingColorField
          id="btnSecondary"
          label="Secondary"
          value={layout.buttonSecondaryBg ?? '#f1f5f9'}
          disabled={disabled}
          onChange={(v) => patchLayoutJson('buttonSecondaryBg', v, layout, setValue)}
        />
        <BrandingColorField
          id="btnDestructive"
          label="Destructive"
          value={layout.buttonDestructiveBg ?? '#dc2626'}
          disabled={disabled}
          onChange={(v) => patchLayoutJson('buttonDestructiveBg', v, layout, setValue)}
        />
      </div>
    </BrandingSectionCard>
  );
}
