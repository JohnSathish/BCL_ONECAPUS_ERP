'use client';

import { buttonVariants } from '@/components/ui/button';
import {
  normalizeShortCodeInput,
  suggestStaffShortCode,
} from '@/components/staff-module/employment/employment-utils';
import { cn } from '@/utils/cn';

type Props = {
  value: string;
  fullName?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

export function ShortCodeField({ value, fullName, onChange, disabled, error }: Props) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          className={cn(
            'h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs uppercase tracking-wide',
            error && 'border-destructive',
          )}
          value={value}
          maxLength={10}
          disabled={disabled}
          placeholder="JS"
          onChange={(e) => onChange(normalizeShortCodeInput(e.target.value))}
          onBlur={() => onChange(normalizeShortCodeInput(value))}
        />
        {fullName ? (
          <button
            type="button"
            disabled={disabled}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-8 shrink-0 text-xs',
            )}
            onClick={() => onChange(suggestStaffShortCode(fullName))}
          >
            Suggest
          </button>
        ) : null}
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      <p className="text-[10px] text-muted-foreground">
        Uppercase, max 10 chars, unique per campus
      </p>
    </div>
  );
}
