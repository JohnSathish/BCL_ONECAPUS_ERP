'use client';

import type { Control, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { LOGIN_BACKGROUND_OPTIONS } from '@/types/branding';
import { cn } from '@/utils/cn';
import { BrandingSectionCard } from './branding-section-card';
import type { BrandingFormValues } from './use-branding-studio-form';

type Props = {
  register: UseFormRegister<BrandingFormValues>;
  control: Control<BrandingFormValues>;
  watch: UseFormWatch<BrandingFormValues>;
  setValue: UseFormSetValue<BrandingFormValues>;
  disabled?: boolean;
};

function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
  comingSoon,
}: {
  id: string;
  label: string;
  description?: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
  comingSoon?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border border-border/50 px-4 py-3',
        (disabled || comingSoon) && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-1 rounded border-border"
        checked={checked ?? false}
        disabled={disabled || comingSoon}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        ) : null}
        {comingSoon ? (
          <span className="mt-0.5 block text-xs text-primary/80">Coming in Phase 2</span>
        ) : null}
      </span>
    </label>
  );
}

export function BrandingThemeSection({ register, control, watch, setValue, disabled }: Props) {
  const loginBackgroundStyle = watch('loginBackgroundStyle');

  return (
    <BrandingSectionCard
      title="Theme & login experience"
      description="Brand colors and login surface styling applied across the portal."
    >
      <div className="space-y-8">
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Login experience
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Brand colors are configured in the Colors tab. These settings control the login surface.
          </p>
        </div>

        <div>
          <Label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Login background
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {LOGIN_BACKGROUND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => setValue('loginBackgroundStyle', opt.value, { shouldDirty: true })}
                className={cn(
                  'rounded-xl border-2 p-4 text-left transition-all',
                  loginBackgroundStyle === opt.value
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border/60 hover:border-primary/40',
                )}
              >
                <div
                  className={cn(
                    'mb-3 h-16 rounded-lg',
                    opt.value === 'gradient' &&
                      'bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700',
                    opt.value === 'mesh' &&
                      'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900',
                    opt.value === 'solid' && 'bg-blue-600',
                  )}
                />
                <span className="text-sm font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
          <input type="hidden" {...register('loginBackgroundStyle')} />
        </div>

        <div>
          <Label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Portal options
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ToggleRow
              id="showPoweredBy"
              label='Show "Powered by BCL OneCampus ERP"'
              description="Display attribution on login and portal footer."
              checked={watch('showPoweredBy')}
              disabled={disabled}
              onChange={(v) => setValue('showPoweredBy', v, { shouldDirty: true })}
            />
            <ToggleRow
              id="brandingEnabled"
              label="Enable institution branding"
              description="Apply custom colors, logos, and labels tenant-wide."
              checked={watch('brandingEnabled')}
              disabled={disabled}
              onChange={(v) => setValue('brandingEnabled', v, { shouldDirty: true })}
            />
            <ToggleRow id="animatedBackground" label="Enable animated background" comingSoon />
            <ToggleRow id="loginHeroPanel" label="Enable login hero panel" comingSoon />
          </div>
        </div>

        <div>
          <Label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quick actions
          </Label>
          <p className="text-xs text-muted-foreground">
            Use the Layout tab for one-click flagship theme packages like DBC Enterprise Blue,
            Midnight Executive, Neo Glass Enterprise, and Carbon Black Enterprise.
          </p>
        </div>
      </div>
    </BrandingSectionCard>
  );
}
