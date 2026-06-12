'use client';

import type { UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { useTheme as useNextTheme } from 'next-themes';
import { Label } from '@/components/ui/label';
import { BrandingSectionCard } from './branding-section-card';
import type { ThemeFormValues } from './use-branding-studio-form';
import { useThemeStore } from '@/lib/theme/theme-store';
import { cn } from '@/utils/cn';

type Props = {
  watch: UseFormWatch<ThemeFormValues>;
  setValue: UseFormSetValue<ThemeFormValues>;
  disabled?: boolean;
};

const MODES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto (system)' },
] as const;

export function ThemeAppearanceSection({ watch, setValue, disabled }: Props) {
  const { setTheme } = useNextTheme();
  const mode = watch('appearanceMode') ?? 'system';
  const darkModeEnabled = watch('darkModeEnabled');

  return (
    <BrandingSectionCard
      title="Dark Mode"
      description="Tenant default appearance for new users. Individual users can override via the header toggle."
    >
      <div className="space-y-6">
        <div>
          <Label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Color mode
          </Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {MODES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setValue('appearanceMode', opt.value, { shouldDirty: true });
                  useThemeStore.getState().mergeDraft({ appearanceMode: opt.value });
                  setTheme(opt.value);
                }}
                className={cn(
                  'rounded-xl border-2 px-4 py-3 text-sm font-medium transition',
                  mode === opt.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/60 hover:border-primary/40',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 rounded border-border"
            checked={darkModeEnabled ?? true}
            disabled={disabled}
            onChange={(e) => {
              setValue('darkModeEnabled', e.target.checked, { shouldDirty: true });
              useThemeStore.getState().mergeDraft({ darkModeEnabled: e.target.checked });
            }}
          />
          <span>
            <span className="block text-sm font-medium">Allow dark mode</span>
            <span className="text-xs text-muted-foreground">
              When disabled, users stay on light mode only
            </span>
          </span>
        </label>
      </div>
    </BrandingSectionCard>
  );
}
