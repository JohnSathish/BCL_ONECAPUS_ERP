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

export function ThemeCardsSection({ control, watch, setValue, disabled }: Props) {
  const layout = watch('layoutJson') ?? {};

  const onCard = (field: 'cardBg' | 'borderColor', value: string) => {
    setValue(field, value, { shouldDirty: true });
    syncThemeDraft({ [field]: value });
  };

  return (
    <BrandingSectionCard title="Cards" description="Panel surfaces, borders, glass, and density.">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Controller
          name="cardBg"
          control={control}
          render={({ field }) => (
            <BrandingColorField
              id="cardBg"
              label="Background"
              value={field.value}
              disabled={disabled}
              onChange={(v) => onCard('cardBg', v)}
            />
          )}
        />
        <Controller
          name="borderColor"
          control={control}
          render={({ field }) => (
            <BrandingColorField
              id="cardBorder"
              label="Border"
              value={field.value}
              disabled={disabled}
              onChange={(v) => onCard('borderColor', v)}
            />
          )}
        />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 rounded border-border"
            checked={layout.glassEnabled !== false}
            disabled={disabled}
            onChange={(e) => patchLayoutJson('glassEnabled', e.target.checked, layout, setValue)}
          />
          <span>
            <span className="block text-sm font-medium">Glass effect</span>
            <span className="text-xs text-muted-foreground">Frosted card surfaces</span>
          </span>
        </label>
        <div>
          <label className="mb-2 block text-sm font-medium">Card density</label>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            disabled={disabled}
            value={layout.cardDensity ?? 'comfortable'}
            onChange={(e) => patchLayoutJson('cardDensity', e.target.value, layout, setValue)}
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Shadow intensity</label>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            disabled={disabled}
            value={layout.shadowIntensity ?? 'soft'}
            onChange={(e) => patchLayoutJson('shadowIntensity', e.target.value, layout, setValue)}
          >
            <option value="soft">Soft</option>
            <option value="medium">Medium</option>
            <option value="strong">Strong</option>
          </select>
        </div>
      </div>
    </BrandingSectionCard>
  );
}
