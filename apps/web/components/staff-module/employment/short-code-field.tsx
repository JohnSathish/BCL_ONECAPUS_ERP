'use client';

import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { normalizeShortCodeInput } from '@/components/staff-module/employment/employment-utils';
import { suggestStaffShortCode } from '@/services/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Props = {
  value: string;
  fullName?: string;
  departmentId?: string | null;
  primaryShiftId?: string | null;
  campusId?: string | null;
  excludeStaffId?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
};

export function ShortCodeField({
  value,
  fullName,
  departmentId,
  primaryShiftId,
  campusId,
  excludeStaffId,
  onChange,
  disabled,
  error,
}: Props) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  async function handleSuggest() {
    if (!fullName?.trim() || disabled || suggesting) return;
    if (!departmentId && !primaryShiftId && !campusId) {
      setSuggestError('Select department or shift first, then click Suggest');
      return;
    }
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestStaffShortCode({
        fullName: fullName.trim(),
        departmentId: departmentId || undefined,
        primaryShiftId: primaryShiftId || undefined,
        campusId: campusId || undefined,
        excludeStaffId,
      });
      if (result.shortCode) {
        onChange(normalizeShortCodeInput(result.shortCode));
      } else {
        setSuggestError('Could not suggest a free short code');
      }
    } catch (err) {
      setSuggestError(apiErrorMessage(err));
    } finally {
      setSuggesting(false);
    }
  }

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
            disabled={disabled || suggesting}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'h-8 shrink-0 text-xs',
            )}
            onClick={() => void handleSuggest()}
          >
            {suggesting ? '…' : 'Suggest'}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {suggestError ? <p className="text-[11px] text-destructive">{suggestError}</p> : null}
      <p className="text-[10px] text-muted-foreground">
        Uppercase, max 10 chars, unique per campus. Suggest checks the database and never returns an
        already allotted code.
      </p>
    </div>
  );
}
