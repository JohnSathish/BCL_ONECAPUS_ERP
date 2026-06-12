'use client';

import type { UseFormSetValue, UseFormWatch } from 'react-hook-form';
import type { AppThemeSettings } from '@/types/branding';
import { BrandingSectionCard, brandingTextareaClass } from './branding-section-card';
import { syncThemeDraft } from './theme-section-utils';

type Props = {
  watch: UseFormWatch<AppThemeSettings>;
  setValue: UseFormSetValue<AppThemeSettings>;
  disabled?: boolean;
};

export function ThemeCustomCssSection({ watch, setValue, disabled }: Props) {
  const enabled = watch('customCssEnabled') ?? false;
  const css = watch('customCss') ?? '';

  return (
    <BrandingSectionCard
      title="Custom CSS"
      description="Optional tenant overrides injected after theme tokens. Use with care."
    >
      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
        Scripts, @import, and url() are blocked. Changes apply instantly when enabled.
      </div>
      <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 rounded border-border"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => {
            setValue('customCssEnabled', e.target.checked, { shouldDirty: true });
            syncThemeDraft({ customCssEnabled: e.target.checked });
          }}
        />
        <span>
          <span className="block text-sm font-medium">Enable custom CSS</span>
          <span className="text-xs text-muted-foreground">Injected as a scoped style block</span>
        </span>
      </label>
      <textarea
        className={`${brandingTextareaClass} min-h-[200px] font-mono text-xs`}
        disabled={disabled || !enabled}
        value={css}
        placeholder={`.glass-card {\n  border-radius: 1rem;\n}`}
        onChange={(e) => {
          setValue('customCss', e.target.value, { shouldDirty: true });
          syncThemeDraft({ customCss: e.target.value });
        }}
      />
    </BrandingSectionCard>
  );
}
