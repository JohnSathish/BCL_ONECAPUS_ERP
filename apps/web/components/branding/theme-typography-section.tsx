'use client';

import type { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { BrandingSectionCard, brandingInputClass } from './branding-section-card';
import type { ThemeFormValues } from './use-branding-studio-form';
import { useThemeStore } from '@/lib/theme/theme-store';

type Props = {
  register: UseFormRegister<ThemeFormValues>;
  watch: UseFormWatch<ThemeFormValues>;
  setValue: UseFormSetValue<ThemeFormValues>;
  disabled?: boolean;
};

const FONT_OPTIONS = [
  { value: '', label: 'Inter / Geist default' },
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  {
    value:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
    label: 'SF Pro',
  },
  { value: '"IBM Plex Sans", Inter, system-ui, sans-serif', label: 'IBM Plex Sans' },
  { value: 'Geist, Inter, system-ui, sans-serif', label: 'Geist' },
  { value: '"Plus Jakarta Sans", Inter, system-ui, sans-serif', label: 'Plus Jakarta Sans' },
  { value: 'Manrope, Inter, system-ui, sans-serif', label: 'Manrope' },
];

export function ThemeTypographySection({ register, watch, setValue, disabled }: Props) {
  const fontFamily = watch('fontFamily') ?? '';

  return (
    <BrandingSectionCard
      title="Typography"
      description="Corporate typography presets for clean dashboards, dense tables, and long-hour staff usage."
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="fontFamily" className="mb-2 block text-sm font-medium">
            Font family
          </Label>
          <select
            id="fontFamily"
            className={brandingInputClass}
            disabled={disabled}
            value={fontFamily}
            onChange={(e) => {
              const value = e.target.value || undefined;
              setValue('fontFamily', value, { shouldDirty: true });
              useThemeStore.getState().mergeDraft({ fontFamily: value });
            }}
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input type="hidden" {...register('fontFamily')} />
        </div>
        <p className="text-xs text-muted-foreground">
          Choose fonts already available in the browser stack or loaded by your deployment. Inter
          remains the recommended ERP default.
        </p>
      </div>
    </BrandingSectionCard>
  );
}
