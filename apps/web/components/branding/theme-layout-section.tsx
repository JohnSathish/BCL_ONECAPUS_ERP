'use client';

import type { UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { PRESET_LIST } from '@/lib/theme/default-themes';
import { BrandingSectionCard } from './branding-section-card';
import type { ThemeFormValues } from './use-branding-studio-form';
import { syncThemeDraft } from './theme-section-utils';
import { cn } from '@/utils/cn';

type Props = {
  watch: UseFormWatch<ThemeFormValues>;
  setValue: UseFormSetValue<ThemeFormValues>;
  disabled?: boolean;
};

const ROUNDED_OPTIONS = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
  { value: 'xl', label: 'XL' },
  { value: '2xl', label: '2XL' },
];

const DENSITY_OPTIONS = [
  {
    value: 'compact',
    label: 'Compact',
    description: 'Maximum rows for operational users.',
    cardDensity: 'compact',
    tableDensity: 'compact',
  },
  {
    value: 'comfortable',
    label: 'Comfortable',
    description: 'Balanced ERP default for forms and dashboards.',
    cardDensity: 'comfortable',
    tableDensity: 'comfortable',
  },
  {
    value: 'spacious',
    label: 'Spacious',
    description: 'More whitespace for student portals and staff work.',
    cardDensity: 'comfortable',
    tableDensity: 'comfortable',
    spacious: true,
  },
  {
    value: 'executive',
    label: 'Executive',
    description: 'Presentation-friendly cards with compact data tables.',
    cardDensity: 'comfortable',
    tableDensity: 'compact',
    executive: true,
  },
] as const;

const ACCESSIBILITY_OPTIONS = [
  {
    value: 'highContrast',
    label: 'High Contrast',
    description: 'Sharper borders and stronger text contrast for readability.',
    patch: {
      borderColor: '#94A3B8',
      tableHeaderBg: '#E2E8F0',
      tableRowHover: '#F1F5F9',
      shadowIntensity: 'soft',
      accessibilityMode: 'high-contrast',
    },
  },
  {
    value: 'lowEyeStrain',
    label: 'Low Eye Strain',
    description: 'Softer surfaces for long data-entry sessions.',
    patch: {
      tableHeaderBg: '#F8FAFC',
      tableRowHover: '#F8FAFC',
      shadowIntensity: 'soft',
      accessibilityMode: 'low-eye-strain',
    },
  },
  {
    value: 'colorblindSafe',
    label: 'Colorblind Safe',
    description: 'Blue, teal, and amber-safe operational accents.',
    patch: {
      tableHeaderBg: '#EFF6FF',
      tableRowHover: '#F0FDFA',
      accessibilityMode: 'colorblind-safe',
    },
  },
] as const;

const MODULE_OVERRIDE_OPTIONS = [
  { key: 'admin', label: 'Admin', description: 'Core administration workspace' },
  { key: 'analytics', label: 'Analytics', description: 'Dashboards, BI, and AI insights' },
  { key: 'finance', label: 'Finance', description: 'Fees, payroll, and accounts' },
  { key: 'studentPortal', label: 'Student Portal', description: 'Student-facing academic screens' },
  { key: 'attendance', label: 'Attendance', description: 'Staff attendance and biometric console' },
  { key: 'timetable', label: 'Timetable', description: 'FYUGP routine and planning engine' },
] as const;

export function ThemeLayoutSection({ watch, setValue, disabled }: Props) {
  const layoutJson = watch('layoutJson') ?? {};
  const moduleThemeOverrides = layoutJson.moduleThemeOverrides ?? {};

  const updateLayout = (next: typeof layoutJson) => {
    setValue('layoutJson', next, { shouldDirty: true });
    syncThemeDraft({ layoutJson: next });
  };

  return (
    <BrandingSectionCard
      title="Layout"
      description="Global corner radius and structural spacing tokens."
    >
      <div className="space-y-6">
        <div>
          <Label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Corner radius
          </Label>
          <div className="flex flex-wrap gap-2">
            {ROUNDED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setValue('roundedStyle', opt.value, { shouldDirty: true });
                  syncThemeDraft({ roundedStyle: opt.value });
                }}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm transition',
                  watch('roundedStyle') === opt.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border/60 hover:border-primary/40',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Density mode
          </Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DENSITY_OPTIONS.map((opt) => {
              const active =
                layoutJson.cardDensity === opt.cardDensity &&
                layoutJson.tableDensity === opt.tableDensity;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const next = {
                      ...layoutJson,
                      cardDensity: opt.cardDensity,
                      tableDensity: opt.tableDensity,
                      spaciousMode: Boolean('spacious' in opt && opt.spacious),
                      executiveMode: Boolean('executive' in opt && opt.executive),
                    };
                    updateLayout(next);
                  }}
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/60 hover:border-primary/40',
                  )}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Accessibility pack
          </Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ACCESSIBILITY_OPTIONS.map((opt) => {
              const active = layoutJson.accessibilityMode === opt.patch.accessibilityMode;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const next = { ...layoutJson, ...opt.patch };
                    updateLayout(next);
                  }}
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border/60 hover:border-primary/40',
                  )}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Per-module theme overrides
          </Label>
          <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/10 p-3">
            {MODULE_OVERRIDE_OPTIONS.map((module) => (
              <div
                key={module.key}
                className="grid gap-2 rounded-xl border border-border/40 bg-card p-3 sm:grid-cols-[1fr_220px]"
              >
                <div>
                  <div className="text-sm font-semibold">{module.label}</div>
                  <div className="text-xs text-muted-foreground">{module.description}</div>
                </div>
                <select
                  disabled={disabled}
                  value={moduleThemeOverrides[module.key] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    const nextOverrides = { ...moduleThemeOverrides };
                    if (value) {
                      nextOverrides[module.key] = value;
                    } else {
                      delete nextOverrides[module.key];
                    }
                    updateLayout({
                      ...layoutJson,
                      moduleThemeOverrides: nextOverrides,
                    });
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Use global theme</option>
                  {PRESET_LIST.map((preset) => (
                    <option key={preset.themeName} value={preset.themeName}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrandingSectionCard>
  );
}
