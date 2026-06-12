'use client';

import type { UseFormSetValue, UseFormWatch } from 'react-hook-form';
import type { AppThemeSettings } from '@/types/branding';
import { BrandingColorField } from './branding-color-field';
import { BrandingSectionCard } from './branding-section-card';
import { patchLayoutJson } from './theme-section-utils';

type Props = {
  watch: UseFormWatch<AppThemeSettings>;
  setValue: UseFormSetValue<AppThemeSettings>;
  disabled?: boolean;
};

export function ThemeTablesSection({ watch, setValue, disabled }: Props) {
  const layout = watch('layoutJson') ?? {};

  return (
    <BrandingSectionCard title="Tables" description="Data grid header, hover, and row density.">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <BrandingColorField
          id="tableHeaderBg"
          label="Header background"
          value={layout.tableHeaderBg ?? '#f1f5f9'}
          disabled={disabled}
          onChange={(v) => patchLayoutJson('tableHeaderBg', v, layout, setValue)}
        />
        <BrandingColorField
          id="tableRowHover"
          label="Row hover"
          value={layout.tableRowHover ?? '#f8fafc'}
          disabled={disabled}
          onChange={(v) => patchLayoutJson('tableRowHover', v, layout, setValue)}
        />
      </div>
      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium">Table density</label>
        <select
          className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm"
          disabled={disabled}
          value={layout.tableDensity ?? 'comfortable'}
          onChange={(e) => patchLayoutJson('tableDensity', e.target.value, layout, setValue)}
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </div>
    </BrandingSectionCard>
  );
}
